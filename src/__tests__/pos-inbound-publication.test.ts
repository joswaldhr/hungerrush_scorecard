// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
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
  metricValues,
  normalizedFacts,
  sourceRecords,
  syncRuns,
  syncErrors,
  syncRevisions,
} from "@/lib/db/schema";
import { runSync } from "@/lib/connectors/sync-engine";
import { createPosInboundPublisher } from "@/lib/connectors/zendesk-pos-inbound-publisher";
import { posInboundPublicationFixture } from "./fixtures/pos-inbound-publication";
import { posInboundReportKeys } from "@/lib/connectors/zendesk-pos-inbound-report";
import { POS_INBOUND_CONTRACT } from "@/lib/domain/metrics/source-context";
import { ZendeskConnector } from "@/lib/connectors/zendesk";

const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID(),
  employee = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const defs = [...posInboundReportKeys, "inbound_calls_offered"].map((key) => ({
  id: randomUUID(),
  key,
  unit: key.startsWith("avg_") ? "s" : "calls",
  valueType: key.startsWith("avg_") ? "duration" : "count",
  calculationType: key.startsWith("avg_") ? "average" : "sum",
}));
const ids = defs.map((d) => d.id);
const fixture = () => posInboundPublicationFixture(config, employee, team);
const period = () => {
  const f = fixture();
  return { periodStart: f.periodStart, periodEnd: f.periodEnd };
};
const values = () =>
  db.select().from(metricValues).where(inArray(metricValues.metricDefinitionId, ids));
const currentValue = async (key: string) =>
  (await values()).find((v) => v.metricDefinitionId === defs.find((d) => d.key === key)!.id);
function publisher(f = fixture(), mutate?: () => Promise<void>, now?: () => Date) {
  return createPosInboundPublisher(
    f.release,
    async (_config, start, end) => {
      expect([start, end]).toEqual([f.periodStart, f.periodEnd]);
      await mutate?.();
      return { snapshot: f.snapshot, identities: new Map([["agent", 42]]) };
    },
    "synthetic",
    now
  );
}
function legacy(value: number) {
  const f = fixture(),
    connector = new ZendeskConnector();
  connector.fetchRecords = async () => ({
    records: [
      {
        externalRecordType: "call_stats",
        externalRecordId: "legacy",
        employeeExternalId: "agent",
        occurredAt: new Date(),
        sourceUpdatedAt: new Date(),
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
        payload: {
          inboundOffered: value,
          inboundAccepted: value,
          avgTalkTimeInbound: value,
          avgHoldTimeInbound: value,
        },
      },
    ],
    cursor: null,
    hasMore: false,
  });
  return connector;
}
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Inbound publication test" });
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
    employeeId: employee,
    dataSourceId: source,
    externalId: "agent",
    externalEntityType: "user",
    matchMethod: "manual",
  });
  await db
    .insert(metricDefinitions)
    .values(
      defs.map((d) => ({ ...d, organizationId: org, name: d.key, sourceStrategy: "zendesk" }))
    );
  await db
    .insert(metricAssignments)
    .values(ids.map((metricDefinitionId) => ({ metricDefinitionId, teamId: team })));
});
afterAll(async () => {
  await db.delete(metricValues).where(inArray(metricValues.metricDefinitionId, ids));
  await db.delete(normalizedFacts).where(eq(normalizedFacts.organizationId, org));
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  const runs = db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(eq(syncRuns.dataSourceId, source));
  await db.delete(syncRevisions).where(inArray(syncRevisions.syncRunId, runs));
  await db.delete(syncErrors).where(inArray(syncErrors.syncRunId, runs));
  await db.delete(syncRuns).where(eq(syncRuns.dataSourceId, source));
  await db.delete(metricAssignments).where(inArray(metricAssignments.metricDefinitionId, ids));
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, ids));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(employees).where(eq(employees.id, employee));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(eq(teams.id, team));
  await db.delete(organizations).where(eq(organizations.id, org));
});

