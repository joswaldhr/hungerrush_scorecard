import { db } from "@/lib/db";
import {
  dataSources,
  syncRuns,
  syncErrors,
  sourceRecords,
  normalizedFacts,
  externalIdentities,
} from "@/lib/db/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { createHash } from "crypto";
import type { Connector, ConnectorConfig, SyncContext, IngestedRecord } from "./types";
import { captureSyncRevisions } from "./sync-revisions";
import { createLeasedSyncRun, renewSyncLease } from "./sync-lease";
import { logger } from "@/lib/logger";
import { safeErrorMessage } from "@/lib/error-summary";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";
import { chunk } from "@/lib/utils";

function payloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

// Rows per bulk INSERT/upsert statement. Keeps parameter counts well under
// Postgres's 65,535-per-statement limit for these tables (~12-14 columns
// each), while turning thousands of sequential round-trips into a handful.
const WRITE_CHUNK_SIZE = 500;

export interface SyncOptions {
  maxPages?: number;
  // Explicit replay for reviewed corrections.
  reprocessUnchanged?: boolean;
  // When set, sync exactly this one week (0 = current week, per the
  // connector's weekOf() convention) instead of sweeping MAX_WEEKS_BACK
  // weeks in one invocation. Added so a caller (the cron route) can split
  // one sync into several smaller invocations, each safely under Vercel's
  // function duration limit — a full 4-week sweep's fetch phase alone
  // measured ~14 minutes against the real Zendesk account, well over the
  // confirmed 300s limit.
  weekOffset?: number;
}

/**
 * Sync architecture: fetch-then-publish.
 *
 * FETCH PHASE — all network I/O completes first, collecting records in memory.
 * No DB writes happen during this phase (except creating the sync run row).
 *
 * PUBLISH PHASE — runs inside a single short DB transaction:
 *   ingest (upsert source records) → normalize (upsert facts) → checkpoint cursor.
 * If anything fails, the transaction rolls back: no partial data visible,
 * cursor not advanced, previous values remain intact.
 *
 * Incremental semantics: the Zendesk connector uses the Search API with a
 * bounded-window refresh (week-offset cursor, MAX_WEEKS_BACK=4). This is NOT
 * a true incremental export — it re-fetches each week's data on every sync.
 * The source record hash-dedup prevents redundant writes when data hasn't changed.
 */
