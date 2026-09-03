// getTeamMetricTrend (src/lib/domain/metrics/queries.ts) calls `db` directly —
// not a pure function — so it is mocked here the same way as compute-values.test.ts.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GOLDEN_EMPLOYEE, GOLDEN_WEEK, GOLDEN_TEAM_TREND } from "@/lib/fixtures/golden-dataset";

const mockDb = vi.hoisted(() => ({ select: vi.fn() }));

vi.mock("@/lib/db", () => ({ db: mockDb }));
vi.mock("@/lib/db/schema", () => ({ metricValues: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn(), and: vi.fn(), inArray: vi.fn() }));

import { getTeamMetricTrend } from "@/lib/domain/metrics/queries";

beforeEach(() => {
  mockDb.select.mockReset();
});

describe("getTeamMetricTrend", () => {
  it("returns an all-null array without querying when there are no employees", async () => {
    const result = await getTeamMetricTrend([], "def-1", [GOLDEN_WEEK.w1.start]);
    expect(result).toEqual([null]);
    expect(mockDb.select).not.toHaveBeenCalled();
  });

  it("returns null for a period with no rows", async () => {
    mockDb.select.mockImplementation(() => ({
      from: () => ({ where: () => Promise.resolve([]) }),
    }));
    const result = await getTeamMetricTrend([GOLDEN_EMPLOYEE.alice], "def-1", [
      GOLDEN_WEEK.w1.start,
    ]);
    expect(result).toEqual([null]);
  });

  it(
    "KNOWN GAP: averages employees flat/unweighted, ignoring underlying ticket volume " +
      "(documents current behavior at queries.ts:280 — this is Finding #1 in the " +
      "2026-09-01 Metric Integrity Report, not a spec to preserve)",
    async () => {
      // Alice: 5 tickets at 40min AHT. Bob: 500 tickets at 8min AHT. A
      // volume-weighted team average would land near Bob's number (~8.3), but
      // getTeamMetricTrend currently just averages the two employee-level
      // values as if each represented equal underlying volume.
      mockDb.select.mockImplementation(() => ({
        from: () => ({
          where: () =>
            Promise.resolve([
              {
                periodStart: GOLDEN_WEEK.w1.start,
                numericValue: GOLDEN_TEAM_TREND.aliceHandleTime,
              },
              { periodStart: GOLDEN_WEEK.w1.start, numericValue: GOLDEN_TEAM_TREND.bobHandleTime },
            ]),
        }),
      }));

      const [result] = await getTeamMetricTrend(
        [GOLDEN_EMPLOYEE.alice, GOLDEN_EMPLOYEE.bob],
        "def-1",
        [GOLDEN_WEEK.w1.start]
      );

      expect(result).toBe(GOLDEN_TEAM_TREND.flatUnweightedAverage);
      // Documents the delta from what a volume-weighted average would produce —
      // this assertion should FAIL (loudly, on purpose) once/if this is fixed.
      expect(result).not.toBeCloseTo(GOLDEN_TEAM_TREND.approximateVolumeWeightedAverage, 0);
    }
  );

  it("returns one value per requested period, preserving order", async () => {
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        where: () =>
          Promise.resolve([
            { periodStart: GOLDEN_WEEK.w1.start, numericValue: 10 },
            { periodStart: GOLDEN_WEEK.w2.start, numericValue: 20 },
          ]),
      }),
    }));

    const result = await getTeamMetricTrend([GOLDEN_EMPLOYEE.alice], "def-1", [
      GOLDEN_WEEK.w2.start,
      GOLDEN_WEEK.w1.start,
    ]);
    expect(result).toEqual([20, 10]);
  });

  it("excludes null numericValue rows from the average rather than treating them as zero", async () => {
    mockDb.select.mockImplementation(() => ({
      from: () => ({
        where: () =>
          Promise.resolve([
            { periodStart: GOLDEN_WEEK.w1.start, numericValue: 10 },
            { periodStart: GOLDEN_WEEK.w1.start, numericValue: null },
            { periodStart: GOLDEN_WEEK.w1.start, numericValue: 20 },
          ]),
      }),
    }));

    const [result] = await getTeamMetricTrend(
      [GOLDEN_EMPLOYEE.alice, GOLDEN_EMPLOYEE.bob],
      "def-1",
      [GOLDEN_WEEK.w1.start]
    );
    expect(result).toBe(15); // (10 + 20) / 2, not (10 + 0 + 20) / 3
  });
});
