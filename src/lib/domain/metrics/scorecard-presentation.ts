import { formatWeekRangeLong, shiftWeekStart, weekBoundsForDate } from "@/lib/utils";
import type { EmployeeMetricRow } from "./queries";
import { deriveOverallStatus, isReportingPeriodInProgress, type OverallStatus } from "./status";
import type { MetricStatus } from "./types";

export type ScorecardMode = "review" | "progress";
export type ScorecardRow = EmployeeMetricRow & {
  displayStatus: MetricStatus["status"] | "in_progress" | "partial_data";
};

/** Presentation only: never change values, target eligibility or source quality. */
export function scorecardPresentation(periodStart: string, rows: EmployeeMetricRow[]) {
  const { periodEnd } = weekBoundsForDate(periodStart);
  const previousPeriodStart = shiftWeekStart(periodStart, -1);
  const previousPeriodEnd = shiftWeekStart(periodEnd, -1);
  const mode: ScorecardMode = isReportingPeriodInProgress(periodStart, periodEnd)
    ? "progress"
    : "review";
  const displayRows: ScorecardRow[] = rows.map((row) => ({
    ...row,
    displayStatus:
      mode === "review"
        ? row.status.status
        : row.currentValue === null
          ? "no_data"
          : row.qualityStatus !== "complete"
            ? "partial_data"
            : "in_progress",
  }));
  const reported = rows.filter((row) => row.currentValue !== null).length;
  const qualityWarnings = rows.filter((row) => row.qualityStatus !== "complete").length;
  const overallStatus: OverallStatus =
    mode === "progress"
      ? reported === 0
        ? "no_data"
        : reported < rows.length || qualityWarnings > 0
          ? "partial_data"
          : "in_progress"
      : deriveOverallStatus(rows, { periodStart, periodEnd });
  return {
    periodStart,
    periodEnd,
    previousPeriodStart,
    previousPeriodEnd,
    mode,
    rows: displayRows,
    overallStatus,
    periodLabel: `${formatWeekRangeLong(periodStart, periodEnd)} — ${mode === "progress" ? "In progress; targets cover the full week" : "1:1 review"}`,
    previousPeriodLabel: formatWeekRangeLong(previousPeriodStart, previousPeriodEnd),
    availability: `${reported} of ${rows.length} metrics have reported values · ${rows.length - reported} unavailable`,
    reported,
    qualityWarnings,
  };
}

export function snapshotObservation(key: string, observedAt: Date | string | null) {
  if (key !== "backlog_count") return null;
  const date = observedAt ? new Date(observedAt) : null;
  const timestamp = date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
  return `Observed snapshot · ${timestamp ? `${timestamp.slice(0, 16).replace("T", " ")} UTC` : "observation time not recorded"}`;
}