export async function runSync(
  connector: Connector,
  config: ConnectorConfig,
  options: SyncOptions = {}
): Promise<{ syncRunId: string; success: boolean; valuesWritten: number }> {
  const singleWeek = options.weekOffset !== undefined;
  const maxPages = singleWeek ? 1 : (options.maxPages ?? 10);

  const [source] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, config.dataSourceId));
  if (!source) throw new Error(`DataSource ${config.dataSourceId} not found`);

  if (source.organizationId !== config.organizationId)
    throw new Error("Data source organization mismatch");

  const run = await createLeasedSyncRun(config.dataSourceId, options.weekOffset);
  if (run.status === "skipped") return { syncRunId: run.id, success: false, valuesWritten: 0 };

  const syncRunId = run.id;
  let success = true;

  // ── FETCH PHASE ──────────────────────────────────────────────
  // All network I/O happens here. No DB transaction is open.
  const allFetchedRecords: IngestedRecord[] = [];
  const fetchErrors: Array<{ message: string }> = [];
  let finalCursor: string | null = null;
  let fetchDiagnostics: Record<string, unknown> | undefined;
  const fetchStartedAt = Date.now();

  try {
    let cursor: string | null = singleWeek ? String(options.weekOffset) : null;
    for (let page = 0; page < maxPages; page++) {
      const ctx: SyncContext = {
        syncRunId,
        dataSourceId: config.dataSourceId,
        organizationId: config.organizationId,
        cursor,
      };

      const fetchResult = await connector.fetchRecords(config, ctx);
      await renewSyncLease(syncRunId);
      allFetchedRecords.push(...fetchResult.records);

      cursor = fetchResult.cursor;
      finalCursor = cursor;
      if (fetchResult.diagnostics) fetchDiagnostics = fetchResult.diagnostics;
      if (!fetchResult.hasMore) break;
      if (!singleWeek && page === maxPages - 1)
        throw new Error("Sync page limit reached before completion");
    }
  } catch (err) {
    success = false;
    fetchErrors.push({ message: safeErrorMessage(err) });
    logger.error("Sync fetch phase failed", { syncRunId, error: err });
  }

  const fetchMs = Date.now() - fetchStartedAt;

  // ── PUBLISH PHASE ────────────────────────────────────────────
  // Short DB transaction: ingest → normalize → checkpoint.
  // If this fails, everything rolls back.
  let valuesWritten = 0;
  let computeValuesMs = 0;
  let totalIngested = 0;
  let totalNormalized = 0;
  let totalSkipped = 0;
  let totalErrors = fetchErrors.length;
  const publishStartedAt = Date.now();

  const publicationKeys = allFetchedRecords.map((record) => ({
    record_type: record.externalRecordType,
    record_id: record.externalRecordId,
  }));
  if (success) {
    try {
      await db.transaction(async (tx) => {
        // Serialize publication for this source so revision snapshots describe
        // the committed predecessor even when fetches overlap.
        await tx.execute(
          sql`select id from ${dataSources} where id = ${config.dataSourceId} for update`
        );
        await renewSyncLease(syncRunId, tx);
        // The publication lock alone does not order overlapping network fetches.
        // Reject an older observation if a later-started run already published
        // any of the same source records. Disjoint weeks can still publish.
        if (allFetchedRecords.length) {
          const superseded = await tx.execute(sql`
            select 1 from ${syncRuns} published
            cross join lateral jsonb_to_recordset(
              coalesce(published.metadata_json->'publicationKeys', '[]'::jsonb)
            ) as observed(record_type text, record_id text)
            join jsonb_to_recordset(${JSON.stringify(publicationKeys)}::jsonb)
              as incoming(record_type text, record_id text)
              on incoming.record_type = observed.record_type
              and incoming.record_id = observed.record_id
            where published.data_source_id = ${config.dataSourceId}
              and published.status = 'completed'
              and published.started_at >= (
                select started_at from ${syncRuns} where id = ${syncRunId}
              )
              and published.id <> ${syncRunId}
            limit 1
          `);
          if (superseded.length) {
            throw new Error("Sync superseded by a newer publication for the same source records");
          }
        }
        const { ingested, skipped, errors } = await ingestRecords(
          tx,
          allFetchedRecords,
          config.dataSourceId,
          syncRunId,
          options.reprocessUnchanged ?? false
        );
        totalIngested = ingested;
        totalSkipped = skipped;

        if (errors.length) throw new Error(`Ingestion rejected ${errors.length} records`);
        totalNormalized = await normalizeIngestedRecords(tx, connector, config, syncRunId);
        const computeStartedAt = Date.now();
        valuesWritten = await computeMetricValuesFromFacts(config.organizationId, source.type, {
          connection: tx,
          dataSourceId: config.dataSourceId,
          syncRunId,
        });
        computeValuesMs = Date.now() - computeStartedAt;
        await tx
          .update(syncRuns)
          .set({
            status: "completed",
            completedAt: new Date(),
            recordsIngested: totalIngested,
            recordsNormalized: totalNormalized,
            recordsSkipped: totalSkipped,
            errorCount: 0,
            cursor: finalCursor,
            metadataJson: {
              publicationKeys,
              fetchMs,
              publishMs: Date.now() - publishStartedAt,
              computeValuesMs,
              valuesWritten,
              weekOffset: options.weekOffset,
              fetch: fetchDiagnostics,
            },
          })
          .where(eq(syncRuns.id, syncRunId));
        await tx
          .update(dataSources)
          .set({ lastSuccessfulSyncAt: new Date() })
          .where(eq(dataSources.id, config.dataSourceId));
      });
    } catch (err) {
      success = false;
      valuesWritten = 0;
      totalIngested = 0;
      totalNormalized = 0;
      totalSkipped = 0;
      totalErrors++;
      logger.error("Sync publish phase failed (transaction rolled back)", {
        syncRunId,
        error: err,
      });
      await db.insert(syncErrors).values({
        syncRunId,
        errorType: "publish_fatal",
        message: safeErrorMessage(err),
        retryable: true,
      });
    }
  }

  // Record any fetch-phase errors outside the transaction
  for (const err of fetchErrors) {
    await db.insert(syncErrors).values({
      syncRunId,
      errorType: "fetch_fatal",
      message: err.message,
      retryable: true,
    });
  }

  if (!success) {
    await db
      .update(syncRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        errorCount: totalErrors,
        recordsIngested: 0,
        recordsNormalized: 0,
        recordsSkipped: 0,
        cursor: null,
        metadataJson: {
          fetchMs,
          publishMs: Date.now() - publishStartedAt,
          computeValuesMs,
          valuesWritten: 0,
          weekOffset: options.weekOffset,
          fetch: fetchDiagnostics,
        },
      })
      .where(eq(syncRuns.id, syncRunId));
  }
  return { syncRunId, success, valuesWritten };
}

type TxOrDb = typeof db;

type SourceRecordRow = typeof sourceRecords.$inferInsert;

