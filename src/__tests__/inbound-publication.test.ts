// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  teams,
  employees,
  dataSources,
  externalIdentities,
  metricDefinitions,
  metricValues,
  sourceRecords,
  normalizedFacts,
  syncRuns,
  syncErrors,
  syncRevisions,
} from "@/lib/db/schema";
import { runSync } from "@/lib/connectors/sync-engine";
import { ZendeskConnector } from "@/lib/connectors/zendesk";
import { buildInboundRecord } from "@/lib/connectors/zendesk-inbound-record";
import { inboundObservationFixture } from "./fixtures/inbound-observation";
import type { Connector, IngestedRecord } from "@/lib/connectors/types";
import { INBOUND_PARTICIPATION_CONTRACT } from "@/lib/domain/metrics/source-context";

const org = randomUUID(),
  team = randomUUID(),
  employee = randomUUID(),
  source = randomUUID();
const definitions = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
const config = { organizationId: org, dataSourceId: source };
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Synthetic inbound publication" });
  await db
    .insert(teams)
    .values({ id: team, organizationId: org, name: "Synthetic team", slug: team });
  await db.insert(employees).values({
    id: employee,
    organizationId: org,
    displayName: "Synthetic agent",
    primaryTeamId: team,
  });
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    displayName: "Synthetic source",
    type: "zendesk",
    status: "configured",
    configurationReference: "zendesk-account:synthetic",
  });
  await db.insert(externalIdentities).values({
    dataSourceId: source,
    employeeId: employee,
    externalId: "agent",
    externalEntityType: "agent",
    matchMethod: "manual",
  });
  await db.insert(metricDefinitions).values(
    [
      "inbound_calls_offered",
      "avg_talk_time_inbound",
      "avg_hold_time_inbound",
      "outbound_calls",
    ].map((key, index) => ({
      id: definitions[index]!,
      organizationId: org,
      key,
      name: key,
      sourceStrategy: "zendesk",
      calculationType: key.startsWith("avg_") ? "average" : "sum",
      unit: key.startsWith("avg_") ? "s" : "calls",
      valueType: key.startsWith("avg_") ? "duration" : "count",
    }))
  );
});
afterAll(async () => {
  await db.delete(metricValues).where(inArray(metricValues.metricDefinitionId, definitions));
  await db.delete(normalizedFacts).where(eq(normalizedFacts.organizationId, org));
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  const runs = db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(eq(syncRuns.dataSourceId, source));
  await db.delete(syncRevisions).where(inArray(syncRevisions.syncRunId, runs));
  await db.delete(syncErrors).where(inArray(syncErrors.syncRunId, runs));
  await db.delete(syncRuns).where(eq(syncRuns.dataSourceId, source));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, definitions));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(employees).where(eq(employees.id, employee));
  await db.delete(teams).where(eq(teams.id, team));
  await db.delete(organizations).where(eq(organizations.id, org));
});
const normalize = new ZendeskConnector();
const publish = (records: IngestedRecord[]) => {
  const c: Connector = {
    sourceType: "zendesk",
    healthCheck: async () => ({ connected: true, message: "Synthetic", lastSyncAt: null }),
    fetchRecords: async () => ({ records, cursor: null, hasMore: false }),
    normalizeRecords: normalize.normalizeRecords.bind(normalize),
    resolveIdentities: async () => [],
    discoverRoster: async () => [],
  };
  return runSync(c, config);
};
const read = () =>
  db
    .select()
    .from(metricValues)
    .where(inArray(metricValues.metricDefinitionId, definitions))
    .orderBy(metricValues.id);

