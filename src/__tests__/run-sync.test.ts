// Tests for the runSync orchestration flow (sync-engine.ts).
// This covers the fetch→publish→checkpoint sequence, error handling, and
// weekOffset behavior — the untested orchestration path CLAUDE.md flags.
//
// Mocking strategy: same as compute-values.test.ts — vi.mock the db module,
// provide a mock connector, and assert the right DB calls happen in order.
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Connector, ConnectorConfig, SyncContext, IngestedRecord } from "@/lib/connectors/types";

const SYNC_RUN_ID = "70000000-0000-4000-8000-000000000001";
const DATA_SOURCE_ID = "50000000-0000-4000-8000-000000000001";
const ORG_ID = "10000000-0000-4000-8000-000000000001";

const config: ConnectorConfig = {
  dataSourceId: DATA_SOURCE_ID,
  organizationId: ORG_ID,
};

// ── DB mock ──────────────────────────────────────────────────
// runSync's DB access pattern (in order):
//   1. select from dataSources (find the source)
//   2. insert into syncRuns (create run row), returns { id }
//   3. db.transaction(cb) — calls cb(tx), where tx is used for ingest+normalize
//   4. insert into syncErrors (if errors)
//   5. update syncRuns (checkpoint)
//   6. update dataSources (lastSuccessfulSyncAt, on success only)

let selectResults: unknown[];
let insertReturning: unknown[];
let transactionFn: ((tx: unknown) => Promise<void>) | null;
let insertedSyncErrors: unknown[];
let updatedSyncRuns: unknown[];
let updatedDataSources: boolean;

const mockDb = vi.hoisted(() => {
  const dbProxy: Record<string, unknown> = {};
  return dbProxy;
});

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/db/schema", () => ({
  dataSources: { id: "dataSources.id" },
  syncRuns: { id: "syncRuns.id", dataSourceId: "syncRuns.dataSourceId" },
  syncErrors: {},
  sourceRecords: {
    dataSourceId: "sr.dataSourceId",
    externalRecordType: "sr.externalRecordType",
    externalRecordId: "sr.externalRecordId",
  },
  normalizedFacts: { sourceRecordId: "nf.sourceRecordId", factType: "nf.factType" },
  externalIdentities: { dataSourceId: "ei.dataSourceId", externalId: "ei.externalId" },
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(() => "sql-tag"),
  inArray: vi.fn(),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { runSync } from "@/lib/connectors/sync-engine";

function setupDbMock() {
  selectResults = [];
  insertReturning = [];
  transactionFn = null;
  insertedSyncErrors = [];
  updatedSyncRuns = [];
  updatedDataSources = false;

  let selectCallIndex = 0;
  let insertCallIndex = 0;

  mockDb.select = vi.fn(() => ({
    from: () => ({
      where: () => {
        const result = selectResults[selectCallIndex] ?? [];
        selectCallIndex++;
        return Promise.resolve(result);
      },
    }),
  }));

  mockDb.insert = vi.fn((table: { id?: string }) => {
    // syncRuns insert (has .returning())
    if (table?.id === "syncRuns.id") {
      return {
        values: () => ({
          returning: () => {
            const result = insertReturning[insertCallIndex] ?? [];
            insertCallIndex++;
            return Promise.resolve(result);
          },
        }),
      };
    }
    // syncErrors insert
    return {
      values: (vals: unknown) => {
        insertedSyncErrors.push(vals);
        return Promise.resolve();
      },
    };
  });

  mockDb.transaction = vi.fn(async (cb: (tx: unknown) => Promise<void>) => {
    // Provide a minimal mock tx for ingestRecords/normalizeIngestedRecords
    const mockTx = {
      select: vi.fn(() => ({
        from: () => ({
          where: () => Promise.resolve([]),
        }),
      })),
      insert: vi.fn(() => ({
        values: () => ({
          onConflictDoUpdate: () => Promise.resolve(),
        }),
      })),
    };
    transactionFn = cb;
    await cb(mockTx);
  });

  mockDb.update = vi.fn((table: { id?: string }) => ({
    set: (vals: unknown) => ({
      where: () => {
        if (table?.id === "syncRuns.id") {
          updatedSyncRuns.push(vals);
        } else {
          updatedDataSources = true;
        }
        return Promise.resolve();
      },
    }),
  }));
}

function makeConnector(overrides: Partial<Connector> = {}): Connector {
  return {
    sourceType: "test",
    healthCheck: vi.fn(),
    fetchRecords: vi.fn(async () => ({
      records: [],
      cursor: null,
      hasMore: false,
    })),
    normalizeRecords: vi.fn(() => []),
    resolveIdentities: vi.fn(async () => []),
    discoverRoster: vi.fn(async () => []),
    ...overrides,
  };
}

function makeRecord(id: string): IngestedRecord {
  return {
    externalRecordType: "ticket_stats",
    externalRecordId: `stats-${id}`,
    employeeExternalId: `${id}@example.com`,
    occurredAt: new Date("2026-09-07T00:00:00Z"),
    periodStart: "2026-09-07",
    periodEnd: "2026-09-13",
    payload: { ticketsResolved: 5 },
    sourceUpdatedAt: new Date("2026-09-07T00:00:00Z"),
  };
}

