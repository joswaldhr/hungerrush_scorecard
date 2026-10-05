// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  dataSources,
  employees,
  externalIdentities,
  metricAssignments,
  metricDefinitions,
  organizations,
  teams,
} from "@/lib/db/schema";
import { registerInboundReportCatalog } from "@/lib/connectors/zendesk-inbound-catalog";
import { inboundReportKeys } from "@/lib/connectors/zendesk-inbound-report";
import { parseInboundReportPolicy } from "@/lib/connectors/zendesk-inbound-report-record";

let org: string, team: string, source: string, employee: string;
const now = new Date("2026-10-05T12:00:00Z");
const existingKeys = [
  "inbound_calls_offered",
  "inbound_calls_accepted",
  "declined_calls",
  "missed_calls",
  "inbound_calls_abandoned_on_hold",
];
const policy = () =>
  parseInboundReportPolicy({
    schemaVersion: 1,
    organizationId: org,
    dataSourceId: source,
    teamId: team,
    accountReference: "zendesk-account:synthetic",
    effectivePeriodStart: "2026-10-11",
    timeZone: "America/Chicago",
    groupIds: [7],
    phoneNumbers: ["synthetic-line"],
    dateBasis: "call-created",
    offeredDefinition: "accepted-declined-missed-unreachable",
    metricKeys: [...inboundReportKeys],
    observationLimits: { maxAgeMs: 900000, maxSpanMs: 600000 },
  });
const register = () =>
  registerInboundReportCatalog(
    policy(),
    { organizationId: org, dataSourceId: source },
    "synthetic",
    now
  );
const definitions = () =>
  db.select().from(metricDefinitions).where(eq(metricDefinitions.organizationId, org));
const assignments = () =>
  db.select().from(metricAssignments).where(eq(metricAssignments.teamId, team));

beforeEach(async () => {
  org = randomUUID();
  team = randomUUID();
  source = randomUUID();
  employee = randomUUID();
  await db.insert(organizations).values({ id: org, name: "Synthetic inbound registration" });
  await db
    .insert(teams)
    .values({ id: team, organizationId: org, name: "Synthetic team", slug: team });
  await db.insert(employees).values({
    id: employee,
    organizationId: org,
    primaryTeamId: team,
    displayName: "Synthetic agent",
  });
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "zendesk",
    displayName: "Synthetic source",
    status: "configured",
    configurationReference: "zendesk-account:synthetic",
  });
  await db.insert(externalIdentities).values({
    dataSourceId: source,
    employeeId: employee,
    externalId: "synthetic@example.invalid",
    externalEntityType: "user",
    matchMethod: "manual",
  });
  for (const key of [...existingKeys, "avg_talk_time_inbound"]) {
    const [definition] = await db
      .insert(metricDefinitions)
      .values({
        organizationId: org,
        key,
        name: key,
        sourceStrategy: "zendesk",
        unit: key.startsWith("avg_") ? "s" : "calls",
        valueType: key.startsWith("avg_") ? "duration" : "count",
        calculationType: key.startsWith("avg_") ? "average" : "sum",
      })
      .returning({ id: metricDefinitions.id });
    await db.insert(metricAssignments).values({ metricDefinitionId: definition!.id, teamId: team });
  }
});
afterEach(async () => {
  const ids = (await definitions()).map((d) => d.id);
  if (ids.length) {
    await db.delete(metricAssignments).where(inArray(metricAssignments.metricDefinitionId, ids));
    await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, ids));
  }
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(employees).where(eq(employees.organizationId, org));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(eq(teams.organizationId, org));
  await db.delete(organizations).where(eq(organizations.id, org));
});

