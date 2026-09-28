import { DURATION_FORMAT_LABEL, formatMetricValue, type ValueType } from "./types";
import {
  HISTORICAL_TARGET_REASON,
  TICKET_ATTRIBUTION_QUALITY,
  TICKET_ATTRIBUTION_REASON,
} from "./availability";
import { SOURCE_TARGET_REASON } from "./source-context";

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
  targetContextStatus?: "current" | "historical_unverified" | "source_unverified";
  sourceDescription?: string | null;
  missingReason?: string | null;
  sourceContract?: string | null;
  reportingTimeZone?: string | null;
  comparisonUnavailableReason?: string | null;
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

function exportUnavailableReason(metric: ScorecardMetric) {
  return metric.qualityStatus === TICKET_ATTRIBUTION_QUALITY
    ? TICKET_ATTRIBUTION_REASON
    : (metric.missingReason ?? "");
}

export function exportCsv(snapshot: ExportSnapshot, statusLabel: (status: string) => string) {
  const rows = [
    [
      "Employee",
      "Period",
      "Comparison period",
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
      "Target context",
      "Source measurement",
      "Unavailable reason",
      "Display unit",
      "Reporting timezone",
      "Source definition",
      "Comparison unavailable reason",
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
      metric.targetContextStatus === "historical_unverified"
        ? HISTORICAL_TARGET_REASON
        : metric.targetContextStatus === "source_unverified"
          ? SOURCE_TARGET_REASON
          : metric.targetContextStatus === "current"
            ? "Current profile"
            : "Not recorded",
      metric.sourceDescription ?? "",
      exportUnavailableReason(metric),
      metric.valueType === "duration" ? DURATION_FORMAT_LABEL : (metric.unit ?? ""),
      metric.reportingTimeZone ?? "UTC",
      metric.sourceContract ?? "Legacy / not recorded",
      metric.comparisonUnavailableReason ?? "",
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
        `${metric.name}: ${metric.qualityStatus}; observed ${metric.dataFreshnessAt ?? "unavailable"}; calculation v${metric.calculationVersion}; reporting timezone ${metric.reportingTimeZone ?? "UTC"}; source definition ${metric.sourceContract ?? "legacy / not recorded"}; target scope ${metric.targetSource ?? "none"}${metric.targetContextStatus === "historical_unverified" ? `; ${HISTORICAL_TARGET_REASON}` : metric.targetContextStatus === "source_unverified" ? `; ${SOURCE_TARGET_REASON}` : ""}${metric.sourceDescription ? `; ${metric.sourceDescription}` : ""}${exportUnavailableReason(metric) ? `; ${exportUnavailableReason(metric)}` : ""}${metric.comparisonUnavailableReason ? `; ${metric.comparisonUnavailableReason}` : ""}${metric.valueType === "duration" ? `; times ${DURATION_FORMAT_LABEL}` : ""}`
    )
    .join("\n");
}
