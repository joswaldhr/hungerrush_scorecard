import { describe, expect, it } from "vitest";
import { headlineMetrics, metricDelta } from "@/lib/domain/metrics/presentation-highlights";
import type { EmployeeMetricRow } from "@/lib/domain/metrics/queries";
const row: EmployeeMetricRow = {
  definitionId: "synthetic",
  key: "calls",
  name: "Calls",
  category: "calls",
  unit: "calls",
  valueType: "count",
  direction: "neutral",
  displayOrder: 0,
  isPrimary: true,
  currentValue: 12,
  previousValue: 10,
  target: null,
  status: { status: "no_target", direction: "neutral" },
  qualityStatus: "complete",
  dataFreshnessAt: null,
  calculationVersion: 1,
  sourceContract: "synthetic-v1",
};
describe("honest presentation comparisons", () => {
  it("shows absolute signed count changes including a zero baseline", () => {
    expect(metricDelta(row, false)).toBe("+2");
    expect(metricDelta({ ...row, currentValue: 0 }, false)).toBe("−10");
    expect(metricDelta({ ...row, previousValue: 0 }, false)).toBe("+12");
    expect(metricDelta({ ...row, currentValue: 10 }, false)).toBe("No change");
  });
  it("uses percentage points rather than relative percent change", () => {
    expect(
      metricDelta(
        { ...row, valueType: "percentage", unit: "%", currentValue: 72.1, previousValue: 70 },
        false
      )
    ).toBe("+2.1 pp");
  });
  it("formats duration differences in the stored unit without negative zero", () => {
    expect(
      metricDelta(
        { ...row, valueType: "duration", unit: "seconds", currentValue: 60, previousValue: 120 },
        false
      )
    ).toBe("−0:01:00");
    expect(
      metricDelta(
        { ...row, valueType: "duration", unit: "minutes", currentValue: 2, previousValue: 1 },
        false
      )
    ).toBe("+0:01:00");
    expect(
      metricDelta(
        { ...row, valueType: "duration", unit: "seconds", currentValue: 10.1, previousValue: 10.2 },
        false
      )
    ).toBe("No change");
  });
  it.each([
    { currentValue: null },
    { previousValue: null },
    { currentValue: NaN },
    { previousValue: Infinity },
    { qualityStatus: "partial" },
    { qualityStatus: "stale" },
    { comparisonUnavailableReason: "Definition changed" },
    { sourceContract: null },
    { key: "backlog_count" },
  ])("withholds ineligible comparisons: %j", (override) => {
    expect(metricDelta({ ...row, ...override }, false)).toBeNull();
  });
  it("withholds current-week change regardless of targets", () =>
    expect(metricDelta(row, true)).toBeNull());
  it("selects configured priorities without concealing unavailable values or mutating rows", () => {
    const input = [
      { ...row, definitionId: "a", displayOrder: 3, currentValue: null },
      { ...row, definitionId: "b", displayOrder: 1, category: "tickets", isPrimary: false },
      { ...row, definitionId: "c", displayOrder: 2, category: "quality" },
      { ...row, definitionId: "d", displayOrder: 0, isPrimary: false },
    ];
    expect(headlineMetrics(input).map((r) => r.definitionId)).toEqual(["c", "a", "b"]);
    expect(input[0]?.definitionId).toBe("a");
  });
  it("returns fewer than three when fewer rows are authorized", () =>
    expect(headlineMetrics([row])).toEqual([row]));
});
