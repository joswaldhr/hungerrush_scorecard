// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
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
import { createInboundPublisher } from "@/lib/connectors/zendesk-inbound-publisher";
import { ZendeskConnector } from "@/lib/connectors/zendesk";
import { INBOUND_PARTICIPATION_CONTRACT } from "@/lib/domain/metrics/source-context";
import { inboundPublicationFixture } from "./fixtures/inbound-publication";

const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID(),
  employee = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const defs = [
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
    key: "inbound_calls_answer_rate",
    unit: "%",
    valueType: "percentage",
    calculationType: "latest",
  },
  {
    id: randomUUID(),
    key: "avg_talk_time_inbound",
    unit: "s",
    valueType: "duration",
    calculationType: "average",
  },
];
const ids = defs.map((d) => d.id);
const fixture = () => inboundPublicationFixture(config, employee, team);
const values = () =>
  db.select().from(metricValues).where(inArray(metricValues.metricDefinitionId, ids));
const currentValue = async (key: string) =>
  (await values()).find((v) => v.metricDefinitionId === defs.find((d) => d.key === key)!.id);
function publisher(f = fixture(), mutate?: () => Promise<void>, now?: () => Date) {
  return createInboundPublisher(
    f.release,
    async () => {
      await mutate?.();
      return { snapshot: f.snapshot, identities: new Map([["agent", 42]]) };
    },
    "synthetic",
    now
  );
}
function legacy(value: number) {
  const f = fixture(),
    c = new ZendeskConnector();
  c.fetchRecords = async () => ({
    records: [
      {
        externalRecordType: "call_stats",
        externalRecordId: "legacy",
        employeeExternalId: "agent",
        occurredAt: new Date(),
        sourceUpdatedAt: new Date(),
        periodStart: f.periodStart,
        periodEnd: f.periodEnd,
        payload: { inboundOffered: value, avgTalkTimeInbound: 50 },
      },
    ],
    cursor: null,
    hasMore: false,
  });
  return c;
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
describe.sequential("inbound publication through the real PostgreSQL transaction", () => {
  it("replaces only qualified keys and resists later legacy refresh without changing averages", async () => {
    expect((await runSync(legacy(999), config, { weekOffset: 0 })).success).toBe(true);
    expect((await runSync(publisher(), config, { weekOffset: 0 })).success).toBe(true);
    expect(await currentValue("inbound_calls_offered")).toMatchObject({
      numericValue: 2,
      calculationVersion: 2,
      provenanceJson: { sourceContract: INBOUND_PARTICIPATION_CONTRACT },
    });
    expect(await currentValue("total_talk_time_inbound")).toMatchObject({
      numericValue: 2,
      provenanceJson: { sampleCount: 3, cohortCount: 3 },
    });
    expect(await currentValue("inbound_calls_answer_rate")).toMatchObject({ numericValue: 100 });
    expect(await currentValue("avg_talk_time_inbound")).toMatchObject({ numericValue: 50 });
    expect((await runSync(legacy(400), config, { weekOffset: 0 })).success).toBe(true);
    expect(await currentValue("inbound_calls_offered")).toMatchObject({ numericValue: 2 });
  });
  it("retracts corrected unknown values, retains revisions and preserves numeric zero", async () => {
    const f = fixture();
    f.snapshot.legs[0]!.talk_time = null;
    const result = await runSync(publisher(f), config, { weekOffset: 0 });
    expect(result.success).toBe(true);
    for (const key of f.release.policy.metricKeys)
      expect(await currentValue(key)).toMatchObject({
        numericValue: null,
        qualityStatus: "missing",
      });
    expect(
      (await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId)))
        .length
    ).toBeGreaterThan(0);
    const zero = fixture();
    for (const leg of zero.snapshot.legs) leg.talk_time = 0;
    expect((await runSync(publisher(zero), config, { weekOffset: 0 })).success).toBe(true);
    expect(await currentValue("inbound_calls_offered")).toMatchObject({ numericValue: 0 });
    expect(await currentValue("total_talk_time_inbound")).toMatchObject({ numericValue: 0 });
    expect(await currentValue("inbound_calls_answer_rate")).toMatchObject({ numericValue: null });
  });
  it("rechecks changed assignments inside the transaction and rolls back the entire publication", async () => {
    const before = await values();
    const result = await runSync(
      publisher(fixture(), async () => {
        await db
          .update(metricDefinitions)
          .set({ unit: "wrong" })
          .where(eq(metricDefinitions.id, ids[0]!));
      }),
      config,
      { weekOffset: 0 }
    );
    try {
      expect(result.success).toBe(false);
      expect(await values()).toEqual(before);
      expect(
        await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
      ).toHaveLength(0);
      expect(
        await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId))
      ).toHaveLength(0);
    } finally {
      await db
        .update(metricDefinitions)
        .set({ unit: "calls" })
        .where(eq(metricDefinitions.id, ids[0]!));
    }
  });
  it("rejects a publisher without transactional scope validation", async () => {
    const c = publisher();
    delete (c as import("@/lib/connectors/types").Connector).validatePublication;
    expect((await runSync(c, config, { weekOffset: 0 })).success).toBe(false);
  });
  it("holds assignment protection through the value commit", async () => {
    const c = publisher(),
      validate = c.validatePublication;
    let prevented = false;
    c.validatePublication = async (tx, cfg, records) => {
      await validate(tx, cfg, records);
      try {
        await db.transaction(async (other) => {
          await other.execute(sql`set local lock_timeout = '100ms'`);
          await other
            .insert(metricAssignments)
            .values({ metricDefinitionId: ids[0]!, teamId: team });
        });
      } catch (error) {
        prevented =
          (error as { cause?: { code?: string }; code?: string }).cause?.code === "55P03" ||
          (error as { code?: string }).code === "55P03";
      }
      if (!prevented) throw Error("Concurrent assignment was not fenced");
    };
    expect((await runSync(c, config, { weekOffset: 0 })).success).toBe(true);
    expect(prevented).toBe(true);
  });
  it("rejects evidence that expires while waiting to publish without changing prior values", async () => {
    const before = await values();
    const at = new Date();
    let reads = 0;
    const result = await runSync(
      publisher(fixture(), undefined, () => new Date(at.getTime() + (++reads > 2 ? 3600000 : 0))),
      config,
      { period: { periodStart: fixture().periodStart, periodEnd: fixture().periodEnd } }
    );
    expect(result.success).toBe(false);
    expect(reads).toBe(3);
    const errors = await db
      .select()
      .from(syncErrors)
      .where(eq(syncErrors.syncRunId, result.syncRunId));
    expect(JSON.stringify(errors)).toContain("Talk observation is stale");
    expect(await values()).toEqual(before);
    expect(
      await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
    ).toHaveLength(0);
  });
  it("rejects a progress capture that becomes a closed week before publication", async () => {
    const before = await values();
    const f = fixture();
    const beforeBoundary = new Date(`${f.periodEnd}T23:59:59Z`);
    const observedStart = new Date(beforeBoundary.getTime() - 60000).toISOString();
    for (const state of [f.snapshot.callsState, f.snapshot.legsState]) {
      state.observationStartedAt = observedStart;
      state.lastPageAt = new Date(beforeBoundary.getTime() - 1000).toISOString();
    }
    for (const row of [...f.snapshot.calls, ...f.snapshot.legs]) row.updated_at = observedStart;
    let reads = 0;
    const result = await runSync(
      publisher(f, undefined, () => new Date(beforeBoundary.getTime() + (++reads > 2 ? 2000 : 0))),
      config,
      { period: { periodStart: f.periodStart, periodEnd: f.periodEnd } }
    );
    expect(result.success).toBe(false);
    const errors = await db
      .select()
      .from(syncErrors)
      .where(eq(syncErrors.syncRunId, result.syncRunId));
    expect(JSON.stringify(errors)).toContain("both collections after period end");
    expect(await values()).toEqual(before);
  });
  it("publishes the explicit prior week rather than reselecting the current offset", async () => {
    const f = fixture();
    const shift = (day: string) =>
      new Date(Date.parse(day) - 7 * 86400000).toISOString().slice(0, 10);
    const period = { periodStart: shift(f.periodStart), periodEnd: shift(f.periodEnd) };
    f.release.policy.effectivePeriodStart = period.periodStart;
    f.snapshot.bootstrapStart -= 7 * 86400;
    for (const state of [f.snapshot.callsState, f.snapshot.legsState]) {
      state.bootstrapStart = f.snapshot.bootstrapStart;
      state.cursor.watermark = f.snapshot.bootstrapStart;
    }
    for (const row of [...f.snapshot.calls, ...f.snapshot.legs])
      row.created_at = `${period.periodStart}T12:00:00Z`;
    const before = (await values()).filter((v) => v.periodStart === f.periodStart);
    const result = await runSync(publisher(f), config, { period });
    expect(result.success).toBe(true);
    const published = (await values()).filter((v) => v.periodStart === period.periodStart);
    expect(published).toHaveLength(3);
    expect(published.find((v) => v.metricDefinitionId === defs[0]!.id)?.numericValue).toBe(2);
    expect((await values()).filter((v) => v.periodStart === f.periodStart)).toEqual(before);
  });
});
