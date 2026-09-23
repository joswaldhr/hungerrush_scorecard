// @vitest-environment node
import { describe, expect, it } from "vitest";
import { deriveOverallStatus } from "./status";
import type { EmployeeMetricRow } from "./queries";
import { describeExecutiveSummary } from "../briefings/templates";
const row = (overrides: Partial<EmployeeMetricRow> = {}): EmployeeMetricRow => ({
  definitionId: "fixture",
  key: "fixture",
  name: "Fixture",
  category: null,
  unit: "count",
  valueType: "count",
  direction: "higher_is_better",
  displayOrder: 0,
  isPrimary: true,
  currentValue: 0,
  previousValue: null,
  target: null,
  status: { status: "on_target", direction: "higher_is_better" },
  qualityStatus: "complete",
  dataFreshnessAt: new Date(),
  calculationVersion: 1,
  ...overrides,
});
describe("overall performance requires sufficient evidence", () => {
  it("does not call an empty scorecard on track", () =>
    expect(deriveOverallStatus([])).toBe("no_data"));
  it("preserves no-data status when every value is absent", () => {
    expect(deriveOverallStatus([row({ currentValue: null })])).toBe("no_data");
  });
  it("does not hide missing rows behind available on-target values", () => {
    expect(deriveOverallStatus([row(), row({ currentValue: null })])).toBe("partial_data");
  });
  it.each(["partial", "missing", "unknown"])(
    "does not assess %s coverage as performance",
    (qualityStatus) => {
      expect(deriveOverallStatus([row({ qualityStatus })])).toBe("partial_data");
    }
  );
  it("treats confirmed zero as data", () => expect(deriveOverallStatus([row()])).toBe("on_track"));
  it("does not imply performance when there are no targets", () => {
    expect(
      deriveOverallStatus([row({ status: { status: "no_target", direction: "neutral" } })])
    ).toBe("no_target");
  });
  it("retains the existing assessment for complete targeted data", () => {
    expect(
      deriveOverallStatus([
        row({ status: { status: "off_target", direction: "higher_is_better" } }),
      ])
    ).toBe("needs_attention");
  });
  it.each(["partial_data", "no_target"] as const)("keeps %s briefing text neutral", (status) => {
    const summary = describeExecutiveSummary("Synthetic employee", [], status);
    expect(summary.text).toContain("assessment");
    expect(summary.text).not.toContain("performing well");
  });
});
