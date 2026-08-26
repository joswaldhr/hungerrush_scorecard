import { cn } from "@/lib/utils";

export function TrendSparkline({
  values,
  direction,
  width = 72,
  height = 24,
  className,
}: {
  values: Array<number | null>;
  direction: "higher_is_better" | "lower_is_better" | "neutral";
  width?: number;
  height?: number;
  className?: string;
}) {
  const points = values
    .map((v, i) => (v === null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p !== null);

  if (points.length < 2) {
    return (
      <span className={cn("inline-flex items-center text-xs text-muted-foreground", className)}>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Not enough history yet</span>
      </span>
    );
  }

  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const range = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : 0;

  const coords = points.map((p) => ({
    x: p.i * stepX,
    y: height - ((p.v - min) / range) * (height - 4) - 2,
  }));

  const path = coords
    .map((c, idx) => `${idx === 0 ? "M" : "L"}${c.x.toFixed(1)},${c.y.toFixed(1)}`)
    .join(" ");

  const first = points[0]!.v;
  const last = points[points.length - 1]!.v;
  const isFlat = first === last;
  const improved = !isFlat && (direction === "higher_is_better" ? last > first : last < first);
  const declined = !isFlat && (direction === "higher_is_better" ? last < first : last > first);

  const colorVar = improved
    ? "var(--status-on-track)"
    : declined
      ? "var(--status-attention)"
      : "var(--status-neutral)";

  const label = improved ? "Trending up" : declined ? "Trending down" : "Stable";
  const lastCoord = coords[coords.length - 1]!;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={label}
    >
      <path
        d={path}
        fill="none"
        stroke={`oklch(${colorVar})`}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastCoord.x} cy={lastCoord.y} r={2} fill={`oklch(${colorVar})`} />
    </svg>
  );
}
