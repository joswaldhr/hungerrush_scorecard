import type { Direction, ObservationType, Severity, ResolvedTarget } from "./types";

export interface DetectedObservation {
  observationType: ObservationType;
  severity: Severity;
  title: string;
  explanation: string;
  currentValue: number;
  comparisonValue: number | null;
  targetValue: number | null;
}

interface ObservationInput {
  metricName: string;
  direction: Direction;
  currentValue: number;
  previousValue: number | null;
  target: ResolvedTarget | null;
  history: number[];
}

const SIGNIFICANT_CHANGE_THRESHOLD = 0.1; // 10%
const STREAK_LENGTH = 3;

export function detectObservations(input: ObservationInput): DetectedObservation[] {
  const results: DetectedObservation[] = [];

  if (input.target) {
    const threshold = detectThresholdCrossing(input);
    if (threshold) results.push(threshold);
  }

  if (input.previousValue !== null) {
    const change = detectSignificantChange(input);
    if (change) results.push(change);
  }

  if (input.history.length >= STREAK_LENGTH) {
    const trend = detectTrend(input);
    if (trend) results.push(trend);
  }

  return results;
}

function detectThresholdCrossing(input: ObservationInput): DetectedObservation | null {
  const { currentValue, previousValue, target, metricName, direction } = input;
  if (!target || previousValue === null) return null;

  const { targetValue } = target;
  const isHigherBetter = direction === "higher_is_better";

  const wasOnTarget = isHigherBetter ? previousValue >= targetValue : previousValue <= targetValue;
  const isOnTarget = isHigherBetter ? currentValue >= targetValue : currentValue <= targetValue;

  if (wasOnTarget && !isOnTarget) {
    return {
      observationType: isHigherBetter ? "threshold_crossed_below" : "threshold_crossed_above",
      severity: "attention",
      title: `${metricName} dropped below target`,
      explanation: `${metricName} fell from ${previousValue} to ${currentValue}, crossing the target of ${targetValue}.`,
      currentValue,
      comparisonValue: previousValue,
      targetValue,
    };
  }

  if (!wasOnTarget && isOnTarget) {
    return {
      observationType: isHigherBetter ? "threshold_crossed_above" : "threshold_crossed_below",
      severity: "info",
      title: `${metricName} reached target`,
      explanation: `${metricName} improved from ${previousValue} to ${currentValue}, meeting the target of ${targetValue}.`,
      currentValue,
      comparisonValue: previousValue,
      targetValue,
    };
  }

  return null;
}

function detectSignificantChange(input: ObservationInput): DetectedObservation | null {
  const { currentValue, previousValue, metricName, direction } = input;
  if (previousValue === null || previousValue === 0) return null;

  const changeRatio = (currentValue - previousValue) / Math.abs(previousValue);
  if (Math.abs(changeRatio) < SIGNIFICANT_CHANGE_THRESHOLD) return null;

  const isImprovement =
    direction === "neutral"
      ? false
      : direction === "higher_is_better"
        ? changeRatio > 0
        : changeRatio < 0;

  const pctChange = Math.abs(changeRatio * 100).toFixed(1);
  const verb = changeRatio > 0 ? "increased" : "decreased";

  return {
    observationType: "significant_change",
    severity: isImprovement ? "info" : "watch",
    title: `${metricName} ${verb} ${pctChange}%`,
    explanation: `${metricName} ${verb} from ${previousValue} to ${currentValue} (${pctChange}% ${changeRatio > 0 ? "increase" : "decrease"}).`,
    currentValue,
    comparisonValue: previousValue,
    targetValue: input.target?.targetValue ?? null,
  };
}

function detectTrend(input: ObservationInput): DetectedObservation | null {
  const { history, metricName, direction, currentValue } = input;
  if (history.length < STREAK_LENGTH) return null;

  const recent = history.slice(-STREAK_LENGTH);
  const allIncreasing = recent.every((v, i) => i === 0 || v > recent[i - 1]!);
  const allDecreasing = recent.every((v, i) => i === 0 || v < recent[i - 1]!);

  if (!allIncreasing && !allDecreasing) return null;

  const isImprovement =
    direction === "neutral"
      ? false
      : direction === "higher_is_better"
        ? allIncreasing
        : allDecreasing;

  const trendDirection = allIncreasing ? "upward" : "downward";

  return {
    observationType: isImprovement ? "improving_trend" : "declining_trend",
    severity: isImprovement ? "info" : "watch",
    title: `${metricName} trending ${trendDirection}`,
    explanation: `${metricName} has been ${trendDirection} for ${STREAK_LENGTH} consecutive periods.`,
    currentValue,
    comparisonValue: recent[0] ?? null,
    targetValue: input.target?.targetValue ?? null,
  };
}
