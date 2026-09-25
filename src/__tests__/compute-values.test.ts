vi.mock("@/lib/connectors/sync-revisions", () => ({ captureSyncRevisions: vi.fn() }));
// Focused formula fixtures use a mocked database. Real transaction and scope
// guarantees are exercised by sync-publication.test.ts against PostgreSQL.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  GOLDEN_EMPLOYEE,
  GOLDEN_WEEK,
  GOLDEN_SUM_FACTS,
  GOLDEN_SUM_EXPECTED,
  GOLDEN_AVERAGE_WITH_NULL_FACTS,
  GOLDEN_AVERAGE_WITH_NULL_EXPECTED,
  GOLDEN_LATEST_FACTS,
  GOLDEN_LATEST_EXPECTED,
  GOLDEN_TWO_PERIOD_FACTS,
  GOLDEN_TWO_PERIOD_EXPECTED,
} from "@/lib/fixtures/golden-dataset";

const mockDb = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/db/schema", () => ({
  normalizedFacts: {},
  metricDefinitions: {},
  employees: {},
  metricValues: {},
  sourceRecords: {},
}));
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
  inArray: vi.fn(),
  or: vi.fn(),
}));

import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";

const ORG_ID = "10000000-0000-4000-8000-000000000001";
const DEF_ID = "60000000-0000-4000-8000-000000000001";

interface Setup {
  insertedRows: Array<Record<string, unknown>>;
}

/**
 * Configures mockDb for one computeMetricValuesFromFacts() run: one metric
 * definition, one employee (untracked/no team), and the given facts.
 */
function setup(
  calculationType: string,
  facts: Array<{
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    numericValue: number | null;
  }>
): Setup {
  const insertedRows: Array<Record<string, unknown>> = [];
  let selectCall = -1;

  mockDb.select.mockImplementation((_projection?: unknown) => ({
    from: () => ({
      where: () => {
        selectCall++;
        if (selectCall === 1) {
          // defs
          return Promise.resolve([
            { id: DEF_ID, key: "golden_metric", calculationType, version: 1 },
          ]);
        }
        if (selectCall === 2) {
          // employees
          return Promise.resolve([]);
        }
        // facts (one call per def; only one def here)
        return Promise.resolve(
          facts.map((fact, i) => ({
            ...fact,
            id: String(i),
            sourceObservedAt: new Date(`2026-09-0${i + 1}T00:00:00Z`),
          }))
        );
      },
    }),
  }));

  mockDb.insert.mockImplementation(() => ({
    values: (values: Record<string, unknown> | Record<string, unknown>[]) => {
      insertedRows.push(...(Array.isArray(values) ? values : [values]));
      return { onConflictDoUpdate: () => Promise.resolve() };
    },
  }));

  return { insertedRows };
}

beforeEach(() => {
  mockDb.select.mockReset();
  mockDb.insert.mockReset();
});

describe("computeMetricValuesFromFacts", () => {
  it("sums facts for a sum-type metric (golden dataset)", async () => {
    const { insertedRows } = setup("sum", GOLDEN_SUM_FACTS);
    const written = await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });

    expect(written).toBe(1);
    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]!.numericValue).toBe(GOLDEN_SUM_EXPECTED);
    expect(insertedRows[0]!.employeeId).toBe(GOLDEN_EMPLOYEE.alice);
  });

  it("averages facts and skips null values rather than coercing to zero (golden dataset)", async () => {
    const { insertedRows } = setup("average", GOLDEN_AVERAGE_WITH_NULL_FACTS);
    await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]!.numericValue).toBe(GOLDEN_AVERAGE_WITH_NULL_EXPECTED);
  });

  it("takes the last recorded value for a latest-type metric (golden dataset)", async () => {
    const { insertedRows } = setup("latest", GOLDEN_LATEST_FACTS);
    await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });

    expect(insertedRows).toHaveLength(1);
    expect(insertedRows[0]!.numericValue).toBe(GOLDEN_LATEST_EXPECTED);
  });

  it("never merges facts from different periods into one group (golden dataset)", async () => {
    const { insertedRows } = setup("sum", GOLDEN_TWO_PERIOD_FACTS);
    await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });

    expect(insertedRows).toHaveLength(2);
    const byPeriod = Object.fromEntries(
      insertedRows.map((r) => [r.periodStart as string, r.numericValue as number])
    );
    expect(byPeriod).toEqual(GOLDEN_TWO_PERIOD_EXPECTED);
  });

  it("writes a missing value when a group has no non-null values", async () => {
    const { insertedRows } = setup("average", [
      {
        employeeId: GOLDEN_EMPLOYEE.bob,
        periodStart: GOLDEN_WEEK.w1.start,
        periodEnd: GOLDEN_WEEK.w1.end,
        numericValue: null,
      },
    ]);
    const written = await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });

    expect(written).toBe(1);
    expect(insertedRows[0]).toMatchObject({ numericValue: null, qualityStatus: "missing" });
  });

  it("rounds the stored value to 2 decimal places", async () => {
    const { insertedRows } = setup("average", [
      {
        employeeId: GOLDEN_EMPLOYEE.alice,
        periodStart: GOLDEN_WEEK.w1.start,
        periodEnd: GOLDEN_WEEK.w1.end,
        numericValue: 10,
      },
      {
        employeeId: GOLDEN_EMPLOYEE.alice,
        periodStart: GOLDEN_WEEK.w1.start,
        periodEnd: GOLDEN_WEEK.w1.end,
        numericValue: 11,
      },
      {
        employeeId: GOLDEN_EMPLOYEE.alice,
        periodStart: GOLDEN_WEEK.w1.start,
        periodEnd: GOLDEN_WEEK.w1.end,
        numericValue: 11,
      },
    ]);
    await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });

    // (10 + 11 + 11) / 3 = 10.666... -> rounded to 10.67
    expect(insertedRows[0]!.numericValue).toBe(10.67);
  });

  it("calls onConflictDoUpdate for idempotent upsert on every insert", async () => {
    setup("sum", GOLDEN_SUM_FACTS);
    const insertedConflictTargets: unknown[] = [];
    // setup() wires the insert mock for capturing `values`; override just the
    // onConflictDoUpdate leaf here to also capture the conflict target.
    mockDb.insert.mockImplementation(() => ({
      values: () => ({
        onConflictDoUpdate: (config: { target: unknown }) => {
          insertedConflictTargets.push(config.target);
          return Promise.resolve();
        },
      }),
    }));

    await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });
    expect(insertedConflictTargets).toHaveLength(1);
  });
  it("does not resurrect an older latest value after a null observation", async () => {
    const { insertedRows } = setup("latest", [
      {
        employeeId: GOLDEN_EMPLOYEE.alice,
        periodStart: GOLDEN_WEEK.w1.start,
        periodEnd: GOLDEN_WEEK.w1.end,
        numericValue: 12,
      },
      {
        employeeId: GOLDEN_EMPLOYEE.alice,
        periodStart: GOLDEN_WEEK.w1.start,
        periodEnd: GOLDEN_WEEK.w1.end,
        numericValue: null,
      },
    ]);
    await computeMetricValuesFromFacts(ORG_ID, "golden", {
      connection: mockDb as never,
      dataSourceId: "source",
      syncRunId: "run",
    });
    expect(insertedRows[0]).toMatchObject({ numericValue: null, qualityStatus: "missing" });
  });
});
