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

export type TargetType = "minimum" | "maximum" | "exact" | "range";

export interface ResolvedTarget {
  // Null for "range" targets, which use targetMin/targetMax instead.
  targetValue: number | null;
  warningValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  targetType: TargetType;
  source: "employee" | "role" | "team" | "org";
  priority: number;
}

export interface MetricStatus {
  status: "on_target" | "warning" | "off_target" | "no_target" | "no_data";
  direction: Direction;
}

export const DURATION_FORMAT_LABEL = "H:MM:SS (hours:minutes:seconds)";
export const DURATION_CLOCK_NOTE =
  "Ticket response and resolution use business time; call metrics use elapsed time.";

/** Convert at presentation only. Stored units and target calculations stay unchanged. */
export function formatDuration(value: number, unit: string | null): string {
  const scale = new Map([
    ["s", 1],
    ["seconds", 1],
    ["min", 60],
    ["minutes", 60],
    ["h", 3600],
    ["hours", 3600],
  ]).get(unit ?? "");
  if (scale === undefined) return `${value.toFixed(1)}${unit ? ` ${unit}` : ""}`;
  const seconds = Math.round(Math.abs(value) * scale);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return `${value < 0 && seconds > 0 ? "−" : ""}${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
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
      return formatDuration(value, unit);
    case "count":
      return value.toFixed(0);
    case "numeric":
    default:
      return value.toFixed(1);
  }
}
