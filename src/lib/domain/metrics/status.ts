import type { EmployeeMetricRow } from "./queries";

export type OverallStatus =
  | "on_track"
  | "mixed"
  | "needs_attention"
  | "no_data"
  | "no_target"
  | "partial_data"
  | "in_progress";

export function isReportingPeriodInProgress(
  periodStart: string,
  periodEnd: string,
  today = new Date().toISOString().slice(0, 10)
): boolean {
  return periodStart <= today && today <= periodEnd;
}

// Pure and dependency-free (no db import) so it's safe to use from a client
// component -- extracted out of briefings/generate.ts, which pulls in the db
// client at module scope and can't be imported into "use client" code.
export function deriveOverallStatus(
  metrics: EmployeeMetricRow[],
  period?: { periodStart: string; periodEnd: string; today?: string }
): OverallStatus {
  if (metrics.length === 0 || metrics.every((m) => m.currentValue === null)) return "no_data";
  // Missing/partial source coverage cannot support an overall performance claim.
  // Preserve individual comparisons, but keep the overall badge neutral.
  if (metrics.some((m) => m.currentValue === null || m.qualityStatus !== "complete")) {
    return "partial_data";
  }

  const withTargets = metrics.filter(
    (m) => m.status.status !== "no_target" && m.status.status !== "no_data"
  );
  if (withTargets.length === 0) return "no_target";
  if (period && isReportingPeriodInProgress(period.periodStart, period.periodEnd, period.today))
    return "in_progress";

  const offTarget = withTargets.filter((m) => m.status.status === "off_target").length;
  const onTarget = withTargets.filter((m) => m.status.status === "on_target").length;

  if (offTarget >= 2 || offTarget > withTargets.length / 2) return "needs_attention";
  if (onTarget === withTargets.length) return "on_track";
  return "mixed";
}
