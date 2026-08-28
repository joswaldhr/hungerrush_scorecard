import type { ManagerContext } from "@/lib/auth/authorization";
import { getAssignedEmployees } from "@/lib/auth/authorization";
import { getEmployeeMetrics, getEmployeeMetricsBatch } from "../metrics/queries";
import type { EmployeeMetricRow } from "../metrics/queries";
import type {
  TeamBriefingPayload,
  EmployeeSummaryPayload,
  OneOnOnePayload,
  BriefingMeta,
  MetricChange,
  MetricSnapshot,
  AttentionItem,
  ImprovementItem,
  TeamMetricSummary,
} from "./types";
import {
  describeExecutiveSummary,
  describeTakeaway,
  generateRecognitionItems,
  generateDiscussionItems,
  generateSuggestedQuestions,
} from "./templates";

const GENERATION_VERSION = 1;

function makeMeta(
  periodStart: string,
  periodEnd: string,
  dataFreshnessAt: Date | null
): BriefingMeta {
  return {
    generatedAt: new Date().toISOString(),
    dataFreshnessAt: dataFreshnessAt?.toISOString() ?? null,
    generationVersion: GENERATION_VERSION,
    periodStart,
    periodEnd,
  };
}

function computeChanges(metrics: EmployeeMetricRow[]): MetricChange[] {
  return metrics.map((m) => {
    let changePercent: number | null = null;
    let changeDirection: MetricChange["changeDirection"] = "stable";

    if (m.currentValue === null) {
      changeDirection = m.previousValue === null ? "new" : "new";
    } else if (m.previousValue === null) {
      changeDirection = "new";
    } else if (m.previousValue !== 0) {
      changePercent = ((m.currentValue - m.previousValue) / Math.abs(m.previousValue)) * 100;

      if (Math.abs(changePercent) < 1) {
        changeDirection = "stable";
      } else {
        const isPositiveChange = changePercent > 0;
        const isHigherBetter = m.direction === "higher_is_better";
        const isLowerBetter = m.direction === "lower_is_better";

        if ((isHigherBetter && isPositiveChange) || (isLowerBetter && !isPositiveChange)) {
          changeDirection = "improved";
        } else if ((isHigherBetter && !isPositiveChange) || (isLowerBetter && isPositiveChange)) {
          changeDirection = "declined";
        }
      }
    }

    return {
      metricKey: m.key,
      metricName: m.name,
      unit: m.unit,
      valueType: m.valueType,
      direction: m.direction,
      currentValue: m.currentValue,
      previousValue: m.previousValue,
      changePercent,
      changeDirection,
      evidence: buildChangeEvidence(m, changePercent),
    };
  });
}

function buildChangeEvidence(m: EmployeeMetricRow, changePercent: number | null): string {
  if (m.currentValue === null) return `No data available for ${m.name} this period.`;
  if (m.previousValue === null) return `${m.name}: first recorded value.`;
  if (changePercent === null || Math.abs(changePercent) < 1) {
    return `${m.name} is stable at ${m.currentValue}.`;
  }
  const dir = changePercent > 0 ? "increased" : "decreased";
  return `${m.name} ${dir} ${Math.abs(changePercent).toFixed(0)}% from ${m.previousValue} to ${m.currentValue}.`;
}

export function deriveOverallStatus(
  metrics: EmployeeMetricRow[]
): "on_track" | "mixed" | "needs_attention" | "no_data" {
  if (metrics.length === 0) return "on_track";
  if (metrics.every((m) => m.status.status === "no_data")) return "no_data";

  const withTargets = metrics.filter(
    (m) => m.status.status !== "no_target" && m.status.status !== "no_data"
  );
  if (withTargets.length === 0) return "on_track";

  const offTarget = withTargets.filter((m) => m.status.status === "off_target").length;
  const onTarget = withTargets.filter((m) => m.status.status === "on_target").length;

  if (offTarget >= 2 || offTarget > withTargets.length / 2) return "needs_attention";
  if (onTarget === withTargets.length) return "on_track";
  return "mixed";
}

