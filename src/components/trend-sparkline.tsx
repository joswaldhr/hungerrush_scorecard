import { useId } from "react";
import { cn } from "@/lib/utils";

function getSmoothPath(coords: Array<{ x: number; y: number }>): string {
  if (coords.length < 2) return "";
  if (coords.length === 2) {
    return `M ${coords[0]!.x.toFixed(1)},${coords[0]!.y.toFixed(1)} L ${coords[1]!.x.toFixed(1)},${coords[1]!.y.toFixed(1)}`;
  }
  let path = `M ${coords[0]!.x.toFixed(1)},${coords[0]!.y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i === 0 ? 0 : i - 1]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[i + 2 < coords.length ? i + 2 : i + 1]!;

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

export function TrendSparkline({
  values,
  direction,
  width = 96,
  height = 24,
  className,
}: {
  values: Array<number | null>;
  direction: "higher_is_better" | "lower_is_better" | "neutral";
  width?: number;
  height?: number;
  className?: string;
}) {
  const gradientId = useId();
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
  const padY = 4;
  const stepX = values.length > 1 ? (width - 8) / (values.length - 1) : 0;

  const coords = points.map((p) => ({
    x: 4 + p.i * stepX,
    y: height - padY - ((p.v - min) / range) * (height - padY * 2),
  }));

  const smoothPath = getSmoothPath(coords);
  const first = points[0]!.v;
  const last = points[points.length - 1]!.v;
  const isFlat = first === last;
  const improved = !isFlat && (direction === "higher_is_better" ? last > first : last < first);
  const declined = !isFlat && (direction === "higher_is_better" ? last < first : last > first);

  const strokeColor = improved ? "#10b981" : declined ? "#ef4444" : "#009ca6";

  const label = improved
    ? `Trending up from ${first} to ${last}`
    : declined
      ? `Trending down from ${first} to ${last}`
      : `Stable at ${last}`;
  const lastCoord = coords[coords.length - 1]!;
  const firstCoord = coords[0]!;
  const areaPath = `${smoothPath} L ${lastCoord.x.toFixed(1)},${height} L ${firstCoord.x.toFixed(1)},${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />
      <path
        d={smoothPath}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={lastCoord.x}
        cy={lastCoord.y}
        r={3}
        fill={strokeColor}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
    </svg>
  );
}
