// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  teams,
  employees,
  dataSources,
  externalIdentities,
  metricDefinitions,
  metricAssignments,
} from "@/lib/db/schema";
import { loadInboundReportBindings } from "@/lib/connectors/zendesk-inbound-report-bindings";
import { parseInboundReportPolicy } from "@/lib/connectors/zendesk-inbound-report-record";

const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID(),
  employee = randomUUID(),
  otherTeam = randomUUID(),
  otherEmployee = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const definitions = [
  {
    id: randomUUID(),
    key: "inbound_calls_offered",
    unit: "calls",
    valueType: "count",
    calculationType: "sum",
  },
  {
    id: randomUUID(),
    key: "total_talk_time_inbound",
    unit: "s",
    valueType: "duration",
    calculationType: "sum",
  },
  {
    id: randomUUID(),
    key: "max_hold_time_inbound",
    unit: "s",
    valueType: "duration",
    calculationType: "max",
  },
  {
    id: randomUUID(),
    key: "inbound_calls_answer_rate",
    unit: "%",
    valueType: "percentage",
    calculationType: "latest",
  },
];
const ids = definitions.map((d) => d.id);
const policy = parseInboundReportPolicy({
  schemaVersion: 1,
  ...config,
  teamId: team,
  accountReference: "zendesk-account:synthetic",
  effectivePeriodStart: "2026-09-20",
  timeZone: "America/Chicago",
  groupIds: [7],
  phoneNumbers: ["synthetic-line"],
  dateBasis: "call-created",
  offeredDefinition: "accepted-declined-missed-unreachable",
  metricKeys: definitions.map((d) => d.key),
  observationLimits: { maxAgeMs: 900000, maxSpanMs: 600000 },
});
const load = () => loadInboundReportBindings(policy, config, "2026-09-20", "synthetic");
const identity = {
  dataSourceId: source,
  employeeId: employee,
  externalId: "agent@example.test",
  externalEntityType: "user",
  matchMethod: "manual",
};
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Inbound fixture" });
  await db
    .insert(teams)
    .values(
      [team, otherTeam].map((id) => ({ id, organizationId: org, name: "Synthetic team", slug: id }))
    );
  await db.insert(employees).values([
    { id: employee, organizationId: org, primaryTeamId: team, displayName: "Synthetic agent" },
    {
      id: otherEmployee,
      organizationId: org,
      primaryTeamId: otherTeam,
      displayName: "Outside policy",
    },
  ]);
  await db
    .insert(dataSources)
    .values({
      id: source,
      organizationId: org,
      type: "zendesk",
      displayName: "Synthetic source",
      status: "configured",
      configurationReference: "zendesk-account:synthetic",
    });
  await db.insert(externalIdentities).values(identity);
  await db
    .insert(metricDefinitions)
    .values(
      definitions.map((d) => ({
        ...d,
        organizationId: org,
        name: d.key,
        sourceStrategy: "zendesk",
      }))
    );
  await db
    .insert(metricAssignments)
    .values(ids.map((metricDefinitionId) => ({ metricDefinitionId, teamId: team })));
});
afterAll(async () => {
  await db.delete(metricAssignments).where(inArray(metricAssignments.metricDefinitionId, ids));
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, ids));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(employees).where(inArray(employees.id, [employee, otherEmployee]));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(inArray(teams.id, [team, otherTeam]));
  await db.delete(organizations).where(eq(organizations.id, org));
});
describe.sequential("inactive inbound source preflight (PostgreSQL)", () => {
  it("returns only the policy team's active employees without changing assignments", async () => {
    const before = await db
      .select()
      .from(metricAssignments)
      .where(inArray(metricAssignments.metricDefinitionId, ids));
    expect(await load()).toEqual([
      { employeeId: employee, teamId: team, externalId: identity.externalId },
    ]);
    expect(
      await db
        .select()
        .from(metricAssignments)
        .where(inArray(metricAssignments.metricDefinitionId, ids))
    ).toEqual(before);
    await expect(
      loadInboundReportBindings(
        policy,
        { ...config, organizationId: randomUUID() },
        "2026-09-20",
        "synthetic"
      )
    ).rejects.toThrow("does not own");
    for (const period of ["2026-09-13", "2026-09-21", "2026-02-30"])
      await expect(
        loadInboundReportBindings(policy, config, period, "synthetic")
      ).rejects.toThrow();
    await expect(
      loadInboundReportBindings(policy, config, "2026-09-20", "foreign")
    ).rejects.toThrow("binding");
  });
  it("rejects unbound source accounts and foreign teams", async () => {
    await db
      .update(dataSources)
      .set({ configurationReference: null })
      .where(eq(dataSources.id, source));
    try {
      await expect(load()).rejects.toThrow("binding");
    } finally {
      await db
        .update(dataSources)
        .set({ configurationReference: policy.accountReference })
        .where(eq(dataSources.id, source));
    }
    await expect(
      loadInboundReportBindings(
        { ...policy, teamId: randomUUID() },
        config,
        "2026-09-20",
        "synthetic"
      )
    ).rejects.toThrow("organization");
  });
  it("requires correct SUM/MAX/ratio definitions and active effective assignments", async () => {
    for (const d of definitions) {
      await db
        .update(metricDefinitions)
        .set({ calculationType: "average" })
        .where(eq(metricDefinitions.id, d.id));
      try {
        await expect(load()).rejects.toThrow("incompatible");
      } finally {
        await db
          .update(metricDefinitions)
          .set({ calculationType: d.calculationType })
          .where(eq(metricDefinitions.id, d.id));
      }
    }
    const metric = ids[0]!;
    await db
      .update(metricDefinitions)
      .set({ status: "inactive" })
      .where(eq(metricDefinitions.id, metric));
    try {
      await expect(load()).rejects.toThrow("incompatible");
    } finally {
      await db
        .update(metricDefinitions)
        .set({ status: "active" })
        .where(eq(metricDefinitions.id, metric));
    }
    await db
      .update(metricAssignments)
      .set({ effectiveTo: "2026-09-20" })
      .where(eq(metricAssignments.metricDefinitionId, metric));
    try {
      await expect(load()).rejects.toThrow("missing");
    } finally {
      await db
        .update(metricAssignments)
        .set({ effectiveTo: null })
        .where(eq(metricAssignments.metricDefinitionId, metric));
    }
    const [duplicate] = await db
      .insert(metricAssignments)
      .values({ metricDefinitionId: metric, teamId: team })
      .returning();
    try {
      await expect(load()).rejects.toThrow("ambiguous");
    } finally {
      await db.delete(metricAssignments).where(eq(metricAssignments.id, duplicate!.id));
    }
    await db
      .update(metricAssignments)
      .set({ employeeId: employee })
      .where(eq(metricAssignments.metricDefinitionId, metric));
    try {
      await expect(load()).rejects.toThrow("team-wide");
    } finally {
      await db
        .update(metricAssignments)
        .set({ employeeId: null })
        .where(eq(metricAssignments.metricDefinitionId, metric));
    }
  });
  it("rejects missing, ambiguous or non-user identities", async () => {
    await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
    try {
      await expect(load()).rejects.toThrow("identity");
    } finally {
      await db.insert(externalIdentities).values(identity);
    }
    const [duplicate] = await db
      .insert(externalIdentities)
      .values({ ...identity, externalId: "second@example.test" })
      .returning();
    try {
      await expect(load()).rejects.toThrow("identity");
    } finally {
      await db.delete(externalIdentities).where(eq(externalIdentities.id, duplicate!.id));
    }
    await db
      .update(externalIdentities)
      .set({ externalEntityType: "ticket" })
      .where(eq(externalIdentities.dataSourceId, source));
    try {
      await expect(load()).rejects.toThrow("identity");
    } finally {
      await db
        .update(externalIdentities)
        .set({ externalEntityType: "user" })
        .where(eq(externalIdentities.dataSourceId, source));
    }
  });
});