it("publishes one inbound snapshot atomically, preserves siblings/history and resists legacy refresh", async () => {
  const f = inboundObservationFixture(config, employee, team);
  f.policy.teams[0]!.inbound!.metricKeys = [
    "inbound_calls_offered",
    "avg_talk_time_inbound",
    "avg_hold_time_inbound",
  ];
  const replacement = () =>
    buildInboundRecord(f.snapshot, f.policy, config, f.identity, f.periodStart, f.periodEnd, f.now);
  const legacy: IngestedRecord = {
    externalRecordType: "call_stats",
    externalRecordId: "inbound-fixture-legacy",
    employeeExternalId: "agent",
    occurredAt: f.now,
    sourceUpdatedAt: f.now,
    periodStart: f.periodStart,
    periodEnd: f.periodEnd,
    payload: {
      inboundOffered: 99,
      avgTalkTimeInbound: 120,
      avgHoldTimeInbound: 120,
      outboundTotal: 12,
    },
  };
  expect(
    (
      await publish([
        legacy,
        {
          ...legacy,
          externalRecordId: "inbound-fixture-history",
          periodStart: "2026-09-13",
          periodEnd: "2026-09-19",
        },
      ])
    ).success
  ).toBe(true);
  const before = await read();
  const sourcesBefore = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, source))
    .orderBy(sourceRecords.id);
  const factsBefore = await db
    .select()
    .from(normalizedFacts)
    .where(eq(normalizedFacts.organizationId, org))
    .orderBy(normalizedFacts.id);
  expect((await publish([replacement()])).valuesWritten).toBe(3);
  const after = await read();
  const current = after.filter(
    (v) => v.periodStart === f.periodStart && v.metricDefinitionId !== definitions[3]
  );
  expect(current.find((v) => v.metricDefinitionId === definitions[0])).toMatchObject({
    numericValue: 4,
    calculationVersion: 2,
    provenanceJson: {
      sourceContract: INBOUND_PARTICIPATION_CONTRACT,
      dateBasis: "call-created",
      offeredDefinition: "accepted-declined-missed-unreachable",
    },
  });
  const talk = current.find((v) => v.metricDefinitionId === definitions[1])!;
  expect(talk).toMatchObject({
    numericValue: 2 / 3,
    provenanceJson: { sampleCount: 3, cohortCount: 3 },
  });
  expect(current.find((v) => v.metricDefinitionId === definitions[2])?.numericValue).toBeNull();
  expect(after.filter((v) => !current.some((c) => c.id === v.id))).toEqual(
    before.filter((v) => !current.some((c) => c.id === v.id))
  );
  expect(
    await db
      .select()
      .from(sourceRecords)
      .where(
        inArray(
          sourceRecords.id,
          sourcesBefore.map((r) => r.id)
        )
      )
      .orderBy(sourceRecords.id)
  ).toEqual(sourcesBefore);
  expect(
    await db
      .select()
      .from(normalizedFacts)
      .where(
        inArray(
          normalizedFacts.id,
          factsBefore.map((r) => r.id)
        )
      )
      .orderBy(normalizedFacts.id)
  ).toEqual(factsBefore);
  expect((await publish([replacement()])).valuesWritten).toBe(0);
  expect(
    (
      await publish([
        {
          ...legacy,
          payload: {
            ...legacy.payload,
            inboundOffered: 88,
            avgTalkTimeInbound: 60,
            outboundTotal: 14,
          },
        },
      ])
    ).success
  ).toBe(true);
  const refreshed = await read();
  expect(refreshed.find((v) => v.id === talk.id)).toMatchObject({
    numericValue: 2 / 3,
    dataFreshnessAt: talk.dataFreshnessAt,
  });
  expect(
    refreshed.find(
      (v) => v.metricDefinitionId === definitions[3] && v.periodStart === f.periodStart
    )?.numericValue
  ).toBe(14);
  f.snapshot.legs[0]!.talk_time = 3;
  await db.update(employees).set({ primaryTeamId: null }).where(eq(employees.id, employee));
  try {
    expect((await publish([replacement()])).success).toBe(false);
    expect(await read()).toEqual(refreshed);
  } finally {
    await db.update(employees).set({ primaryTeamId: team }).where(eq(employees.id, employee));
  }
  f.snapshot.legs.forEach((l) => {
    l.talk_time = null;
  });
  expect((await publish([replacement()])).valuesWritten).toBe(3);
  expect((await read()).find((v) => v.id === talk.id)).toMatchObject({
    numericValue: null,
    qualityStatus: "missing",
    provenanceJson: { sampleCount: 0, cohortCount: 3 },
  });
  const revisions = await db
    .select()
    .from(syncRevisions)
    .where(eq(syncRevisions.entityId, talk.id));
  expect(
    revisions.some((r) => (r.snapshotJson as Record<string, unknown>).numeric_value === 120)
  ).toBe(true);
  expect(
    revisions.some((r) => (r.snapshotJson as Record<string, unknown>).numeric_value === 2 / 3)
  ).toBe(true);
});
