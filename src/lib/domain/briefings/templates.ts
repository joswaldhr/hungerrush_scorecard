import type { ValueType } from "../metrics/types";
import { formatMetricValue } from "../metrics/types";
import type { EvidencedStatement, EvidenceRef, MetricChange } from "./types";

export function describeChange(change: MetricChange): string {
  if (change.currentValue === null) return `${change.metricName}: no data this period`;
  if (change.previousValue === null)
    return `${change.metricName}: ${formatValue(change.currentValue, change.unit, change.valueType)} (first period)`;

  const formatted = formatValue(change.currentValue, change.unit, change.valueType);
  const prev = formatValue(change.previousValue, change.unit, change.valueType);

  if (change.changePercent === null || Math.abs(change.changePercent) < 1) {
    return `${change.metricName}: ${formatted} (stable)`;
  }

  const dir = change.changePercent > 0 ? "up" : "down";
  const pct = Math.abs(change.changePercent).toFixed(0);
  return `${change.metricName}: ${formatted} (${dir} ${pct}% from ${prev})`;
}

export function describeExecutiveSummary(
  employeeName: string,
  changes: MetricChange[],
  overallStatus: "on_track" | "mixed" | "needs_attention" | "no_data"
): EvidencedStatement {
  const improving = changes.filter((c) => c.changeDirection === "improved");
  const declining = changes.filter((c) => c.changeDirection === "declined");

  let text: string;
  const evidence: EvidenceRef[] = [];

  if (overallStatus === "no_data") {
    text = `No metric data has been recorded for ${employeeName} yet.`;
  } else if (overallStatus === "on_track") {
    if (improving.length > 0) {
      text = `${employeeName} is performing well this week with improvements in ${improving.map((c) => c.metricName).join(", ")}.`;
      evidence.push(...improving.map((c) => makeEvidenceRef(c)));
    } else {
      text = `${employeeName} is maintaining steady performance this week.`;
    }
  } else if (overallStatus === "needs_attention") {
    const topConcern = declining[0];
    if (topConcern) {
      text = `${employeeName} needs attention this week. ${topConcern.metricName} ${describeChangeDirection(topConcern)}.`;
      evidence.push(makeEvidenceRef(topConcern));
    } else {
      text = `${employeeName} has metrics that need attention this week.`;
    }
  } else {
    text = `${employeeName} has a mixed week — ${improving.length} metric${improving.length !== 1 ? "s" : ""} improving, ${declining.length} declining.`;
    evidence.push(
      ...improving.map((c) => makeEvidenceRef(c)),
      ...declining.map((c) => makeEvidenceRef(c))
    );
  }

  return { text, evidence };
}

export function describeTakeaway(
  employeeName: string,
  atAGlance: {
    metricsOnTarget: number;
    metricsImproving: number;
    metricsDeclining: number;
    totalMetrics: number;
  },
  changes: MetricChange[]
): EvidencedStatement {
  if (changes.length > 0 && changes.every((c) => c.changeDirection === "new")) {
    return { text: `No metric data has been recorded for ${employeeName} yet.`, evidence: [] };
  }

  const evidence: EvidenceRef[] = changes.slice(0, 3).map((c) => makeEvidenceRef(c));

  if (atAGlance.metricsDeclining === 0 && atAGlance.metricsOnTarget === atAGlance.totalMetrics) {
    return {
      text: `${employeeName} is fully on target — all ${atAGlance.totalMetrics} metrics are meeting expectations.`,
      evidence,
    };
  }

  if (atAGlance.metricsDeclining > atAGlance.metricsImproving) {
    const declining = changes.filter((c) => c.changeDirection === "declined");
    const names = declining.map((c) => c.metricName).join(", ");
    return {
      text: `${employeeName} has ${atAGlance.metricsDeclining} declining metric${atAGlance.metricsDeclining !== 1 ? "s" : ""} (${names}) — worth discussing.`,
      evidence,
    };
  }

  if (atAGlance.metricsImproving > 0) {
    return {
      text: `${employeeName} is trending positively with ${atAGlance.metricsImproving} improving metric${atAGlance.metricsImproving !== 1 ? "s" : ""} this week.`,
      evidence,
    };
  }

  return {
    text: `${employeeName} is mostly stable this week across ${atAGlance.totalMetrics} metrics.`,
    evidence,
  };
}

export function generateRecognitionItems(changes: MetricChange[]): EvidencedStatement[] {
  return changes
    .filter(
      (c) =>
        c.changeDirection === "improved" &&
        c.changePercent !== null &&
        Math.abs(c.changePercent) >= 5
    )
    .map((c) => ({
      text: `${c.metricName} improved ${Math.abs(c.changePercent!).toFixed(0)}% this week (${formatValue(c.previousValue, c.unit, c.valueType)} to ${formatValue(c.currentValue, c.unit, c.valueType)}).`,
      evidence: [makeEvidenceRef(c)],
    }));
}

export function generateDiscussionItems(changes: MetricChange[]): EvidencedStatement[] {
  return changes
    .filter(
      (c) =>
        c.changeDirection === "declined" &&
        c.changePercent !== null &&
        Math.abs(c.changePercent) >= 5
    )
    .map((c) => ({
      text: `${c.metricName} declined ${Math.abs(c.changePercent!).toFixed(0)}% this week (${formatValue(c.previousValue, c.unit, c.valueType)} to ${formatValue(c.currentValue, c.unit, c.valueType)}).`,
      evidence: [makeEvidenceRef(c)],
    }));
}

export function generateSuggestedQuestions(
  discussionItems: EvidencedStatement[],
  recognitionItems: EvidencedStatement[]
): string[] {
  const questions: string[] = [];

  for (const item of discussionItems.slice(0, 2)) {
    const metricName = item.evidence[0]?.metricName ?? "this metric";
    questions.push(`What's been affecting your ${metricName} numbers this week?`);
  }

  for (const item of recognitionItems.slice(0, 1)) {
    const metricName = item.evidence[0]?.metricName ?? "your metrics";
    questions.push(`Your ${metricName} improved — what changed in your approach?`);
  }

  if (questions.length === 0) {
    questions.push("How are you feeling about your workload this week?");
  }

  return questions;
}

function describeChangeDirection(change: MetricChange): string {
  if (change.changePercent === null) return "changed";
  const dir = change.changePercent > 0 ? "increased" : "decreased";
  return `${dir} ${Math.abs(change.changePercent).toFixed(0)}%`;
}

function formatValue(value: number | null, unit: string | null, valueType: ValueType): string {
  if (value === null) return "no data";
  return formatMetricValue(value, unit, valueType);
}

function makeEvidenceRef(change: MetricChange): EvidenceRef {
  return {
    type: "metric_value",
    metricKey: change.metricKey,
    metricName: change.metricName,
    value: change.currentValue ?? undefined,
    comparisonValue: change.previousValue ?? undefined,
  };
}
