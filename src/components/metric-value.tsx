import { formatMetricValue } from "@/lib/domain/metrics/types";
import type { ValueType } from "@/lib/domain/metrics/types";
import { cn } from "@/lib/utils";

export function MetricValue({
  value,
  unit,
  valueType,
  className,
}: {
  value: number | null;
  unit: string | null;
  valueType: ValueType;
  className?: string;
}) {
  if (value === null) {
    return <span className={cn("text-muted-foreground text-sm italic", className)}>—</span>;
  }

  return (
    <span className={cn("tabular-nums", className)}>
      {formatMetricValue(value, unit, valueType)}
    </span>
  );
}
