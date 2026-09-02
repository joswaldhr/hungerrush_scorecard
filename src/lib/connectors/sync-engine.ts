import { db } from "@/lib/db";
import {
  dataSources,
  syncRuns,
  syncErrors,
  sourceRecords,
  normalizedFacts,
  externalIdentities,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { createHash } from "crypto";
import type { Connector, ConnectorConfig, SyncContext, IngestedRecord } from "./types";
import { logger } from "@/lib/logger";

function payloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export interface SyncOptions {
  maxPages?: number;
}

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
  let totalIngested = 0;
  let totalNormalized = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let cursor: string | null = null;
  let success = true;

  try {
    for (let page = 0; page < maxPages; page++) {
      const ctx: SyncContext = {
        syncRunId,
        dataSourceId: config.dataSourceId,
        organizationId: config.organizationId,
        cursor,
      };

      const fetchResult = await connector.fetchRecords(config, ctx);

      const { ingested, skipped, errors } = await ingestRecords(
        fetchResult.records,
        config.dataSourceId,
        syncRunId
      );
      totalIngested += ingested;
      totalSkipped += skipped;

      for (const err of errors) {
        totalErrors++;
        await db.insert(syncErrors).values({
          syncRunId,
          errorType: "ingest",
          message: err.message,
          externalRecordId: err.externalRecordId,
          retryable: true,
        });
      }

      const normalized = await normalizeIngestedRecords(connector, config, syncRunId);
      totalNormalized += normalized;

      cursor = fetchResult.cursor;
      if (!fetchResult.hasMore) break;
    }
  } catch (err) {
    success = false;
    totalErrors++;
    await db.insert(syncErrors).values({
      syncRunId,
      errorType: "sync_fatal",
      message: err instanceof Error ? err.message : String(err),
      retryable: true,
    });
    logger.error("Sync failed", { syncRunId, error: err });
  }

  await db
    .update(syncRuns)
    .set({
      status: success ? "completed" : "failed",
      completedAt: new Date(),
      recordsIngested: totalIngested,
      recordsNormalized: totalNormalized,
      recordsSkipped: totalSkipped,
      errorCount: totalErrors,
      cursor,
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

async function ingestRecords(
  records: IngestedRecord[],
  dataSourceId: string,
  syncRunId: string
): Promise<{
  ingested: number;
  skipped: number;
  errors: Array<{ externalRecordId: string; message: string }>;
}> {
  let ingested = 0;
  let skipped = 0;
  const errors: Array<{ externalRecordId: string; message: string }> = [];

  for (const record of records) {
    try {
      const hash = payloadHash(record.payload);

      const existing = await db
        .select({ id: sourceRecords.id, payloadHash: sourceRecords.payloadHash })
        .from(sourceRecords)
        .where(
          and(
            eq(sourceRecords.dataSourceId, dataSourceId),
            eq(sourceRecords.externalRecordType, record.externalRecordType),
            eq(sourceRecords.externalRecordId, record.externalRecordId)
          )
        )
        .then((r) => r[0]);

      if (existing && existing.payloadHash === hash) {
        skipped++;
        continue;
      }

      const employeeId = record.employeeExternalId
        ? await resolveEmployeeId(dataSourceId, record.employeeExternalId)
        : null;

      if (existing) {
        await db
          .update(sourceRecords)
          .set({
            employeeId,
            occurredAt: record.occurredAt,
            periodStart: record.periodStart,
            periodEnd: record.periodEnd,
            payloadJson: record.payload,
            payloadHash: hash,
            sourceUpdatedAt: record.sourceUpdatedAt,
            ingestedAt: new Date(),
            syncRunId,
          })
          .where(eq(sourceRecords.id, existing.id));
      } else {
        await db.insert(sourceRecords).values({
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
          syncRunId,
        });
      }

      ingested++;
    } catch (err) {
      errors.push({
        externalRecordId: record.externalRecordId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { ingested, skipped, errors };
}

async function resolveEmployeeId(dataSourceId: string, externalId: string): Promise<string | null> {
  const match = await db
    .select({ employeeId: externalIdentities.employeeId })
    .from(externalIdentities)
    .where(
      and(
        eq(externalIdentities.dataSourceId, dataSourceId),
        eq(externalIdentities.externalId, externalId)
      )
    )
    .then((r) => r[0]);

  return match?.employeeId ?? null;
}

async function normalizeIngestedRecords(
  connector: Connector,
  config: ConnectorConfig,
  syncRunId: string
): Promise<number> {
  const records = await db
    .select()
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, config.dataSourceId),
        eq(sourceRecords.syncRunId, syncRunId)
      )
    );

  let normalized = 0;

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
      await db
        .insert(normalizedFacts)
        .values({
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
        })
        .onConflictDoUpdate({
          target: [normalizedFacts.sourceRecordId, normalizedFacts.factType],
          set: {
            numericValue: fact.numericValue,
            textValue: fact.textValue,
            booleanValue: fact.booleanValue,
            unit: fact.unit,
            sourceObservedAt: sourceObservedAt,
          },
        });
      normalized++;
    }
  }

  return normalized;
}
