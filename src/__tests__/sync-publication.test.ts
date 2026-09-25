import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
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
import type { Connector, IngestedRecord } from "@/lib/connectors/types";
import { FIRST_REPLY_CONTRACT, SOLVED_CSAT_CONTRACT } from "@/lib/domain/metrics/source-context";
import { ZendeskConnector } from "@/lib/connectors/zendesk";
import { buildSolvedCsatRecord } from "@/lib/connectors/zendesk-solved-csat-record";
import type { fetchSolvedCsatCandidate } from "@/lib/connectors/zendesk-solved-csat";

import { buildFirstReplyRecord } from "@/lib/connectors/zendesk-first-reply-record";
import type { fetchFirstReplyCandidate } from "@/lib/connectors/zendesk-first-reply";

const org = randomUUID(),
  employee = randomUUID(),
  source = randomUUID(),
  metric = randomUUID(),
  team = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const observation = new Date("2026-09-21T07:30:00Z");
function record(value: number | null, week = "2026-09-20", id = "summary"): IngestedRecord {
  return {
    externalRecordType: "summary",
    externalRecordId: `${id}-${week}`,
    employeeExternalId: "agent",
    occurredAt: observation,
    sourceUpdatedAt: observation,
    periodStart: week,
    periodEnd: week === "2026-09-20" ? "2026-09-26" : "2026-09-19",
    payload: { value },
  };
}
function connector(records: IngestedRecord[], fail = false): Connector {
  return {
    sourceType: "test",
    healthCheck: async () => ({ connected: true, message: "", lastSyncAt: null }),
    fetchRecords: async () => {
      if (fail) throw new Error("Synthetic source outage");
      return { records, cursor: "done", hasMore: false };
    },
    normalizeRecords: (rows, employeeId, teamId, periodStart, periodEnd) =>
      rows.map((row) => ({
        employeeId,
        teamId,
        periodStart,
        periodEnd,
        factType: "publication_test",
        numericValue: row.payload.value === null ? null : Number(row.payload.value),
        textValue: null,
        booleanValue: null,
        unit: "count",
        dimensionsJson: (row.payload.sourceContext as Record<string, unknown> | undefined) ?? null,
      })),
    resolveIdentities: async () => [],
    discoverRoster: async () => [],
  };
}
async function values() {
  return db.select().from(metricValues).where(eq(metricValues.metricDefinitionId, metric));
}
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Publication test" });
  await db
    .insert(teams)
    .values({ id: team, organizationId: org, name: "Synthetic team", slug: "publication-test" });
  await db.insert(employees).values({
    id: employee,
    organizationId: org,
    displayName: "Test employee",
    primaryTeamId: team,
  });
  await db
    .insert(dataSources)
    .values({ id: source, organizationId: org, type: "test", displayName: "Test" });
  await db.insert(externalIdentities).values({
    dataSourceId: source,
    employeeId: employee,
    externalId: "agent",
    externalEntityType: "user",
    matchMethod: "manual",
  });
  await db.insert(metricDefinitions).values({
    id: metric,
    organizationId: org,
    key: "publication_test",
    name: "Test",
    sourceStrategy: "test",
    calculationType: "sum",
  });
});
afterAll(async () => {
  await db.delete(metricValues).where(eq(metricValues.metricDefinitionId, metric));
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
  await db.delete(metricDefinitions).where(eq(metricDefinitions.id, metric));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(employees).where(eq(employees.id, employee));
  await db.delete(teams).where(eq(teams.id, team));
  await db.delete(organizations).where(eq(organizations.id, org));
});
describe.sequential("atomic metric publication (PostgreSQL)", () => {
  it("rejects disabled sources and mismatched connectors before fetch or run creation", async () => {
    const disabled = connector([]);
    const fetch = vi.spyOn(disabled, "fetchRecords");
    await db.update(dataSources).set({ status: "disabled" }).where(eq(dataSources.id, source));
    try {
      await expect(runSync(disabled, config)).rejects.toThrow("not enabled");
      expect(fetch).not.toHaveBeenCalled();
      expect(
        await db.select().from(syncRuns).where(eq(syncRuns.dataSourceId, source))
      ).toHaveLength(0);
    } finally {
      await db.update(dataSources).set({ status: "configured" }).where(eq(dataSources.id, source));
    }
    await expect(runSync({ ...disabled, sourceType: "other" }, config)).rejects.toThrow(
      "connector mismatch"
    );
    expect(fetch).not.toHaveBeenCalled();
  });
  it("publishes values with source timestamps and preserves untouched weeks and contributing records", async () => {
    expect(
      (
        await runSync(
          connector([record(5), record(7, "2026-09-20", "second"), record(9, "2026-09-13")]),
          config
        )
      ).valuesWritten
    ).toBe(2);
    const before = await values();
    expect(before.find((v) => v.periodStart === "2026-09-20")?.numericValue).toBe(12);
    expect(before.every((v) => v.dataFreshnessAt?.getTime() === observation.getTime())).toBe(true);
    expect((await runSync(connector([record(6)]), config)).valuesWritten).toBe(1);
    const after = await values();
    expect(after.find((v) => v.periodStart === "2026-09-20")?.numericValue).toBe(13);
    expect(after.find((v) => v.periodStart === "2026-09-13")).toEqual(
      before.find((v) => v.periodStart === "2026-09-13")
    );
    expect((await runSync(connector([record(6)]), config)).valuesWritten).toBe(0);
    expect(await values()).toEqual(after);
  });
  it("source outages leave values and last successful sync unchanged", async () => {
    const before = await values();
    const [beforeSource] = await db.select().from(dataSources).where(eq(dataSources.id, source));
    const result = await runSync(connector([], true), config);
    expect(result.success).toBe(false);
    expect(result.valuesWritten).toBe(0);
    expect(await values()).toEqual(before);
    const [afterSource] = await db.select().from(dataSources).where(eq(dataSources.id, source));
    expect(afterSource?.lastSuccessfulSyncAt).toEqual(beforeSource?.lastSuccessfulSyncAt);
  });
  it("preserves explicit source context and atomically rejects mixed contributor definitions", async () => {
    const context = {
      sourceContract: SOLVED_CSAT_CONTRACT,
      reportingTimeZone: "America/Chicago",
    };
    const candidate = {
      ...record(5, "2026-08-02"),
      periodEnd: "2026-08-08",
      payload: { value: 100 / 3, sourceContext: context },
    };
    expect((await runSync(connector([candidate]), config)).success).toBe(true);
    const before = await values();
    expect(
      before.find((v) => v.periodStart === candidate.periodStart)?.provenanceJson
    ).toMatchObject(context);
    expect(before.find((v) => v.periodStart === candidate.periodStart)?.numericValue).toBe(100 / 3);
    const mixed = { ...record(7, "2026-08-02", "legacy"), periodEnd: "2026-08-08" };
    const result = await runSync(connector([mixed]), config);
    expect(result).toMatchObject({ success: false, valuesWritten: 0 });
    expect(await values()).toEqual(before);
    expect(
      await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
    ).toHaveLength(0);
    expect(
      await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId))
    ).toHaveLength(0);
  });
  it("refuses publication when the source is disabled during its fetch", async () => {
    const before = await values();
    const [priorSource] = await db.select().from(dataSources).where(eq(dataSources.id, source));
    const interrupted = connector([record(700)]);
    interrupted.fetchRecords = async () => {
      await db.update(dataSources).set({ status: "disabled" }).where(eq(dataSources.id, source));
      return { records: [record(700)], cursor: "done", hasMore: false };
    };
    try {
      const result = await runSync(interrupted, config);
      expect(result).toMatchObject({ success: false, valuesWritten: 0 });
      expect(await values()).toEqual(before);
      const [afterSource] = await db.select().from(dataSources).where(eq(dataSources.id, source));
      expect(afterSource?.lastSuccessfulSyncAt).toEqual(priorSource?.lastSuccessfulSyncAt);
      expect(
        await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
      ).toHaveLength(0);
      expect(
        await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId))
      ).toHaveLength(0);
    } finally {
      await db.update(dataSources).set({ status: "configured" }).where(eq(dataSources.id, source));
    }
  });
  it("a metric write failure rolls back source records, facts, values and success checkpoint", async () => {
    const beforeValues = await values();
    const beforeFacts = await db
      .select()
      .from(normalizedFacts)
      .where(eq(normalizedFacts.organizationId, org));
    const beforeRecords = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.dataSourceId, source));
    const [beforeSource] = await db.select().from(dataSources).where(eq(dataSources.id, source));
    const trigger = `publication_${org.replaceAll("-", "")}`;
    // Fault injection only in the isolated test database, scoped to this fixture.
    await db.execute(
      sql.raw(
        `CREATE FUNCTION ${trigger}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.employee_id = '${employee}'::uuid THEN RAISE EXCEPTION 'synthetic metric write failure'; END IF; RETURN NEW; END $$`
      )
    );
    try {
      await db.execute(
        sql.raw(
          `CREATE TRIGGER ${trigger} BEFORE INSERT OR UPDATE ON metric_values FOR EACH ROW EXECUTE FUNCTION ${trigger}()`
        )
      );
      const result = await runSync(connector([record(99)]), config);
      expect(result.success).toBe(false);
      expect(result.valuesWritten).toBe(0);
      expect(
        await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId))
      ).toHaveLength(0);
      expect(await values()).toEqual(beforeValues);
      expect(
        await db.select().from(normalizedFacts).where(eq(normalizedFacts.organizationId, org))
      ).toEqual(beforeFacts);
      expect(
        await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, source))
      ).toEqual(beforeRecords);
      const [afterSource] = await db.select().from(dataSources).where(eq(dataSources.id, source));
      expect(afterSource?.lastSuccessfulSyncAt).toEqual(beforeSource?.lastSuccessfulSyncAt);
      const [run] = await db.select().from(syncRuns).where(eq(syncRuns.id, result.syncRunId));
      expect(run).toMatchObject({
        status: "failed",
        cursor: null,
        recordsIngested: 0,
        recordsNormalized: 0,
      });
    } finally {
      await db.execute(sql.raw(`DROP TRIGGER IF EXISTS ${trigger} ON metric_values`));
      await db.execute(sql.raw(`DROP FUNCTION ${trigger}()`));
    }
  });

  it("rejects a source account-binding change during collection", async () => {
    const before = await values();
    const interrupted = connector([record(999)]);
    interrupted.fetchRecords = async () => {
      await db
        .update(dataSources)
        .set({ configurationReference: "zendesk-account:changed" })
        .where(eq(dataSources.id, source));
      return { records: [record(999)], cursor: null, hasMore: false };
    };
    try {
      expect((await runSync(interrupted, config)).success).toBe(false);
      expect(await values()).toEqual(before);
    } finally {
      await db
        .update(dataSources)
        .set({ configurationReference: null })
        .where(eq(dataSources.id, source));
    }
  });
  it("rejects a cross-organization source before creating a run", async () => {
    await expect(
      runSync(connector([]), { ...config, organizationId: randomUUID() })
    ).rejects.toThrow("organization mismatch");
  });
  it("fails closed when a multi-page fetch exceeds its limit", async () => {
    const incomplete = connector([]);
    incomplete.fetchRecords = async () => ({
      records: [record(400)],
      cursor: "more",
      hasMore: true,
    });
    const before = await values();
    expect((await runSync(incomplete, config, { maxPages: 1 })).success).toBe(false);
    expect(await values()).toEqual(before);
  });
  it("rejects period reassignment rather than leaving an obsolete old group", async () => {
    const before = await values();
    const changed = { ...record(60), periodStart: "2026-09-13", periodEnd: "2026-09-19" };
    const result = await runSync(connector([changed]), config);
    expect(result.success).toBe(false);
    expect(await values()).toEqual(before);
    expect(
      await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId))
    ).toHaveLength(0);
  });
  it("retracts corrected nulls, retains prior evidence, and distinguishes zero", async () => {
    const result = await runSync(
      connector([record(null), record(null, "2026-09-20", "second")]),
      config
    );
    expect(result.success).toBe(true);
    expect((await values()).find((v) => v.periodStart === "2026-09-20")).toMatchObject({
      numericValue: null,
      qualityStatus: "missing",
    });
    const revisions = await db
      .select()
      .from(syncRevisions)
      .where(eq(syncRevisions.syncRunId, result.syncRunId));
    expect(revisions.filter((r) => r.entityType === "source_record")).toHaveLength(2);
    expect(revisions.filter((r) => r.entityType === "normalized_fact")).toHaveLength(2);
    const priorMetric = revisions.find((r) => r.entityType === "metric_value")
      ?.snapshotJson as Record<string, unknown>;
    expect(priorMetric.numeric_value).toBe(13);
    expect((await runSync(connector([record(0)]), config)).success).toBe(true);
    expect((await values()).find((v) => v.periodStart === "2026-09-20")).toMatchObject({
      numericValue: 0,
      qualityStatus: "partial",
    });
  });
  it("clears facts omitted by a correction and supports explicit unchanged-payload repair", async () => {
    const corrected = connector([record(123)]);
    corrected.normalizeRecords = () => [];
    expect((await runSync(corrected, config)).success).toBe(true);
    expect((await values()).find((v) => v.periodStart === "2026-09-20")?.numericValue).toBeNull();
    // Simulate the audited legacy state: payload is already null/omitted, fact/value are obsolete.
    const [stored] = await db
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.externalRecordId, "summary-2026-09-20"));
    await db
      .update(normalizedFacts)
      .set({ numericValue: 88 })
      .where(eq(normalizedFacts.sourceRecordId, stored!.id));
    await db
      .update(metricValues)
      .set({ numericValue: 88 })
      .where(eq(metricValues.metricDefinitionId, metric));
    const replay = await runSync(corrected, config, { reprocessUnchanged: true });
    expect(replay.success).toBe(true);
    expect((await values()).find((v) => v.periodStart === "2026-09-20")?.numericValue).toBeNull();
    const revisions = await db
      .select()
      .from(syncRevisions)
      .where(eq(syncRevisions.syncRunId, replay.syncRunId));
    expect(
      revisions.some(
        (r) =>
          r.entityType === "metric_value" &&
          (r.snapshotJson as Record<string, unknown>).numeric_value === 88
      )
    ).toBe(true);
  });
  it.each([false, true])(
    "rejects older overlapping fetches after a newer publication (unchanged=%s)",
    async (unchanged) => {
      await runSync(connector([record(41)]), config);
      let release!: () => void;
      let started!: () => void;
      const fetching = new Promise<void>((resolve) => {
        started = resolve;
      });
      const barrier = new Promise<void>((resolve) => {
        release = resolve;
      });
      const slow = connector([record(12)]);
      slow.fetchRecords = async () => {
        started();
        await barrier;
        return { records: [record(12)], cursor: null, hasMore: false };
      };
      const older = runSync(slow, config, { weekOffset: 1 });
      await fetching;
      try {
        expect(
          (await runSync(connector([record(unchanged ? 41 : 52)]), config, { weekOffset: 0 }))
            .success
        ).toBe(true);
        const before = await values();
        release();
        expect((await older).success).toBe(false);
        expect(await values()).toEqual(before);
      } finally {
        release();
        await older;
      }
    }
  );

  it("allows overlapping runs for disjoint weeks", async () => {
    let release!: () => void;
    let started!: () => void;
    const fetching = new Promise<void>((resolve) => {
      started = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = connector([record(17, "2026-09-13")]);
    slow.fetchRecords = async () => {
      started();
      await barrier;
      return { records: [record(17, "2026-09-13")], cursor: null, hasMore: false };
    };
    const older = runSync(slow, config, { weekOffset: 1 });
    await fetching;
    try {
      expect((await runSync(connector([record(51)]), config, { weekOffset: 0 })).success).toBe(
        true
      );
      release();
      expect((await older).success).toBe(true);
      expect((await values()).find((v) => v.periodStart === "2026-09-13")?.numericValue).toBe(17);
    } finally {
      release();
      await older;
    }
  });
  it("allows only one concurrent lease for overlapping source/week work", async () => {
    let release!: () => void;
    let started!: () => void;
    const fetching = new Promise<void>((resolve) => {
      started = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = connector([record(61)]);
    slow.fetchRecords = async () => {
      started();
      await barrier;
      return { records: [record(61)], cursor: null, hasMore: false };
    };
    const running = runSync(slow, config, { weekOffset: 0 });
    await fetching;
    try {
      const attempts = await Promise.all([
        runSync(connector([record(62)]), config, { weekOffset: 0 }),
        runSync(connector([record(63)]), config),
      ]);
      expect(attempts.every((result) => !result.success)).toBe(true);
      const runs = await db
        .select()
        .from(syncRuns)
        .where(
          inArray(
            syncRuns.id,
            attempts.map((r) => r.syncRunId)
          )
        );
      expect(runs.every((run) => run.status === "skipped")).toBe(true);
    } finally {
      release();
      expect((await running).success).toBe(true);
    }
  });

  it("reclaims expired work and prevents its old owner from publishing", async () => {
    let release!: () => void;
    let started!: (runId: string) => void;
    const fetching = new Promise<string>((resolve) => {
      started = resolve;
    });
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const slow = connector([record(71)]);
    slow.fetchRecords = async (_config, ctx) => {
      started(ctx.syncRunId);
      await barrier;
      return { records: [record(71)], cursor: null, hasMore: false };
    };
    const running = runSync(slow, config);
    const oldRunId = await fetching;
    try {
      await db.execute(
        sql`update ${syncRuns} set metadata_json = jsonb_set(metadata_json, '{leaseExpiresAt}', to_jsonb(clock_timestamp() - interval '1 second')) where id = ${oldRunId}`
      );
      expect((await runSync(connector([record(72)]), config)).success).toBe(true);
      const before = await values();
      release();
      expect((await running).success).toBe(false);
      expect(await values()).toEqual(before);
      const errors = await db.select().from(syncErrors).where(eq(syncErrors.syncRunId, oldRunId));
      expect(errors.some((error) => error.errorType === "lease_expired")).toBe(true);
    } finally {
      release();
      await running;
    }
  });

  it("replaces a legacy CSAT snapshot through the real normalizer, retains revisions and retracts to null", async () => {
    const scoreId = randomUUID(),
      responseId = randomUUID();
    await db.insert(metricDefinitions).values([
      {
        id: scoreId,
        organizationId: org,
        key: "csat_score",
        name: "Synthetic score",
        sourceStrategy: "test",
        calculationType: "average",
        version: 1,
      },
      {
        id: responseId,
        organizationId: org,
        key: "csat_response_rate",
        name: "Synthetic response",
        sourceStrategy: "test",
        calculationType: "sum",
        version: 1,
      },
    ]);
    const snapshot: Awaited<ReturnType<typeof fetchSolvedCsatCandidate>> = {
      tickets: (["good", "bad", "bad", "offered"] as const).map((score, i) => ({
        id: i + 1,
        assignee_id: 7,
        group_id: 20,
        brand_id: 30,
        satisfaction_rating: { score },
      })),
      metrics: [1, 2, 3, 4].map((ticket_id) => ({ ticket_id, solved_at: "2026-07-07T12:00:00Z" })),
      coverage: {
        complete: true,
        population: "all-solved-satisfaction-states",
        requests: 2,
        query: "synthetic",
        observationStartedAt: "2026-07-12T07:00:00Z",
        observationEndedAt: "2026-07-12T07:00:01Z",
        timeZone: "America/Chicago",
        periodStart: "2026-07-05",
        periodEnd: "2026-07-11",
        groupIds: [20],
        brandIds: [30],
        agentIds: [7],
      },
    };
    const identity = {
      agentId: 7,
      externalId: "agent",
      accountReference: "zendesk-account:synthetic",
      subdomain: "synthetic",
      employeeContext: { employeeId: employee, teamId: team },
    };
    const candidate = buildSolvedCsatRecord(snapshot, identity);
    const normalize = new ZendeskConnector();
    const publish = (record: IngestedRecord) => {
      const replay = connector([record]);
      replay.normalizeRecords = normalize.normalizeRecords.bind(normalize);
      return runSync(replay, config);
    };
    const read = () =>
      db
        .select()
        .from(metricValues)
        .where(inArray(metricValues.metricDefinitionId, [scoreId, responseId]));
    try {
      expect(
        (
          await publish({
            ...candidate,
            payload: { csatScore: 99 },
            sourceUpdatedAt: new Date("2026-07-12T06:00:00Z"),
          })
        ).success
      ).toBe(true);
      expect((await publish(candidate)).valuesWritten).toBe(2);
      const stored = await read();
      expect(stored.find((v) => v.metricDefinitionId === scoreId)).toMatchObject({
        numericValue: 100 / 3,
        calculationVersion: 2,
        provenanceJson: {
          sourceContract: SOLVED_CSAT_CONTRACT,
          reportingTimeZone: "America/Chicago",
        },
      });
      expect(stored.find((v) => v.metricDefinitionId === responseId)?.numericValue).toBe(75);
      expect((stored[0]!.provenanceJson as Record<string, unknown>).sourceScopeFingerprint).toMatch(
        /^[a-f0-9]{64}$/
      );
      const records = await db
        .select()
        .from(sourceRecords)
        .where(eq(sourceRecords.externalRecordId, candidate.externalRecordId));
      expect(records).toHaveLength(1);
      const retained = await db
        .select()
        .from(syncRevisions)
        .where(
          eq(syncRevisions.entityId, stored.find((v) => v.metricDefinitionId === scoreId)!.id)
        );
      expect(
        retained.some((r) => (r.snapshotJson as Record<string, unknown>).numeric_value === 99)
      ).toBe(true);
      expect((await publish(candidate)).valuesWritten).toBe(0);
      expect(
        (
          await publish({
            ...candidate,
            externalRecordId: `${candidate.externalRecordId}-unmapped`,
            employeeExternalId: "removed-identity",
          })
        ).success
      ).toBe(false);
      expect(await read()).toEqual(stored);
      // The actual publisher must supply the locked current team to the normalizer.
      // A real reassignment after collection rejects the entire corrected batch.
      await db.update(employees).set({ primaryTeamId: null }).where(eq(employees.id, employee));
      try {
        const movedSnapshot = {
          ...snapshot,
          coverage: {
            ...snapshot.coverage,
            observationStartedAt: "2026-07-12T07:30:00Z",
            observationEndedAt: "2026-07-12T07:30:01Z",
          },
        };
        expect((await publish(buildSolvedCsatRecord(movedSnapshot, identity))).success).toBe(false);
        expect(await read()).toEqual(stored);
      } finally {
        await db.update(employees).set({ primaryTeamId: team }).where(eq(employees.id, employee));
      }
      snapshot.tickets = [];
      snapshot.metrics = [];
      snapshot.coverage.observationStartedAt = "2026-07-12T08:00:00Z";
      snapshot.coverage.observationEndedAt = "2026-07-12T08:00:01Z";
      expect((await publish(buildSolvedCsatRecord(snapshot, identity))).valuesWritten).toBe(2);
      expect(
        (await read()).every((v) => v.numericValue === null && v.qualityStatus === "missing")
      ).toBe(true);
    } finally {
      await db
        .delete(metricValues)
        .where(inArray(metricValues.metricDefinitionId, [scoreId, responseId]));
      await db
        .delete(metricDefinitions)
        .where(inArray(metricDefinitions.id, [scoreId, responseId]));
    }
  });
  it("publishes first reply without replacing sibling facts, survives legacy refresh, and retains null corrections", async () => {
    const replyId = randomUUID(),
      backlogId = randomUUID();
    const start = "2026-07-19",
      end = "2026-07-25";
    await db.insert(metricDefinitions).values([
      {
        id: replyId,
        organizationId: org,
        key: "avg_response_time",
        name: "Response",
        sourceStrategy: "test",
        calculationType: "average",
      },
      {
        id: backlogId,
        organizationId: org,
        key: "backlog_count",
        name: "Backlog",
        sourceStrategy: "test",
        calculationType: "sum",
      },
    ]);
    const normalize = new ZendeskConnector();
    const publish = (records: IngestedRecord[]) => {
      const c = connector(records);
      c.normalizeRecords = normalize.normalizeRecords.bind(normalize);
      return runSync(c, config);
    };
    const legacy: IngestedRecord = {
      ...record(0, start),
      externalRecordType: "agent_stats",
      externalRecordId: "stats-agent-" + start,
      periodEnd: end,
      payload: { ticketsResolved: 0, avgResponseTimeMinutes: 999, backlogCount: 12 },
    };
    const snapshot: Awaited<ReturnType<typeof fetchFirstReplyCandidate>> = {
      tickets: [1, 2, 3].map((id) => ({
        id,
        assignee_id: 7,
        group_id: 20,
        created_at: "2026-07-20T12:00:00Z",
      })),
      metrics: [0, 1, 1].map((business, i) => ({
        ticket_id: i + 1,
        reply_time_in_minutes: { business, calendar: business },
      })),
      coverage: {
        complete: true,
        population: "all-created-tickets",
        requests: 2,
        query: "synthetic",
        periodStart: start,
        periodEnd: end,
        timeZone: "America/Chicago",
        groupIds: [20],
        brandIds: null,
        agentIds: [7],
        observationStartedAt: "2026-07-25T12:00:00Z",
        observationEndedAt: "2026-07-25T12:00:01Z",
      },
    };
    const identity = {
      agentId: 7,
      externalId: "agent",
      accountReference: "zendesk-account:synthetic",
      subdomain: "synthetic",
      employeeContext: { employeeId: employee, teamId: team },
    };
    const read = () =>
      db
        .select()
        .from(metricValues)
        .where(inArray(metricValues.metricDefinitionId, [replyId, backlogId]));
    try {
      expect(
        (
          await publish([
            legacy,
            {
              ...legacy,
              externalRecordId: "stats-agent-2026-07-12",
              periodStart: "2026-07-12",
              periodEnd: "2026-07-18",
            },
          ])
        ).success
      ).toBe(true);
      const before = await read();
      const oldSources = await db
        .select()
        .from(sourceRecords)
        .where(eq(sourceRecords.externalRecordId, legacy.externalRecordId));
      const oldFacts = await db
        .select()
        .from(normalizedFacts)
        .where(eq(normalizedFacts.sourceRecordId, oldSources[0]!.id));
      const replacement = buildFirstReplyRecord(snapshot, identity);
      expect((await publish([replacement])).valuesWritten).toBe(1);
      const stored = await read();
      const current = stored.find(
        (v) => v.metricDefinitionId === replyId && v.periodStart === start
      )!;
      expect(current).toMatchObject({
        numericValue: 2 / 3,
        calculationVersion: 2,
        qualityStatus: "complete",
        provenanceJson: {
          sourceContract: FIRST_REPLY_CONTRACT,
          sampleCount: 3,
          cohortCount: 3,
          supersededFactIds: [oldFacts.find((f) => f.factType === "avg_response_time")!.id],
        },
      });
      expect(stored.filter((v) => v.id !== current.id)).toEqual(
        before.filter((v) => v.id !== current.id)
      );
      expect(
        await db
          .select()
          .from(sourceRecords)
          .where(eq(sourceRecords.externalRecordId, legacy.externalRecordId))
      ).toEqual(oldSources);
      expect(
        await db
          .select()
          .from(normalizedFacts)
          .where(eq(normalizedFacts.sourceRecordId, oldSources[0]!.id))
      ).toEqual(oldFacts);
      expect((await publish([replacement])).valuesWritten).toBe(0);
      expect(
        (
          await publish([
            {
              ...legacy,
              payload: { ...legacy.payload, avgResponseTimeMinutes: 888, backlogCount: 14 },
            },
          ])
        ).success
      ).toBe(true);
      const refreshed = await read();
      expect(refreshed.find((v) => v.id === current.id)).toMatchObject({
        numericValue: 2 / 3,
        dataFreshnessAt: current.dataFreshnessAt,
      });
      expect(
        refreshed.find((v) => v.metricDefinitionId === backlogId && v.periodStart === start)
          ?.numericValue
      ).toBe(14);
      await db.update(employees).set({ primaryTeamId: null }).where(eq(employees.id, employee));
      try {
        const moved = structuredClone(snapshot);
        moved.metrics[1]!.reply_time_in_minutes!.business = 5;
        expect((await publish([buildFirstReplyRecord(moved, identity)])).success).toBe(false);
        expect(await read()).toEqual(refreshed);
      } finally {
        await db.update(employees).set({ primaryTeamId: team }).where(eq(employees.id, employee));
      }
      snapshot.metrics.forEach((m) => {
        m.reply_time_in_minutes = null;
      });
      expect((await publish([buildFirstReplyRecord(snapshot, identity)])).valuesWritten).toBe(1);
      expect((await read()).find((v) => v.id === current.id)).toMatchObject({
        numericValue: null,
        qualityStatus: "missing",
        provenanceJson: { sampleCount: 0, cohortCount: 3 },
      });
      const retained = await db
        .select()
        .from(syncRevisions)
        .where(eq(syncRevisions.entityId, current.id));
      expect(
        retained.some((r) => (r.snapshotJson as Record<string, unknown>).numeric_value === 999)
      ).toBe(true);
      expect(
        retained.some((r) => (r.snapshotJson as Record<string, unknown>).numeric_value === 2 / 3)
      ).toBe(true);
    } finally {
      await db
        .delete(metricValues)
        .where(inArray(metricValues.metricDefinitionId, [replyId, backlogId]));
      await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, [replyId, backlogId]));
    }
  });
});
