import { DURATION_FORMAT_LABEL, formatMetricValue, type ValueType } from "./types";
import {
  HISTORICAL_TARGET_REASON,
  TICKET_ATTRIBUTION_QUALITY,
  TICKET_ATTRIBUTION_REASON,
} from "./availability";
import {
  SOURCE_TARGET_REASON,
  UPDATER_SOLVED_CONTRACT,
  ASSIGNEE_SOLVED_CONTRACT,
} from "./source-context";
import { snapshotObservation, type ScorecardMode } from "./scorecard-presentation";

export interface ScorecardMetric {
  key?: string;
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
  reportingAsOf?: string | null;
  comparisonUnavailableReason?: string | null;
}

export interface ExportSnapshot {
  employeeName: string;
  periodStart: string;
  periodEnd: string;
  mode: ScorecardMode;
  periodLabel: string;
  previousPeriodLabel: string;
  metrics: ScorecardMetric[];
}

export function scorecardFilename(
  snapshot: Pick<ExportSnapshot, "employeeName" | "periodStart" | "periodEnd">,
  kind: "scorecard" | "metrics",
  extension: "pdf" | "png" | "csv"
) {
  const name = snapshot.employeeName
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return `${name}-${kind}-${snapshot.periodStart}_${snapshot.periodEnd}.${extension}`;
}

export function scorecardShareUrl(href: string, periodStart: string) {
  const url = new URL(href);
  url.searchParams.set("week", periodStart);
  return url.toString();
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
      [metric.sourceDescription, snapshotObservation(metric.key ?? "", metric.dataFreshnessAt)]
        .filter(Boolean)
        .join("; "),
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
        `${metric.name}: ${metric.qualityStatus}; observed ${metric.dataFreshnessAt ?? "unavailable"}; calculation v${metric.calculationVersion}; reporting timezone ${metric.reportingTimeZone ?? "UTC"}; source definition ${metric.sourceContract ?? "legacy / not recorded"}; target scope ${metric.targetSource ?? "none"}${metric.targetContextStatus === "historical_unverified" ? `; ${HISTORICAL_TARGET_REASON}` : metric.targetContextStatus === "source_unverified" ? `; ${SOURCE_TARGET_REASON}` : ""}${metric.sourceDescription ? `; ${metric.sourceDescription}` : ""}${snapshotObservation(metric.key ?? "", metric.dataFreshnessAt) ? `; ${snapshotObservation(metric.key ?? "", metric.dataFreshnessAt)}` : ""}${exportUnavailableReason(metric) ? `; ${exportUnavailableReason(metric)}` : ""}${metric.comparisonUnavailableReason ? `; ${metric.comparisonUnavailableReason}` : ""}${metric.valueType === "duration" ? `; times ${DURATION_FORMAT_LABEL}` : ""}`
    )
    .join("\n");
}

/** Human-readable export notes. Detailed provenance stays in CSV and the app. */
export function exportReviewNotes(metrics: ScorecardMetric[]) {
  const timezones = [...new Set(metrics.map((metric) => metric.reportingTimeZone ?? "UTC"))];
  const observations = metrics
    .map((metric) => (metric.dataFreshnessAt ? new Date(metric.dataFreshnessAt) : null))
    .filter((date): date is Date => date !== null && Number.isFinite(date.getTime()))
    .map((date) => date.toISOString())
    .sort();
  const stamp = (date: string) => `${date.slice(0, 16).replace("T", " ")} UTC`;
  const first = observations[0];
  const last = observations.at(-1);
  const notes = [
    `Reporting ${timezones.length === 1 ? "timezone" : "timezones"}: ${timezones.join(", ") || "not recorded"}.`,
    first && last
      ? `Source observations: ${stamp(first)}${first === last ? "" : ` to ${stamp(last)}`}.${observations.length < metrics.length ? " Some observation times are not recorded." : ""}`
      : "Source observation times are not recorded.",
  ];
  // Group repeated caveats rather than repeating the entire audit record per row.
  const warnings = new Map<string, string[]>();
  for (const metric of metrics) {
    const solvedMeaning =
      metric.sourceContract === UPDATER_SOLVED_CONTRACT
        ? "Latest-solve credits to the updater account; may include integration activity. Not proof of manual human activity."
        : metric.sourceContract === ASSIGNEE_SOLVED_CONTRACT
          ? "Solved tickets assigned to this employee; does not identify who performed the solve."
          : null;
    const cutoff =
      solvedMeaning && metric.reportingAsOf && Number.isFinite(Date.parse(metric.reportingAsOf))
        ? `Captured source data before ${new Date(metric.reportingAsOf).toISOString()}; current-week progress.`
        : null;
    const reasons = [
      solvedMeaning,
      cutoff,
      exportUnavailableReason(metric),
      metric.comparisonUnavailableReason,
      metric.targetContextStatus === "historical_unverified"
        ? HISTORICAL_TARGET_REASON
        : metric.targetContextStatus === "source_unverified"
          ? SOURCE_TARGET_REASON
          : null,
      metric.qualityStatus !== "complete" && !exportUnavailableReason(metric)
        ? `${metric.qualityStatus === "partial" ? "Partial" : metric.qualityStatus === "stale" ? "Stale" : "Unverified"} data.`
        : null,
    ];
    for (const reason of new Set(reasons.filter((value): value is string => Boolean(value)))) {
      const names = warnings.get(reason) ?? [];
      if (!names.includes(metric.name)) names.push(metric.name);
      warnings.set(reason, names);
    }
  }
  for (const [reason, names] of warnings) notes.push(`${names.join(", ")}: ${reason}`);
  notes.push(
    "Metric definitions and individual source details are available in Cadence and the CSV export."
  );
  return notes.join("\n");
}
