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
import { logger } from "@/lib/logger";
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
): Promise<{ syncRunId: string; success: boolean }> {
  const maxPages = options.maxPages ?? 10;

  const [source] = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.id, config.dataSourceId));
  if (!source) throw new Error(`DataSource ${config.dataSourceId} not found`);

  const [run] = await db
    .insert(syncRuns)
    .values({ dataSourceId: config.dataSourceId, status: "running" })
    .returning();
  if (!run) throw new Error("Failed to create sync run");

  const syncRunId = run.id;
  let success = true;

  // ── FETCH PHASE ──────────────────────────────────────────────
  // All network I/O happens here. No DB transaction is open.
  const allFetchedRecords: IngestedRecord[] = [];
  const fetchErrors: Array<{ message: string }> = [];
  let finalCursor: string | null = null;
  const fetchStartedAt = Date.now();

  try {
    let cursor: string | null = null;
    for (let page = 0; page < maxPages; page++) {
      const ctx: SyncContext = {
        syncRunId,
        dataSourceId: config.dataSourceId,
        organizationId: config.organizationId,
        cursor,
      };

      const fetchResult = await connector.fetchRecords(config, ctx);
      allFetchedRecords.push(...fetchResult.records);

      cursor = fetchResult.cursor;
      finalCursor = cursor;
      if (!fetchResult.hasMore) break;
    }
  } catch (err) {
    success = false;
    fetchErrors.push({ message: err instanceof Error ? err.message : String(err) });
    logger.error("Sync fetch phase failed", { syncRunId, error: err });
  }

  const fetchMs = Date.now() - fetchStartedAt;

  // ── PUBLISH PHASE ────────────────────────────────────────────
  // Short DB transaction: ingest → normalize → checkpoint.
  // If this fails, everything rolls back.
  let totalIngested = 0;
  let totalNormalized = 0;
  let totalSkipped = 0;
  let totalErrors = fetchErrors.length;
  const publishStartedAt = Date.now();

  if (success && allFetchedRecords.length > 0) {
    try {
      await db.transaction(async (tx) => {
        const { ingested, skipped, errors } = await ingestRecords(
          tx,
          allFetchedRecords,
          config.dataSourceId,
          syncRunId
        );
        totalIngested = ingested;
        totalSkipped = skipped;

        for (const err of errors) {
          totalErrors++;
          await tx.insert(syncErrors).values({
            syncRunId,
            errorType: "ingest",
            message: err.message,
            externalRecordId: err.externalRecordId,
            retryable: true,
          });
        }

        totalNormalized = await normalizeIngestedRecords(tx, connector, config, syncRunId);
      });
    } catch (err) {
      success = false;
      totalErrors++;
      logger.error("Sync publish phase failed (transaction rolled back)", {
        syncRunId,
        error: err,
      });
      await db.insert(syncErrors).values({
        syncRunId,
        errorType: "publish_fatal",
        message: err instanceof Error ? err.message : String(err),
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

  const publishMs = Date.now() - publishStartedAt;

  // ── CHECKPOINT ───────────────────────────────────────────────
  // Cursor advances only after a successful publish.
  await db
    .update(syncRuns)
    .set({
      status: success ? "completed" : "failed",
      completedAt: new Date(),
      recordsIngested: totalIngested,
      recordsNormalized: totalNormalized,
      recordsSkipped: totalSkipped,
      errorCount: totalErrors,
      cursor: success ? finalCursor : null,
      // Timing breakdown, added to isolate network-fetch time (untouched by
      // the write-batching work) from DB-write time (what batching targets)
      // — see FOLLOWUPS.md item 5. Nothing reads this yet besides humans
      // querying it directly.
      metadataJson: { fetchMs, publishMs },
    })
    .where(eq(syncRuns.id, syncRunId));

  if (success) {
    await db
      .update(dataSources)
      .set({ lastSuccessfulSyncAt: new Date() })
      .where(eq(dataSources.id, config.dataSourceId));
  }

  return { syncRunId, success };
}

// computeMetricValuesFromFacts() runs as a separate step after runSync()
// resolves (both route handlers call it that way) — this merges its timing
// into the same sync_runs row's metadataJson rather than threading a whole
// extra return value through the route handlers just for one number.
export async function recordComputeValuesTiming(
  syncRunId: string,
  computeValuesMs: number
): Promise<void> {
  await db
    .update(syncRuns)
    .set({
      metadataJson: sql`coalesce(${syncRuns.metadataJson}, '{}'::jsonb) || ${JSON.stringify({ computeValuesMs })}::jsonb`,
    })
    .where(eq(syncRuns.id, syncRunId));
}

type TxOrDb = typeof db;

// A single row shape shared by the bulk write path and the per-record
// fallback below, matching sourceRecords' actual insert/update columns.
type SourceRecordRow = typeof sourceRecords.$inferInsert;

// Exported for direct unit testing (sync-engine.test.ts) — sync-engine.ts
// otherwise has zero test coverage today, and ingestRecords is the one
// function here with real logic (skip-set computation, dedup, a
// chunk-failure fallback) worth testing directly rather than only through
// the full runSync() orchestration.
export async function ingestRecords(
  tx: TxOrDb,
  records: IngestedRecord[],
  dataSourceId: string,
  syncRunId: string
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
    if (existing && existing.payloadHash === hash) {
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

  // ── Bulk upsert, falling back to one-by-one on a chunk failure ────────
  // A whole chunk failing because of one bad row would otherwise abort the
  // entire sync (not just that record) — the fallback preserves the
  // per-record error isolation the rest of this pipeline relies on. In
  // production history this fallback has never been exercised
  // (sync_errors has had zero rows, ever), but the isolation contract
  // shouldn't silently regress.
  let ingested = 0;
  const conflictTarget = [
    sourceRecords.dataSourceId,
    sourceRecords.externalRecordType,
    sourceRecords.externalRecordId,
  ];

  for (const batch of chunk(rows, WRITE_CHUNK_SIZE)) {
    try {
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
    } catch (err) {
      logger.warn("Bulk source_records upsert failed for a chunk, falling back to one-by-one", {
        syncRunId,
        chunkSize: batch.length,
        error: err instanceof Error ? err.message : String(err),
      });
      for (const row of batch) {
        try {
          await tx
            .insert(sourceRecords)
            .values(row)
            .onConflictDoUpdate({
              target: conflictTarget,
              set: {
                employeeId: row.employeeId,
                occurredAt: row.occurredAt,
                periodStart: row.periodStart,
                periodEnd: row.periodEnd,
                payloadJson: row.payloadJson,
                payloadHash: row.payloadHash,
                sourceUpdatedAt: row.sourceUpdatedAt,
                ingestedAt: row.ingestedAt,
                syncRunId: row.syncRunId,
              },
            });
          ingested++;
        } catch (rowErr) {
          errors.push({
            externalRecordId: row.externalRecordId,
            message: rowErr instanceof Error ? rowErr.message : String(rowErr),
          });
        }
      }
    }
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

  // Compute every fact in memory first (pure, no I/O) — the DB write is
  // batched below. Safe to batch arbitrarily: each source record has a
  // unique id and normalizeRecords() never returns the same factType twice
  // for one record, so no (sourceRecordId, factType) conflict target can
  // appear twice within a single INSERT statement.
  const rows: (typeof normalizedFacts.$inferInsert)[] = [];

  for (const record of records) {
    if (!record.employeeId || !record.periodStart || !record.periodEnd) continue;

    const facts = connector.normalizeRecords(
      [{ sourceRecordId: record.id, payload: record.payloadJson as Record<string, unknown> }],
      record.employeeId,
      null,
      record.periodStart,
      record.periodEnd
    );

    const sourceObservedAt = record.sourceUpdatedAt ?? record.occurredAt ?? record.ingestedAt;

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
          sourceObservedAt: sql`excluded.source_observed_at`,
        },
      });
  }

  return rows.length;
}