describe.sequential("prospective inbound catalog registration (PostgreSQL)", () => {
  it("creates exactly four future definitions/assignments and preserves existing rows", async () => {
    const oldDefinitions = await definitions(),
      oldAssignments = await assignments();
    const receipt = await register();
    expect(receipt.activeEmployees).toBe(1);
    expect(receipt.created).toHaveLength(4);
    const added = (await definitions()).filter((d) =>
      receipt.created.some((r) => r.definitionId === d.id)
    );
    expect(added).toHaveLength(4);
    for (const d of added) {
      expect(d.direction).toBe("neutral");
      expect(d.effectiveFrom).toBe("2026-10-11");
    }
    const afterAssignments = await assignments();
    for (const r of receipt.created) {
      const assignment = afterAssignments.find((a) => a.id === r.assignmentId)!;
      expect(assignment.effectiveFrom).toBe("2026-10-11");
      expect(assignment.employeeId).toBeNull();
      expect(assignment.roleKey).toBeNull();
    }
    expect((await definitions()).filter((d) => oldDefinitions.some((p) => p.id === d.id))).toEqual(
      oldDefinitions
    );
    expect(afterAssignments.filter((a) => oldAssignments.some((p) => p.id === a.id))).toEqual(
      oldAssignments
    );
    await expect(register()).rejects.toThrow("already exist");
    expect(await definitions()).toHaveLength(10);
  });

  it("rolls back all additions when a required old assignment is absent", async () => {
    const offered = (await definitions()).find((d) => d.key === "inbound_calls_offered")!;
    await db.delete(metricAssignments).where(eq(metricAssignments.metricDefinitionId, offered.id));
    const before = await definitions();
    await expect(register()).rejects.toThrow("missing or ambiguous");
    expect(await definitions()).toEqual(before);
    expect(await assignments()).toHaveLength(5);
  });

  it("rolls back for an incompatible old duration/count definition", async () => {
    const offered = (await definitions()).find((d) => d.key === "inbound_calls_offered")!;
    await db
      .update(metricDefinitions)
      .set({ unit: "s" })
      .where(eq(metricDefinitions.id, offered.id));
    const before = await definitions();
    await expect(register()).rejects.toThrow("incompatible");
    expect(await definitions()).toEqual(before);
    expect(await assignments()).toHaveLength(6);
  });

  it("rolls back if an employee lacks a source identity", async () => {
    await db.delete(externalIdentities).where(eq(externalIdentities.employeeId, employee));
    await expect(register()).rejects.toThrow("identity bindings");
    expect(await definitions()).toHaveLength(6);
    expect(await assignments()).toHaveLength(6);
  });

  it("rolls back when the stored source belongs to another Zendesk account", async () => {
    await db
      .update(dataSources)
      .set({ configurationReference: "zendesk-account:foreign" })
      .where(eq(dataSources.id, source));
    await expect(register()).rejects.toThrow();
    expect(await definitions()).toHaveLength(6);
    expect(await assignments()).toHaveLength(6);
  });

  it("rejects an existing addition of any version without adopting or editing it", async () => {
    await db.insert(metricDefinitions).values({
      organizationId: org,
      key: "total_talk_time_inbound",
      name: "Existing unqualified definition",
      version: 2,
    });
    const before = await definitions();
    await expect(register()).rejects.toThrow("already exist");
    expect(await definitions()).toEqual(before);
    expect(await assignments()).toHaveLength(6);
  });

  it("rejects current/past cutovers, incomplete contracts and mismatched owners", async () => {
    const config = { organizationId: org, dataSourceId: source };
    for (const cutover of ["2026-10-04", "2026-10-05"]) {
      await expect(
        registerInboundReportCatalog(
          { ...policy(), effectivePeriodStart: cutover },
          config,
          "synthetic",
          now
        )
      ).rejects.toThrow();
    }
    await expect(
      registerInboundReportCatalog(
        { ...policy(), metricKeys: ["inbound_calls_offered"] },
        config,
        "synthetic",
        now
      )
    ).rejects.toThrow("full-contract");
    await expect(
      registerInboundReportCatalog(
        policy(),
        { ...config, organizationId: randomUUID() },
        "synthetic",
        now
      )
    ).rejects.toThrow("matching owner");
    expect(await definitions()).toHaveLength(6);
  });

  it("serializes concurrent attempts without duplicate definitions or assignments", async () => {
    const outcomes = await Promise.allSettled([register(), register()]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await definitions()).toHaveLength(10);
    expect(await assignments()).toHaveLength(10);
  });
});
