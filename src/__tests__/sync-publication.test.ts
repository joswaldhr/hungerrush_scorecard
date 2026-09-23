import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
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

const org = randomUUID(),
  employee = randomUUID(),
  source = randomUUID(),
  metric = randomUUID();
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
        dimensionsJson: null,
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
    .insert(employees)
    .values({ id: employee, organizationId: org, displayName: "Test employee" });
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
  await db.delete(organizations).where(eq(organizations.id, org));
});
describe.sequential("atomic metric publication (PostgreSQL)", () => {
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
      const older = runSync(slow, config);
      await fetching;
      try {
        expect((await runSync(connector([record(unchanged ? 41 : 52)]), config)).success).toBe(
          true
        );
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
    const older = runSync(slow, config);
    await fetching;
    try {
      expect((await runSync(connector([record(51)]), config)).success).toBe(true);
      release();
      expect((await older).success).toBe(true);
      expect((await values()).find((v) => v.periodStart === "2026-09-13")?.numericValue).toBe(17);
    } finally {
      release();
      await older;
    }
  });
});
