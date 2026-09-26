// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
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
vi.mock("@/lib/env", () => ({ env: { ZENDESK_SUBDOMAIN: "synthetic" } }));
import {
  createOutboundConnector,
  loadOutboundEmployeeBindings,
} from "@/lib/connectors/zendesk-outbound-connector";
import { outboundObservationFixture } from "./fixtures/outbound-observation";

const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID(),
  employee = randomUUID(),
  metric = randomUUID(),
  otherTeam = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const fixture = outboundObservationFixture(config, employee, team);
fixture.policy.teams[0]!.outbound!.metricKeys = ["outbound_calls"];
const load = () =>
  loadOutboundEmployeeBindings(fixture.policy, config, fixture.periodStart, "synthetic");
const identity = {
  dataSourceId: source,
  employeeId: employee,
  externalId: "synthetic@example.test",
  externalEntityType: "user",
  matchMethod: "manual",
};
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Outbound fixture" });
  await db
    .insert(teams)
    .values(
      [team, otherTeam].map((id) => ({ id, organizationId: org, name: "Synthetic team", slug: id }))
    );
  await db.insert(employees).values({
    id: employee,
    organizationId: org,
    primaryTeamId: team,
    displayName: "Synthetic employee",
  });
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "zendesk",
    displayName: "Synthetic source",
    status: "configured",
    configurationReference: "zendesk-account:synthetic",
  });
  await db.insert(externalIdentities).values(identity);
  await db.insert(metricDefinitions).values({
    id: metric,
    organizationId: org,
    key: "outbound_calls",
    name: "Outbound",
    unit: "calls",
    valueType: "count",
    calculationType: "sum",
    sourceStrategy: "zendesk",
  });
  await db.insert(metricAssignments).values([
    { metricDefinitionId: metric, teamId: team },
    { metricDefinitionId: metric, teamId: otherTeam },
  ]);
});
afterAll(async () => {
  await db.delete(metricAssignments).where(eq(metricAssignments.metricDefinitionId, metric));
  await db.delete(metricDefinitions).where(eq(metricDefinitions.id, metric));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(employees).where(eq(employees.id, employee));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(inArray(teams.id, [team, otherTeam]));
  await db.delete(organizations).where(eq(organizations.id, org));
});
it("binds one team's canary without claiming the same metric assigned to another team", async () => {
  expect(await load()).toEqual([
    { employeeId: employee, teamId: team, externalId: identity.externalId },
  ]);
  await expect(
    loadOutboundEmployeeBindings(
      fixture.policy,
      { ...config, organizationId: randomUUID() },
      fixture.periodStart,
      "synthetic"
    )
  ).rejects.toThrow("organization");
  await db
    .update(dataSources)
    .set({ configurationReference: null })
    .where(eq(dataSources.id, source));
  try {
    await expect(load()).rejects.toThrow("binding");
  } finally {
    await db
      .update(dataSources)
      .set({ configurationReference: "zendesk-account:synthetic" })
      .where(eq(dataSources.id, source));
  }
});
it("rejects incompatible metric units and ambiguous effective assignments", async () => {
  await db.update(metricDefinitions).set({ unit: "s" }).where(eq(metricDefinitions.id, metric));
  try {
    await expect(load()).rejects.toThrow("incompatible");
  } finally {
    await db
      .update(metricDefinitions)
      .set({ unit: "calls" })
      .where(eq(metricDefinitions.id, metric));
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
});
it("rejects a missing active employee identity before source collection", async () => {
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  try {
    await expect(load()).rejects.toThrow("identity");
  } finally {
    await db.insert(externalIdentities).values(identity);
  }
});
it("does not make vendor requests when durable source streams are absent", async () => {
  const fetcher = vi
    .spyOn(globalThis, "fetch")
    .mockRejectedValue(Error("unexpected vendor request"));
  try {
    await expect(
      createOutboundConnector(fixture.policy).fetchRecords(config, {
        ...config,
        syncRunId: randomUUID(),
        cursor: "0",
      })
    ).rejects.toThrow("still collecting");
    expect(fetcher).not.toHaveBeenCalled();
  } finally {
    fetcher.mockRestore();
  }
});
