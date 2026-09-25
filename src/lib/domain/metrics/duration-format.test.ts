import { expect, it } from "vitest";
import { formatMetricValue } from "./types";
import { exportCsv, exportDataDetails, type ExportSnapshot } from "./export-snapshot";

it.each([
  [1207.1, "min", "20:07:06"],
  [266, "s", "0:04:26"],
  [120, "seconds", "0:02:00"],
  [2, "minutes", "0:02:00"],
  [1 / 30, "hours", "0:02:00"],
  [0, "s", "0:00:00"],
  [59.6, "s", "0:01:00"],
  [3599.9, "s", "1:00:00"],
  [49, "h", "49:00:00"],
])("formats %s %s as %s without wrapping hours at 24", (value, unit, expected) => {
  expect(formatMetricValue(value, unit, "duration")).toBe(expected);
});

it("does not convert counts, percentages or unknown duration units", () => {
  expect(formatMetricValue(120, "calls", "count")).toBe("120");
  expect(formatMetricValue(95, "%", "percentage")).toBe("95.0%");
  expect(formatMetricValue(2, "days", "duration")).toBe("2.0 days");
});

it("exports values and targets using the same declared duration format", () => {
  const snapshot: ExportSnapshot = {
    employeeName: "Synthetic",
    periodLabel: "Current",
    previousPeriodLabel: "Previous",
    metrics: [
      {
        category: "Calls",
        name: "Avg Hold",
        currentValue: 120,
        previousValue: 0,
        targetValue: 60,
        targetType: "maximum",
        targetMin: null,
        targetMax: null,
        status: "off_target",
        unit: "s",
        valueType: "duration",
        qualityStatus: "complete",
        dataFreshnessAt: null,
        calculationVersion: 1,
        targetSource: "team",
      },
    ],
  };
  const csv = exportCsv(snapshot, (x) => x);
  expect(csv).toContain('"0:02:00","0:00:00","0:01:00"');
  expect(csv).toContain("H:MM:SS (hours:minutes:seconds)");
  expect(exportDataDetails(snapshot.metrics)).toContain("H:MM:SS");
});
