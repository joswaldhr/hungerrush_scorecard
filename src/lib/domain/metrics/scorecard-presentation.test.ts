import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { EmployeeMetricRow } from "./queries";
import { scorecardPresentation, snapshotObservation } from "./scorecard-presentation";

const row: EmployeeMetricRow = {
  definitionId: "synthetic",
  key: "calls",
  name: "Calls",
  category: "Calls",
  unit: "calls",
  valueType: "count",
  direction: "higher_is_better",
  displayOrder: 0,
  isPrimary: true,
  currentValue: 0,
  previousValue: 10,
  qualityStatus: "complete",
  calculationVersion: 1,
  dataFreshnessAt: new Date("2026-09-21T06:00:00Z"),
  target: {
    targetValue: 20,
    targetType: "minimum",
    targetMin: null,
    targetMax: null,
    warningValue: null,
    priority: 1,
    source: "team",
  },
  status: { status: "off_target", direction: "higher_is_better" },
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-28T12:00:00Z"));
});
afterEach(() => vi.useRealTimers());

it("uses preceding-week comparison, counts zero and retains eligible closed-week judgments", () => {
  const result = scorecardPresentation("2026-09-20", [row]);
  expect(result).toMatchObject({
    mode: "review",
    periodEnd: "2026-09-26",
    previousPeriodStart: "2026-09-13",
    previousPeriodEnd: "2026-09-19",
    reported: 1,
    qualityWarnings: 0,
  });
  expect(result.rows[0]).toMatchObject({
    currentValue: 0,
    displayStatus: "off_target",
    qualityStatus: "complete",
    dataFreshnessAt: row.dataFreshnessAt,
  });
  expect(result.availability).toBe("1 of 1 metrics have reported values · 0 unavailable");
  expect(result.availability).not.toMatch(/certified|accurate|stale/i);
});

it("neutralizes current-week judgments while preserving targets and underlying source rows", () => {
  const result = scorecardPresentation("2026-09-27", [row]);
  expect(result.overallStatus).toBe("in_progress");
  expect(result.rows[0]).toMatchObject({
    displayStatus: "in_progress",
    currentValue: 0,
    target: row.target,
  });
  expect(row.status.status).toBe("off_target");
});

it("preserves null, partial, failed and unverified quality with neutral progress statuses", () => {
  const result = scorecardPresentation("2026-09-27", [
    row,
    { ...row, currentValue: null, qualityStatus: "unverified_attribution" },
    { ...row, qualityStatus: "partial" },
    { ...row, qualityStatus: "failed" },
  ]);
  expect(result).toMatchObject({ reported: 3, qualityWarnings: 3, overallStatus: "partial_data" });
  expect(result.rows.map((r) => r.displayStatus)).toEqual([
    "in_progress",
    "no_data",
    "partial_data",
    "partial_data",
  ]);
  expect(scorecardPresentation("2026-09-27", [{ ...row, currentValue: null }]).overallStatus).toBe(
    "no_data"
  );
});

it("does not supply targets for unverified historical context", () => {
  const result = scorecardPresentation("2026-09-20", [
    {
      ...row,
      target: null,
      targetContextStatus: "historical_unverified",
      status: { ...row.status, status: "no_target" },
    },
  ]);
  expect(result.rows[0]).toMatchObject({
    target: null,
    displayStatus: "no_target",
    targetContextStatus: "historical_unverified",
  });
});

it("labels backlog with its real observation, never a fabricated week-end timestamp", () => {
  expect(snapshotObservation("backlog_count", row.dataFreshnessAt)).toBe(
    "Observed snapshot · 2026-09-21 06:00 UTC"
  );
  expect(snapshotObservation("backlog_count", null)).toContain("not recorded");
  expect(snapshotObservation("backlog_count", "invalid")).toContain("not recorded");
  expect(snapshotObservation("calls", row.dataFreshnessAt)).toBeNull();
});
