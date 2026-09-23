import { formatMetricValue, type ValueType } from "./types";

export interface ScorecardMetric {
  category: string | null;
  name: string;
  currentValue: number | null;
  previousValue: number | null;
  targetValue: number | null;
  targetType: string | null;
  targetMin: number | null;
  targetMax: number | null;
  status: string;
  unit: string | null;
  valueType: ValueType;
  qualityStatus: string;
  dataFreshnessAt: string | null;
  calculationVersion: number;
  targetSource: string | null;
}

export interface ExportSnapshot {
  employeeName: string;
  periodLabel: string;
  previousPeriodLabel: string;
  metrics: ScorecardMetric[];
}

export function formatExportValue(value: number | null, unit: string | null, type: ValueType) {
  return value === null ? "—" : formatMetricValue(value, unit, type);
}

export function formatExportTarget(metric: ScorecardMetric) {
  if (metric.targetType === "range") {
    if (metric.targetMin === null || metric.targetMax === null) return "—";
    return `${formatExportValue(metric.targetMin, metric.unit, metric.valueType)}–${formatExportValue(metric.targetMax, metric.unit, metric.valueType)}`;
  }
  return formatExportValue(metric.targetValue, metric.unit, metric.valueType);
}

export function exportCsv(snapshot: ExportSnapshot, statusLabel: (status: string) => string) {
  const rows = [
    [
      "Employee",
      "Period (UTC)",
      "Comparison period (UTC)",
      "Category",
      "Metric",
      "Current value",
      "Previous value",
      "Target",
      "Status",
      "Quality",
      "Source observed at (UTC)",
      "Calculation version",
      "Target scope",
    ],
  ];
  for (const metric of snapshot.metrics)
    rows.push([
      snapshot.employeeName,
      snapshot.periodLabel,
      snapshot.previousPeriodLabel,
      metric.category ?? "Other",
      metric.name,
      formatExportValue(metric.currentValue, metric.unit, metric.valueType),
      formatExportValue(metric.previousValue, metric.unit, metric.valueType),
      formatExportTarget(metric),
      statusLabel(metric.status),
      metric.qualityStatus,
      metric.dataFreshnessAt ?? "Unavailable",
      String(metric.calculationVersion),
      metric.targetSource ?? "None",
    ]);
  // Quoting alone does not prevent spreadsheet formula execution.
  return rows
    .map((row) =>
      row
        .map((value) => {
          const safe = /^[\s]*[=+@-]/.test(value) ? `'${value}` : value;
          return `"${safe.replace(/"/g, '""')}"`;
        })
        .join(",")
    )
    .join("\n");
}

export function exportDataDetails(metrics: ScorecardMetric[]) {
  return metrics
    .map(
      (metric) =>
        `${metric.name}: ${metric.qualityStatus}; observed ${metric.dataFreshnessAt ?? "unavailable"}; calculation v${metric.calculationVersion}; target scope ${metric.targetSource ?? "none"}`
    )
    .join("\n");
}
