// ingestRecords() takes its DB handle as a parameter (tx: TxOrDb) rather than
// importing `db` directly, so unlike compute-values.test.ts this doesn't need
// to mock the @/lib/db module — a plain mock object standing in for `tx` is
// enough. eq/and/inArray/sql from drizzle-orm are real (pure, no I/O), so
// they're left unmocked; only the mock tx's own methods matter to these
// tests.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ingestRecords } from "@/lib/connectors/sync-engine";
import type { IngestedRecord } from "@/lib/connectors/types";

const DATA_SOURCE_ID = "50000000-0000-4000-8000-000000000001";
const SYNC_RUN_ID = "70000000-0000-4000-8000-000000000001";

function record(overrides: Partial<IngestedRecord> = {}): IngestedRecord {
  return {
    externalRecordType: "ticket_stats",
    externalRecordId: "stats-agent@example.com-2026-09-07",
    employeeExternalId: "agent@example.com",
    occurredAt: new Date("2026-09-07T00:00:00Z"),
    periodStart: "2026-09-07",
    periodEnd: "2026-09-13",
    payload: { ticketsResolved: 5 },
    sourceUpdatedAt: new Date("2026-09-07T00:00:00Z"),
    ...overrides,
  };
}

/**
 * Builds a mock `tx` implementing exactly the chain shapes ingestRecords()
 * calls, in the order it calls them:
 *   1..N. select (existing sourceRecords, one call per externalRecordType chunk)
 *   N+1..M. select (externalIdentities, one call per id chunk)
 *   then insert(...).values(...).onConflictDoUpdate(...) per write chunk.
 */
function mockTx(options: {
  existingRows?: Array<{ id: string; externalRecordId: string; payloadHash: string }>;
  identityRows?: Array<{ externalId: string; employeeId: string }>;
  onInsertChunk?: (values: unknown) => void | never;
}) {
  const existingRows = options.existingRows ?? [];
  const identityRows = options.identityRows ?? [];
  let selectCall = 0;

  return {
    select: vi.fn(() => ({
      from: () => ({
        where: () => {
          selectCall++;
          // First select() call is always the source_records existence
          // check; the second (if any) is the external_identities lookup.
          return Promise.resolve(selectCall === 1 ? existingRows : identityRows);
        },
      }),
    })),
    insert: vi.fn(() => ({
      values: (values: unknown) => ({
        onConflictDoUpdate: () => {
          options.onInsertChunk?.(values);
          return Promise.resolve();
        },
      }),
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("ingestRecords", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ingests a brand-new record and a record with a changed payload hash", async () => {
    const newRecord = record({ externalRecordId: "stats-a@example.com-2026-09-07" });
    const changedRecord = record({ externalRecordId: "stats-b@example.com-2026-09-07" });

    // changedRecord has an existing row on file, but with a stored hash that
    // won't match its current payload's real sha256 — it must still write.
    const tx = mockTx({
      existingRows: [
        { id: "id-b", externalRecordId: changedRecord.externalRecordId, payloadHash: "stale-hash" },
      ],
    });

    const insertedBatches: unknown[][] = [];
    tx.insert = vi.fn(() => ({
      values: (values: unknown[]) => ({
        onConflictDoUpdate: () => {
          insertedBatches.push(values);
          return Promise.resolve();
        },
      }),
    }));

    const result = await ingestRecords(tx, [newRecord, changedRecord], DATA_SOURCE_ID, SYNC_RUN_ID);

    expect(result.ingested).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(insertedBatches).toHaveLength(1);
    expect(insertedBatches[0]).toHaveLength(2);
  });

  it("skips a record whose stored hash matches its current payload", async () => {
    const { createHash } = await import("crypto");
    const payload = { ticketsResolved: 9 };
    const matchingHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    const unchangedRecord = record({
      externalRecordId: "stats-c@example.com-2026-09-07",
      payload,
    });

    const tx = mockTx({
      existingRows: [
        {
          id: "id-c",
          externalRecordId: unchangedRecord.externalRecordId,
          payloadHash: matchingHash,
        },
      ],
    });

    const result = await ingestRecords(tx, [unchangedRecord], DATA_SOURCE_ID, SYNC_RUN_ID);

    expect(result.skipped).toBe(1);
    expect(result.ingested).toBe(0);
  });

  it("falls back to one-by-one processing when a bulk chunk upsert fails, isolating the bad row", async () => {
    const good1 = record({ externalRecordId: "stats-a@example.com-2026-09-07" });
    const badRecord = record({ externalRecordId: "stats-bad@example.com-2026-09-07" });
    const good2 = record({ externalRecordId: "stats-b@example.com-2026-09-07" });

    const tx = mockTx({ existingRows: [] });

    let bulkAttempted = false;
    tx.insert = vi.fn(() => ({
      values: (values: unknown) => ({
        onConflictDoUpdate: () => {
          if (Array.isArray(values)) {
            // Simulate the whole chunk's bulk upsert failing.
            bulkAttempted = true;
            throw new Error("simulated constraint violation");
          }
          // One-by-one fallback path: reject only the row matching badRecord.
          const row = values as { externalRecordId: string };
          if (row.externalRecordId === badRecord.externalRecordId) {
            throw new Error("bad row rejected");
          }
          return Promise.resolve();
        },
      }),
    }));

    const result = await ingestRecords(tx, [good1, badRecord, good2], DATA_SOURCE_ID, SYNC_RUN_ID);

    expect(bulkAttempted).toBe(true);
    expect(result.ingested).toBe(2);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.externalRecordId).toBe(badRecord.externalRecordId);
  });
});
