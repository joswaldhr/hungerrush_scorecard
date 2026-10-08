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
  normalizedFacts,
  sourceRecords,
  syncRuns,
  syncErrors,
  syncRevisions,
} from "@/lib/db/schema";
import { runSync } from "@/lib/connectors/sync-engine";
import { ZendeskConnector } from "@/lib/connectors/zendesk";
import type { Connector, IngestedRecord } from "@/lib/connectors/types";

const org = randomUUID(),
  source = randomUUID();
const teamIds = [randomUUID(), randomUUID()];
const employeeIds = [randomUUID(), randomUUID()];
const keys = ["tickets_resolved", "tickets_updated", "backlog_count"];
const definitionIds = keys.map(() => randomUUID());
const observed = new Date("2026-10-06T08:00:00Z");
const connector = new ZendeskConnector();

function records(): IngestedRecord[] {
  return employeeIds.map((id, index) => ({
    externalRecordType: "agent_stats",
    externalRecordId: `stats-${id}`,
    employeeExternalId: id,
    occurredAt: observed,
    sourceUpdatedAt: observed,
    periodStart: "2026-09-27",
    periodEnd: "2026-10-03",
    payload: { ticketsResolved: 17 - index, ticketsUpdated: 28 - index, backlogCount: 3 + index },
  }));
}
function fixture(legacy: boolean, fail = false): Connector {
  return {
    sourceType: "zendesk",
    healthCheck: async () => ({ connected: true, message: "synthetic", lastSyncAt: null }),
    fetchRecords: async () => {
      if (fail) throw Error("Synthetic fetch failure");
      return { records: records(), cursor: "done", hasMore: false };
    },
    resolveIdentities: async () => [],
    discoverRoster: async () => [],
    normalizeRecords: (input, employeeId, teamId, periodStart, periodEnd) => {
      const facts = connector.normalizeRecords(input, employeeId, teamId, periodStart, periodEnd);
      // A stale producer cannot bypass the publication guard with numeric facts.
      return legacy ? facts.map((fact) => ({ ...fact, numericValue: 999 })) : facts;
    },
  };
}

beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Synthetic ticket-credit test" });
  await db
    .insert(teams)
    .values(
      teamIds.map((id, i) => ({ id, organizationId: org, name: `Team ${i}`, slug: `team-${i}` }))
    );
  await db.insert(employees).values(
    employeeIds.map((id, i) => ({
      id,
      organizationId: org,
      primaryTeamId: teamIds[i],
      displayName: `Synthetic ${i}`,
    }))
  );
  await db
    .insert(dataSources)
    .values({ id: source, organizationId: org, type: "zendesk", displayName: "Synthetic" });
  await db.insert(externalIdentities).values(
    employeeIds.map((id) => ({
      dataSourceId: source,
      employeeId: id,
      externalId: id,
      externalEntityType: "user",
      matchMethod: "manual",
    }))
  );
  await db.insert(metricDefinitions).values(
    keys.map((key, i) => ({
      id: definitionIds[i],
      organizationId: org,
      key,
      name: key,
      sourceStrategy: "zendesk",
      calculationType: "sum",
      version: 99,
    }))
  );
  await db.insert(metricValues).values(
    employeeIds.flatMap((employeeId) =>
      ["2026-09-27", "2026-09-20"].flatMap((periodStart) =>
        definitionIds.map((metricDefinitionId) => ({
          employeeId,
          metricDefinitionId,
          periodStart,
          periodEnd: periodStart === "2026-09-27" ? "2026-10-03" : "2026-09-26",
          numericValue: 88,
          calculationVersion: 1,
          calculatedAt: observed,
          qualityStatus: "complete",
        }))
      )
    )
  );
});
afterAll(async () => {
  await db.delete(metricValues).where(inArray(metricValues.metricDefinitionId, definitionIds));
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
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, definitionIds));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(employees).where(eq(employees.organizationId, org));
  await db.delete(teams).where(eq(teams.organizationId, org));
  await db.delete(organizations).where(eq(organizations.id, org));
});

it.each([0, 17, null, undefined])(
  "does not convert an assignee snapshot (%s) into human activity",
  (value) => {
    const input = {
      sourceRecordId: "synthetic",
      payload: { ticketsResolved: value, ticketsUpdated: value, backlogCount: 0 },
    };
    const before = JSON.stringify(input);
    const facts = connector.normalizeRecords(
      [input],
      employeeIds[0]!,
      teamIds[0]!,
      "2026-09-27",
      "2026-10-03"
    );
    expect(
      facts.filter((f) => keys.slice(0, 2).includes(f.factType)).map((f) => f.numericValue)
    ).toEqual([null, null]);
    expect(facts.find((f) => f.factType === "backlog_count")?.numericValue).toBe(0);
    expect(JSON.stringify(input)).toBe(before);
  }
);

it("retracts false credits for both teams with retained predecessors, scoped periods and rollback", async () => {
  const config = { organizationId: org, dataSourceId: source };
  const failed = await runSync(fixture(false, true), config);
  expect(failed.success).toBe(false);
  expect(
    (
      await db
        .select()
        .from(metricValues)
        .where(inArray(metricValues.metricDefinitionId, definitionIds))
    ).every((v) => v.numericValue === 88)
  ).toBe(true);
  const result = await runSync(fixture(false), config);
  expect(result.success).toBe(true);
  const values = await db
    .select()
    .from(metricValues)
    .where(inArray(metricValues.metricDefinitionId, definitionIds));
  for (const employeeId of employeeIds) {
    for (const metricDefinitionId of definitionIds.slice(0, 2)) {
      expect(
        values.find(
          (v) =>
            v.employeeId === employeeId &&
            v.metricDefinitionId === metricDefinitionId &&
            v.periodStart === "2026-09-27"
        )
      ).toMatchObject({ numericValue: null, qualityStatus: "unverified_attribution" });
    }
  }
  expect(
    values.filter((v) => v.periodStart === "2026-09-20").every((v) => v.numericValue === 88)
  ).toBe(true);
  expect(
    values
      .filter((v) => v.periodStart === "2026-09-27" && v.metricDefinitionId === definitionIds[2])
      .map((v) => v.numericValue)
      .sort()
  ).toEqual([3, 4]);
  const revisions = await db
    .select()
    .from(syncRevisions)
    .where(eq(syncRevisions.syncRunId, result.syncRunId));
  expect(revisions.filter((r) => r.entityType === "metric_value")).toHaveLength(6);
  for (const revision of revisions.filter((r) => r.entityType === "metric_value"))
    expect(revision.snapshotJson).toMatchObject({ numeric_value: 88 });
  const retained = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, source));
  expect(retained.map((r) => r.payloadJson)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ ticketsResolved: 16 }),
      expect.objectContaining({ ticketsResolved: 17 }),
    ])
  );
  const next = await runSync(fixture(true), config, { reprocessUnchanged: true });
  expect(next.success).toBe(true);
  const guarded = await db
    .select()
    .from(metricValues)
    .where(inArray(metricValues.metricDefinitionId, definitionIds.slice(0, 2)));
  expect(
    guarded
      .filter((v) => v.periodStart === "2026-09-27")
      .every((v) => v.numericValue === null && v.qualityStatus === "unverified_attribution")
  ).toBe(true);
});