// Exported for ingestion tests; publication wraps all writes in one transaction.
export async function ingestRecords(
  tx: TxOrDb,
  records: IngestedRecord[],
  dataSourceId: string,
  syncRunId: string,
  reprocessUnchanged = false
): Promise<{
  ingested: number;
  skipped: number;
  errors: Array<{ externalRecordId: string; message: string }>;
}> {
  const errors: Array<{ externalRecordId: string; message: string }> = [];

  // ── Bulk existence/hash check ────────────────────────────────
  // The real unique key is (dataSourceId, externalRecordType, externalRecordId)
  // — group by type (a small, bounded set) and do one IN() lookup per type
  // instead of one per record.
  const recordsByType = new Map<string, IngestedRecord[]>();
  for (const record of records) {
    const list = recordsByType.get(record.externalRecordType) ?? [];
    list.push(record);
    recordsByType.set(record.externalRecordType, list);
  }

  const existingByKey = new Map<string, { id: string; payloadHash: string }>();
  for (const [type, typeRecords] of recordsByType) {
    for (const idBatch of chunk(
      typeRecords.map((r) => r.externalRecordId),
      WRITE_CHUNK_SIZE
    )) {
      const existing = await tx
        .select({
          id: sourceRecords.id,
          externalRecordId: sourceRecords.externalRecordId,
          payloadHash: sourceRecords.payloadHash,
        })
        .from(sourceRecords)
        .where(
          and(
            eq(sourceRecords.dataSourceId, dataSourceId),
            eq(sourceRecords.externalRecordType, type),
            inArray(sourceRecords.externalRecordId, idBatch)
          )
        );
      for (const row of existing) {
        existingByKey.set(`${type}:${row.externalRecordId}`, {
          id: row.id,
          payloadHash: row.payloadHash,
        });
      }
    }
  }

  // ── Skip vs. write set, exactly matching today's hash-dedup logic ────
  let skipped = 0;
  const toWrite: Array<{ record: IngestedRecord; hash: string }> = [];
  for (const record of records) {
    const hash = payloadHash(record.payload);
    const existing = existingByKey.get(`${record.externalRecordType}:${record.externalRecordId}`);
    if (!reprocessUnchanged && existing && existing.payloadHash === hash) {
      skipped++;
      continue;
    }
    toWrite.push({ record, hash });
  }

  // ── Bulk employee resolution ──────────────────────────────────
  // Only for records that will actually be written, matching today's
  // optimization of not resolving identities for skipped records.
  const externalIds = [
    ...new Set(
      toWrite
        .map(({ record }) => record.employeeExternalId)
        .filter((id): id is string => id !== null)
    ),
  ];
  const employeeIdByExternalId = new Map<string, string | null>();
  for (const idBatch of chunk(externalIds, WRITE_CHUNK_SIZE)) {
    const matches = await tx
      .select({
        externalId: externalIdentities.externalId,
        employeeId: externalIdentities.employeeId,
      })
      .from(externalIdentities)
      .where(
        and(
          eq(externalIdentities.dataSourceId, dataSourceId),
          inArray(externalIdentities.externalId, idBatch)
        )
      );
    for (const m of matches) employeeIdByExternalId.set(m.externalId, m.employeeId);
  }

  // ── Dedup the write set by (externalRecordType, externalRecordId),
  // last-write-wins. Not reachable for the current Zendesk connector (each
  // week-offset produces a distinct periodStart, so no duplicate key within
  // one run) — but ingestRecords is connector-agnostic, and a bulk upsert
  // throws if the same conflict target appears twice in one statement.
  // Cheap, permanent insurance.
  const dedupedRows = new Map<string, SourceRecordRow>();
  for (const { record, hash } of toWrite) {
    const employeeId = record.employeeExternalId
      ? (employeeIdByExternalId.get(record.employeeExternalId) ?? null)
      : null;
    dedupedRows.set(`${record.externalRecordType}:${record.externalRecordId}`, {
      dataSourceId,
      externalRecordType: record.externalRecordType,
      externalRecordId: record.externalRecordId,
      employeeId,
      occurredAt: record.occurredAt,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      payloadJson: record.payload,
      payloadHash: hash,
      sourceUpdatedAt: record.sourceUpdatedAt,
      ingestedAt: new Date(),
      syncRunId,
    });
  }
  const rows = [...dedupedRows.values()];

  // Any rejected row aborts publication; PostgreSQL cannot retry an aborted transaction.
  let ingested = 0;
  const conflictTarget = [
    sourceRecords.dataSourceId,
    sourceRecords.externalRecordType,
    sourceRecords.externalRecordId,
  ];

  for (const batch of chunk(rows, WRITE_CHUNK_SIZE)) {
    const previousIds = batch.flatMap((row) => {
      const previous = existingByKey.get(`${row.externalRecordType}:${row.externalRecordId}`);
      return previous ? [previous.id] : [];
    });
    if (previousIds.length)
      await captureSyncRevisions(
        tx,
        "source_record",
        inArray(sourceRecords.id, previousIds),
        syncRunId
      );
    await tx
      .insert(sourceRecords)
      .values(batch)
      .onConflictDoUpdate({
        target: conflictTarget,
        set: {
          employeeId: sql`excluded.employee_id`,
          occurredAt: sql`excluded.occurred_at`,
          periodStart: sql`excluded.period_start`,
          periodEnd: sql`excluded.period_end`,
          payloadJson: sql`excluded.payload_json`,
          payloadHash: sql`excluded.payload_hash`,
          sourceUpdatedAt: sql`excluded.source_updated_at`,
          ingestedAt: sql`excluded.ingested_at`,
          syncRunId: sql`excluded.sync_run_id`,
        },
      });
    ingested += batch.length;
  }

  return { ingested, skipped, errors };
}