describe.sequential("POS publication through the real PostgreSQL transaction", () => {
  it("publishes exact report means, preserves unrelated keys, and resists legacy overwrite", async () => {
    expect((await runSync(legacy(999), config, { weekOffset: 1 })).success).toBe(true);
    expect((await runSync(publisher(), config, { period: period() })).success).toBe(true);
    expect(await currentValue("avg_hold_time_inbound")).toMatchObject({
      numericValue: 20,
      calculationVersion: 2,
      provenanceJson: { sourceContract: POS_INBOUND_CONTRACT, sampleCount: 3, cohortCount: 3 },
    });
    expect(await currentValue("avg_talk_time_inbound")).toMatchObject({ numericValue: 2 / 3 });
    expect(await currentValue("inbound_calls_accepted")).toMatchObject({ numericValue: 2 });
    expect(await currentValue("inbound_calls_offered")).toMatchObject({ numericValue: 999 });
    expect((await runSync(legacy(400), config, { weekOffset: 1 })).success).toBe(true);
    expect(await currentValue("avg_hold_time_inbound")).toMatchObject({ numericValue: 20 });
    expect(await currentValue("inbound_calls_offered")).toMatchObject({ numericValue: 400 });
  });
  it("retracts unknown corrected measurements and retains predecessors instead of zero filling", async () => {
    const f = fixture();
    for (const call of f.snapshot.calls) Object.assign(call, { hold_time: null });
    f.snapshot.legs[0]!.talk_time = null;
    const published = await runSync(publisher(f), config, { period: period() });
    expect(published.success).toBe(true);
    expect(await currentValue("avg_hold_time_inbound")).toMatchObject({
      numericValue: null,
      qualityStatus: "missing",
      provenanceJson: { sampleCount: 0, cohortCount: 3 },
    });
    expect(await currentValue("inbound_calls_accepted")).toMatchObject({ numericValue: null });
    expect(await currentValue("declined_calls")).toMatchObject({ numericValue: 0 });
    const revisions = await db
      .select()
      .from(syncRevisions)
      .where(eq(syncRevisions.syncRunId, published.syncRunId));
    expect(
      revisions.some(
        (r) =>
          r.entityType === "metric_value" &&
          (r.snapshotJson as Record<string, unknown>).numeric_value === 20
      )
    ).toBe(true);
    expect(await currentValue("inbound_calls_offered")).toMatchObject({ numericValue: 400 });
  });
  it("rolls back when an identity changes during fetch, preserving all prior values", async () => {
    const before = await values();
    const result = await runSync(
      publisher(fixture(), async () => {
        await db
          .update(externalIdentities)
          .set({ externalId: "changed" })
          .where(eq(externalIdentities.dataSourceId, source));
      }),
      config,
      { period: period() }
    );
    expect(result.success).toBe(false);
    expect(await values()).toEqual(before);
    await db
      .update(externalIdentities)
      .set({ externalId: "agent" })
      .where(eq(externalIdentities.dataSourceId, source));
  });
  it("rechecks compatible metric assignments under transaction locks", async () => {
    const before = await values();
    const def = defs.find((d) => d.key === "avg_hold_time_inbound")!;
    const result = await runSync(
      publisher(fixture(), async () => {
        await db
          .update(metricDefinitions)
          .set({ calculationType: "sum" })
          .where(eq(metricDefinitions.id, def.id));
      }),
      config,
      { period: period() }
    );
    expect(result.success).toBe(false);
    expect(await values()).toEqual(before);
    await db
      .update(metricDefinitions)
      .set({ calculationType: "average" })
      .where(eq(metricDefinitions.id, def.id));
  });
  it("rejects a departure during collection without deleting history or changing values", async () => {
    const before = await values();
    const result = await runSync(
      publisher(fixture(), async () => {
        await db
          .update(employees)
          .set({ employmentStatus: "inactive" })
          .where(eq(employees.id, employee));
      }),
      config,
      { period: period() }
    );
    expect(result.success).toBe(false);
    expect(await values()).toEqual(before);
    await db
      .update(employees)
      .set({ employmentStatus: "active" })
      .where(eq(employees.id, employee));
  });
  it("rejects a stale capture at publication after a valid fetch", async () => {
    const before = await values();
    let calls = 0;
    const f = fixture();
    const at = new Date();
    const result = await runSync(
      publisher(f, undefined, () => new Date(at.getTime() + (++calls > 2 ? 3600000 : 0))),
      config,
      { period: period() }
    );
    expect(result.success).toBe(false);
    expect(calls).toBe(3);
    const errors = await db
      .select()
      .from(syncErrors)
      .where(eq(syncErrors.syncRunId, result.syncRunId));
    expect(JSON.stringify(errors)).toContain("Invalid POS inbound source observation coverage");
    expect(await values()).toEqual(before);
  });
  it("rejects a changed fetched record before any source or value write", async () => {
    const before = await values();
    const connector = publisher();
    const fetch = connector.fetchRecords.bind(connector);
    connector.fetchRecords = async (...args) => {
      const result = await fetch(...args);
      result.records[0]!.externalRecordId = "tampered";
      return result;
    };
    expect((await runSync(connector, config, { period: period() })).success).toBe(false);
    expect(await values()).toEqual(before);
  });
});
