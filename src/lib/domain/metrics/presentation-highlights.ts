import type { EmployeeMetricRow } from "./queries";
import { formatMetricValue } from "./types";

/** Choose only configured rows, in configured priority order; availability never changes selection. */
export function headlineMetrics<T extends EmployeeMetricRow>(rows: T[]): T[] {
  const ordered = [...rows].sort((a, b) => a.displayOrder - b.displayOrder);
  const selected = ordered.filter((row) => row.isPrimary).slice(0, 3);
  for (const row of ordered) {
    if (selected.length >= 3) break;
    if (!selected.includes(row) && !selected.some((other) => other.category === row.category))
      selected.push(row);
  }
  for (const row of ordered) {
    if (selected.length >= 3) break;
    if (!selected.includes(row)) selected.push(row);
  }
  return selected;
}

/** The reader withholds incompatible prior definitions. Unknown contracts get no derived comparison. */
export function metricDelta(row: EmployeeMetricRow, inProgress: boolean): string | null {
  if (
    inProgress ||
    !row.sourceContract ||
    row.comparisonUnavailableReason ||
    row.qualityStatus !== "complete" ||
    row.previousQualityStatus !== "complete" ||
    row.key === "backlog_count" ||
    row.currentValue === null ||
    row.previousValue === null ||
    !Number.isFinite(row.currentValue) ||
    !Number.isFinite(row.previousValue)
  )
    return null;
  if (
    row.valueType === "duration" &&
    !["s", "seconds", "min", "minutes", "h", "hours"].includes(row.unit ?? "")
  )
    return null;
  const difference = row.currentValue - row.previousValue;
  const magnitude =
    row.valueType === "percentage"
      ? `${Math.abs(difference).toFixed(1)} pp`
      : formatMetricValue(Math.abs(difference), row.unit, row.valueType);
  if (!/[1-9]/.test(magnitude)) return "No change";
  return `${difference < 0 ? "−" : "+"}${magnitude}`;
}