describe("runSync orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbMock();
  });

  it("completes successfully with records from the connector", async () => {
    selectResults = [
      [{ id: DATA_SOURCE_ID }], // dataSources lookup
    ];
    insertReturning = [
      [{ id: SYNC_RUN_ID }], // syncRuns insert
    ];

    const connector = makeConnector({
      fetchRecords: vi.fn(async () => ({
        records: [makeRecord("alice")],
        cursor: "week-0",
        hasMore: false,
      })),
    });

    const result = await runSync(connector, config);

    expect(result.success).toBe(true);
    expect(result.syncRunId).toBe(SYNC_RUN_ID);
    expect(mockDb.transaction).toHaveBeenCalledOnce();
    // Checkpoint updates sync_runs with completed status
    expect(updatedSyncRuns).toHaveLength(1);
    expect((updatedSyncRuns[0] as Record<string, unknown>).status).toBe("completed");
    // Updates dataSources.lastSuccessfulSyncAt
    expect(updatedDataSources).toBe(true);
  });

  it("marks run as failed when fetch phase throws", async () => {
    selectResults = [
      [{ id: DATA_SOURCE_ID }],
    ];
    insertReturning = [
      [{ id: SYNC_RUN_ID }],
    ];

    const connector = makeConnector({
      fetchRecords: vi.fn(async () => {
        throw new Error("Zendesk API timeout");
      }),
    });

    const result = await runSync(connector, config);

    expect(result.success).toBe(false);
    expect(result.syncRunId).toBe(SYNC_RUN_ID);
    // Should NOT enter publish phase (no transaction call)
    expect(mockDb.transaction).not.toHaveBeenCalled();
    // Should record a fetch_fatal sync error
    expect(insertedSyncErrors.length).toBeGreaterThanOrEqual(1);
    const errorRow = insertedSyncErrors[0] as Record<string, unknown>;
    expect(errorRow.errorType).toBe("fetch_fatal");
    expect(errorRow.message).toContain("Zendesk API timeout");
    // Checkpoint with failed status
    expect((updatedSyncRuns[0] as Record<string, unknown>).status).toBe("failed");
    // Does NOT update dataSources on failure
    expect(updatedDataSources).toBe(false);
  });

  it("marks run as failed when publish phase (transaction) throws", async () => {
    selectResults = [
      [{ id: DATA_SOURCE_ID }],
    ];
    insertReturning = [
      [{ id: SYNC_RUN_ID }],
    ];

    const connector = makeConnector({
      fetchRecords: vi.fn(async () => ({
        records: [makeRecord("alice")],
        cursor: null,
        hasMore: false,
      })),
    });

    // Make the transaction throw (simulating a DB failure)
    mockDb.transaction = vi.fn(async () => {
      throw new Error("connection reset");
    });

    const result = await runSync(connector, config);

    expect(result.success).toBe(false);
    // Should record a publish_fatal sync error
    const publishError = insertedSyncErrors.find(
      (e) => (e as Record<string, unknown>).errorType === "publish_fatal"
    );
    expect(publishError).toBeDefined();
    expect((publishError as Record<string, unknown>).message).toContain("connection reset");
    expect((updatedSyncRuns[0] as Record<string, unknown>).status).toBe("failed");
    expect(updatedDataSources).toBe(false);
  });

  it("completes with zero counts when connector returns no records", async () => {
    selectResults = [
      [{ id: DATA_SOURCE_ID }],
    ];
    insertReturning = [
      [{ id: SYNC_RUN_ID }],
    ];

    const connector = makeConnector(); // default: returns 0 records

    const result = await runSync(connector, config);

    expect(result.success).toBe(true);
    // No publish transaction needed for empty data
    expect(mockDb.transaction).not.toHaveBeenCalled();
    const checkpoint = updatedSyncRuns[0] as Record<string, unknown>;
    expect(checkpoint.status).toBe("completed");
    expect(checkpoint.recordsIngested).toBe(0);
  });

  it("throws when the data source does not exist", async () => {
    selectResults = [
      [], // dataSources lookup returns empty
    ];

    const connector = makeConnector();

    await expect(runSync(connector, config)).rejects.toThrow(
      `DataSource ${DATA_SOURCE_ID} not found`
    );
  });

  it("passes weekOffset as the cursor and fetches only 1 page", async () => {
    selectResults = [
      [{ id: DATA_SOURCE_ID }],
    ];
    insertReturning = [
      [{ id: SYNC_RUN_ID }],
    ];

    const fetchRecords = vi.fn(async (_cfg: ConnectorConfig, ctx: SyncContext) => ({
      records: [makeRecord("alice")],
      cursor: ctx.cursor,
      hasMore: true, // Even with hasMore=true, weekOffset limits to 1 page
    }));

    const connector = makeConnector({ fetchRecords });

    await runSync(connector, config, { weekOffset: 2 });

    // Should call fetchRecords exactly once (maxPages=1 for single-week mode)
    expect(fetchRecords).toHaveBeenCalledOnce();
    // Cursor should be "2" (the weekOffset as a string)
    const ctx = fetchRecords.mock.calls[0]![1];
    expect(ctx.cursor).toBe("2");
    // metadataJson should include weekOffset
    const checkpoint = updatedSyncRuns[0] as Record<string, unknown>;
    const metadata = checkpoint.metadataJson as Record<string, unknown>;
    expect(metadata.weekOffset).toBe(2);
  });

  it("paginates through multiple pages when hasMore is true", async () => {
    selectResults = [
      [{ id: DATA_SOURCE_ID }],
    ];
    insertReturning = [
      [{ id: SYNC_RUN_ID }],
    ];

    let callCount = 0;
    const fetchRecords = vi.fn(async () => {
      callCount++;
      return {
        records: [makeRecord(`page${callCount}`)],
        cursor: callCount < 3 ? `cursor-${callCount}` : null,
        hasMore: callCount < 3,
      };
    });

    const connector = makeConnector({ fetchRecords });

    const result = await runSync(connector, config);

    expect(result.success).toBe(true);
    expect(fetchRecords).toHaveBeenCalledTimes(3);
  });
});
