export type ValueType = "numeric" | "percentage" | "duration" | "count";

export type Direction = "higher_is_better" | "lower_is_better" | "neutral";

export type CalculationType = "latest" | "sum" | "average" | "min" | "max" | "count";

export type ObservationType =
  | "threshold_crossed_above"
  | "threshold_crossed_below"
  | "improving_trend"
  | "declining_trend"
  | "significant_change"
  | "streak";

export type Severity = "info" | "watch" | "attention" | "critical";

export type QualityStatus = "complete" | "partial" | "stale" | "missing";

export type TargetType = "minimum" | "maximum" | "exact" | "range";

export interface ResolvedTarget {
  targetValue: number;
  warningValue: number | null;
  targetType: TargetType;
  source: "employee" | "role" | "team" | "org";
  priority: number;
}

export interface MetricStatus {
  status: "on_target" | "warning" | "off_target" | "no_target" | "no_data";
  direction: Direction;
}

export function formatMetricValue(
  value: number,
  unit: string | null,
  valueType: ValueType
): string {
  switch (valueType) {
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "duration":
      if (unit === "min" || unit === "minutes") return `${value.toFixed(1)}m`;
      if (unit === "h" || unit === "hours") return `${value.toFixed(1)}h`;
      if (unit === "s" || unit === "seconds") return `${value.toFixed(0)}s`;
      return `${value.toFixed(1)}`;
    case "count":
      return value.toFixed(0);
    case "numeric":
    default:
      return value.toFixed(1);
  }
}