async function normalizeIngestedRecords(
  tx: TxOrDb,
  connector: Connector,
  config: ConnectorConfig,
  syncRunId: string
): Promise<number> {
  const records = await tx
    .select()
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, config.dataSourceId),
        eq(sourceRecords.syncRunId, syncRunId)
      )
    );

  const previousFacts: (typeof normalizedFacts.$inferSelect)[] = [];
  for (const batch of chunk(
    records.map((record) => record.id),
    WRITE_CHUNK_SIZE
  )) {
    const condition = inArray(normalizedFacts.sourceRecordId, batch);
    previousFacts.push(...(await tx.select().from(normalizedFacts).where(condition)));
    await captureSyncRevisions(tx, "normalized_fact", condition, syncRunId);
  }

  // Compute every fact in memory first (pure, no I/O) — the DB write is
  // batched below. Safe to batch arbitrarily: each source record has a
  // unique id and normalizeRecords() never returns the same factType twice
  // for one record, so no (sourceRecordId, factType) conflict target can
  // appear twice within a single INSERT statement.
  const rows: (typeof normalizedFacts.$inferInsert)[] = [];

  for (const record of records) {
    const previous = previousFacts.filter((fact) => fact.sourceRecordId === record.id);
    if (
      previous.some(
        (fact) =>
          fact.employeeId !== record.employeeId ||
          fact.periodStart !== record.periodStart ||
          fact.periodEnd !== record.periodEnd
      )
    ) {
      throw new Error("Source attribution changed; reviewed reassignment repair required");
    }
    if (!record.employeeId || !record.periodStart || !record.periodEnd) continue;

    const facts = connector.normalizeRecords(
      [{ sourceRecordId: record.id, payload: record.payloadJson as Record<string, unknown> }],
      record.employeeId,
      null,
      record.periodStart,
      record.periodEnd
    );

    const sourceObservedAt = record.sourceUpdatedAt ?? record.occurredAt ?? record.ingestedAt;

    // Retain a null tombstone for facts omitted by the corrected record.
    for (const old of previous) {
      if (!facts.some((fact) => fact.factType === old.factType))
        rows.push({
          ...old,
          numericValue: null,
          textValue: null,
          booleanValue: null,
          sourceObservedAt,
          dimensionsJson: { correction: "omitted_from_normalized_record", syncRunId },
        });
    }
    for (const fact of facts) {
      rows.push({
        organizationId: config.organizationId,
        employeeId: fact.employeeId,
        teamId: fact.teamId,
        factType: fact.factType,
        numericValue: fact.numericValue,
        textValue: fact.textValue,
        booleanValue: fact.booleanValue,
        unit: fact.unit,
        periodStart: fact.periodStart,
        periodEnd: fact.periodEnd,
        dataSourceId: config.dataSourceId,
        sourceRecordId: record.id,
        sourceObservedAt: sourceObservedAt,
        dimensionsJson: fact.dimensionsJson,
      });
    }
  }

  for (const batch of chunk(rows, WRITE_CHUNK_SIZE)) {
    await tx
      .insert(normalizedFacts)
      .values(batch)
      .onConflictDoUpdate({
        target: [normalizedFacts.sourceRecordId, normalizedFacts.factType],
        set: {
          numericValue: sql`excluded.numeric_value`,
          textValue: sql`excluded.text_value`,
          booleanValue: sql`excluded.boolean_value`,
          unit: sql`excluded.unit`,
          dimensionsJson: sql`excluded.dimensions_json`,
          sourceObservedAt: sql`excluded.source_observed_at`,
        },
      });
  }

  return rows.length;
}