function metricsToSnapshots(metrics: EmployeeMetricRow[]): MetricSnapshot[] {
  return metrics.map((m) => ({
    metricDefinitionId: m.definitionId,
    metricKey: m.key,
    metricName: m.name,
    unit: m.unit,
    valueType: m.valueType,
    direction: m.direction,
    currentValue: m.currentValue,
    previousValue: m.previousValue,
    target: m.target,
    status: m.status,
    qualityStatus: m.qualityStatus,
    isPrimary: m.isPrimary,
  }));
}

function oldestFreshness(metrics: EmployeeMetricRow[]): Date | null {
  const dates = metrics.map((m) => m.dataFreshnessAt).filter((d): d is Date => d !== null);
  if (dates.length === 0) return null;
  return new Date(Math.min(...dates.map((d) => d.getTime())));
}

// ── Public Generators ──────────────────────────────────────

export async function generateTeamBriefing(
  ctx: ManagerContext,
  teamId: string,
  teamName: string,
  periodStart: string,
  periodEnd: string,
  previousPeriodStart: string
): Promise<TeamBriefingPayload> {
  const employees = await getAssignedEmployees(ctx);
  const teamEmployees = employees.filter((e) => e.primaryTeamId === teamId);

  const metricsByEmployee = await getEmployeeMetricsBatch(
    ctx,
    teamEmployees.map((emp) => emp.id),
    teamId,
    periodStart,
    previousPeriodStart
  );
  const employeeMetrics = teamEmployees.map((emp) => ({
    employee: emp,
    metrics: metricsByEmployee.get(emp.id) ?? [],
  }));

  let allFreshness: Date | null = null;
  const statusCounts = { onTarget: 0, warning: 0, offTarget: 0, noData: 0 };
  const needsAttention: AttentionItem[] = [];
  const notableImprovements: ImprovementItem[] = [];

  for (const { employee, metrics } of employeeMetrics) {
    const freshness = oldestFreshness(metrics);
    if (freshness && (!allFreshness || freshness < allFreshness)) {
      allFreshness = freshness;
    }

    const overall = deriveOverallStatus(metrics);
    if (overall === "on_track") statusCounts.onTarget++;
    else if (overall === "needs_attention") statusCounts.offTarget++;
    else if (overall === "no_data") statusCounts.noData++;
    else statusCounts.warning++;

    const changes = computeChanges(metrics);
    const declining = changes.filter(
      (c) =>
        c.changeDirection === "declined" &&
        c.changePercent !== null &&
        Math.abs(c.changePercent) >= 10
    );
    const improving = changes.filter(
      (c) =>
        c.changeDirection === "improved" &&
        c.changePercent !== null &&
        Math.abs(c.changePercent) >= 10
    );

    if (declining.length > 0) {
      needsAttention.push({
        employeeId: employee.id,
        employeeName: employee.displayName,
        reasons: declining.map((c) => ({
          text: c.evidence,
          evidence: [
            {
              type: "metric_value" as const,
              metricKey: c.metricKey,
              metricName: c.metricName,
              value: c.currentValue ?? undefined,
              comparisonValue: c.previousValue ?? undefined,
            },
          ],
        })),
      });
    }

    if (improving.length > 0) {
      notableImprovements.push({
        employeeId: employee.id,
        employeeName: employee.displayName,
        achievements: improving.map((c) => ({
          text: c.evidence,
          evidence: [
            {
              type: "metric_value" as const,
              metricKey: c.metricKey,
              metricName: c.metricName,
              value: c.currentValue ?? undefined,
              comparisonValue: c.previousValue ?? undefined,
            },
          ],
        })),
      });
    }
  }

  // Build team metric summaries for primary metrics
  const teamPerformance: TeamMetricSummary[] = [];
  if (employeeMetrics.length > 0) {
    const allMetricKeys = new Set<string>();
    for (const { metrics } of employeeMetrics) {
      for (const m of metrics) {
        if (m.isPrimary) allMetricKeys.add(m.key);
      }
    }

    for (const key of allMetricKeys) {
      const empValues = employeeMetrics
        .map(({ employee, metrics }) => {
          const m = metrics.find((met) => met.key === key);
          return m
            ? {
                employeeId: employee.id,
                employeeName: employee.displayName,
                currentValue: m.currentValue,
                previousValue: m.previousValue,
                status: m.status,
              }
            : null;
        })
        .filter((v): v is NonNullable<typeof v> => v !== null);

      const firstMetric = employeeMetrics.flatMap((em) => em.metrics).find((m) => m.key === key);
      if (!firstMetric) continue;

      const currentValues = empValues
        .map((v) => v.currentValue)
        .filter((v): v is number => v !== null);
      const previousValues = empValues
        .map((v) => v.previousValue)
        .filter((v): v is number => v !== null);

      teamPerformance.push({
        metricDefinitionId: firstMetric.definitionId,
        metricKey: key,
        metricName: firstMetric.name,
        unit: firstMetric.unit,
        valueType: firstMetric.valueType,
        direction: firstMetric.direction,
        teamAverage:
          currentValues.length > 0
            ? currentValues.reduce((a, b) => a + b, 0) / currentValues.length
            : null,
        previousTeamAverage:
          previousValues.length > 0
            ? previousValues.reduce((a, b) => a + b, 0) / previousValues.length
            : null,
        employeeValues: empValues,
      });
    }
  }

  return {
    meta: makeMeta(periodStart, periodEnd, allFreshness),
    teamName,
    employeeCount: teamEmployees.length,
    statusDistribution: statusCounts,
    needsAttention,
    notableImprovements,
    teamPerformance,
  };
}

