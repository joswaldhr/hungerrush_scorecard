// Golden dataset for the metric pipeline: every value here has a hand-computed
// expected result documented alongside it. This is not run against a database —
// it is imported directly by tests as known-input/known-output pairs.
//
// Purpose: catch silent regressions in metric calculation, aggregation, or
// status logic. If a future change to compute-values.ts, target-resolution.ts,
// or getTeamMetricTrend breaks one of these expected values, the corresponding
// test fails — that is the point. Do not "fix" a failing golden test by changing
// its expected value without first confirming the new behavior is intentional.
//
// IDs use a 90000000- prefix, distinct from src/lib/fixtures/seed.ts's real
// pilot-org ranges (10000000-/20000000-/.../60000000-) so golden data can never
// be mistaken for real seeded data.

export const GOLDEN_EMPLOYEE = {
  alice: "90000000-0000-4000-8000-000000000001",
  bob: "90000000-0000-4000-8000-000000000002",
} as const;

export const GOLDEN_WEEK = {
  w1: { start: "2026-08-17", end: "2026-08-23" },
  w2: { start: "2026-08-24", end: "2026-08-30" },
} as const;

interface GoldenFact {
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  numericValue: number | null;
}

// ── Sum aggregation (models tickets_resolved: calculationType "sum") ────────
// Alice, week 1: three raw per-sync facts of 30 + 29 + 28 = 87.
export const GOLDEN_SUM_FACTS: GoldenFact[] = [
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 30,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 29,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 28,
  },
];
export const GOLDEN_SUM_EXPECTED = 87;

// ── Average aggregation with a null value mixed in (models avg_handle_time) ─
// Bob, week 1: 10, 12, null, 14 — the null must be skipped, not treated as 0.
// (10 + 12 + 14) / 3 = 12. If null were coerced to 0: (10+12+0+14)/4 = 9 — wrong.
export const GOLDEN_AVERAGE_WITH_NULL_FACTS: GoldenFact[] = [
  {
    employeeId: GOLDEN_EMPLOYEE.bob,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 10,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.bob,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 12,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.bob,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: null,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.bob,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 14,
  },
];
export const GOLDEN_AVERAGE_WITH_NULL_EXPECTED = 12;

// ── Latest aggregation (models backlog_count: calculationType "latest") ─────
// Alice, week 1: three snapshots taken during the week, in sync order 5, 3, 8 —
// "latest" must take the last one recorded (8), not the max or the first.
export const GOLDEN_LATEST_FACTS: GoldenFact[] = [
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 5,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 3,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 8,
  },
];
export const GOLDEN_LATEST_EXPECTED = 8;

// ── Two-period grouping (facts must not merge across periods) ──────────────
// Alice has values in both week 1 and week 2; they must produce two separate
// metricValues rows, never summed/averaged together.
export const GOLDEN_TWO_PERIOD_FACTS: GoldenFact[] = [
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w1.start,
    periodEnd: GOLDEN_WEEK.w1.end,
    numericValue: 20,
  },
  {
    employeeId: GOLDEN_EMPLOYEE.alice,
    periodStart: GOLDEN_WEEK.w2.start,
    periodEnd: GOLDEN_WEEK.w2.end,
    numericValue: 40,
  },
];
export const GOLDEN_TWO_PERIOD_EXPECTED = {
  [GOLDEN_WEEK.w1.start]: 20,
  [GOLDEN_WEEK.w2.start]: 40,
};

// ── Team-trend volume-weighting scenario ────────────────────────────────────
// Alice handled 5 tickets at 40 minutes AHT; Bob handled 500 tickets at 8
// minutes AHT. A volume-weighted team average would sit close to Bob's number
// (8 * 500 + 40 * 5) / 505 ≈ 8.32. getTeamMetricTrend currently computes a flat
// unweighted mean of the two employees' values instead: (40 + 8) / 2 = 24 — a
// number neither employee is anywhere near. This fixture documents that gap
// (see metrics-queries.test.ts); it does not imply 24 is correct.
export const GOLDEN_TEAM_TREND = {
  aliceHandleTime: 40,
  aliceTicketVolume: 5,
  bobHandleTime: 8,
  bobTicketVolume: 500,
  flatUnweightedAverage: 24,
  approximateVolumeWeightedAverage: 8.32,
} as const;

// ── Status logic: direction/target-type combinations not covered by the
// existing target-resolution.test.ts (which only exercises minimum+higher_is_better
// and maximum+lower_is_better). ───────────────────────────────────────────────
export const GOLDEN_STATUS_SCENARIOS = {
  // minimum + lower_is_better: value at or below target is good (an unusual but
  // valid combination — e.g. "resolve at least X% within Y minutes" inverted).
  minimumLowerIsBetter: {
    target: { targetValue: 10, warningValue: 15, targetType: "minimum" as const },
    direction: "lower_is_better" as const,
    onTargetValue: 8, // 8 <= 10
    warningValue: 12, // 12 > 10, 12 <= 15
    offTargetValue: 20, // 20 > 15
  },
  // maximum + higher_is_better: evaluateStatus's "maximum" branch does not
  // actually branch on direction (see target-resolution.ts:94-103 — both arms
  // of the inner `if (direction === "lower_is_better")` are identical) — so
  // this combination behaves the same as maximum+lower_is_better today.
  maximumHigherIsBetter: {
    target: { targetValue: 10, warningValue: 15, targetType: "maximum" as const },
    direction: "higher_is_better" as const,
    onTargetValue: 8,
    warningValue: 12,
    offTargetValue: 20,
  },
} as const;