export async function generateEmployeeSummary(
  ctx: ManagerContext,
  employeeId: string,
  employeeName: string,
  jobTitle: string | null,
  teamId: string,
  teamName: string,
  periodStart: string,
  periodEnd: string,
  previousPeriodStart: string
): Promise<EmployeeSummaryPayload> {
  const metrics = await getEmployeeMetrics(
    ctx,
    employeeId,
    teamId,
    periodStart,
    previousPeriodStart
  );
  const changes = computeChanges(metrics);
  const overallStatus = deriveOverallStatus(metrics);

  return {
    meta: makeMeta(periodStart, periodEnd, oldestFreshness(metrics)),
    employeeId,
    employeeName,
    jobTitle,
    teamName,
    executiveSummary: describeExecutiveSummary(employeeName, changes, overallStatus),
    changes,
    metricSnapshots: metricsToSnapshots(metrics),
    overallStatus,
  };
}

export async function generateOneOnOne(
  ctx: ManagerContext,
  employeeId: string,
  employeeName: string,
  jobTitle: string | null,
  teamId: string,
  teamName: string,
  periodStart: string,
  periodEnd: string,
  previousPeriodStart: string
): Promise<OneOnOnePayload> {
  const metrics = await getEmployeeMetrics(
    ctx,
    employeeId,
    teamId,
    periodStart,
    previousPeriodStart
  );
  const changes = computeChanges(metrics);

  const improving = changes.filter((c) => c.changeDirection === "improved");
  const declining = changes.filter((c) => c.changeDirection === "declined");

  const withTargets = metrics.filter((m) => m.status.status !== "no_target");
  const onTarget = withTargets.filter((m) => m.status.status === "on_target").length;

  const atAGlance = {
    metricsOnTarget: onTarget,
    metricsImproving: improving.length,
    metricsDeclining: declining.length,
    totalMetrics: metrics.length,
  };

  const whatToRecognize = generateRecognitionItems(changes);
  const whatToDiscuss = generateDiscussionItems(changes);

  return {
    meta: makeMeta(periodStart, periodEnd, oldestFreshness(metrics)),
    employeeId,
    employeeName,
    jobTitle,
    teamName,
    takeaway: describeTakeaway(employeeName, atAGlance, changes),
    atAGlance,
    whatChanged: changes,
    whatToRecognize,
    whatToDiscuss,
    suggestedQuestions: generateSuggestedQuestions(whatToDiscuss, whatToRecognize),
  };
}
