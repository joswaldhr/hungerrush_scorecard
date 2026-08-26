import { formatMetricValue } from "@/lib/domain/metrics/types";
import type { ValueType } from "@/lib/domain/metrics/types";
import { EmptyState } from "@/components/empty-state";

interface HistoryPoint {
  periodStart: string;
  value: number | null;
}

export function MetricHistoryChart({
  history,
  target,
  unit,
  valueType,
}: {
  history: HistoryPoint[];
  target: number | null;
  unit: string | null;
  valueType: ValueType;
}) {
  const points = history
    .map((h, i) => (h.value === null ? null : { i, value: h.value }))
    .filter((p): p is { i: number; value: number } => p !== null);

  if (points.length < 2) {
    return (
      <EmptyState
        title="Not enough history yet"
        description="This chart will fill in as more weekly data is recorded."
      />
    );
  }

  const width = 640;
  const height = 220;
  const padLeft = 44;
  const padRight = 16;
  const padTop = 16;
  const padBottom = 28;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const values = points.map((p) => p.value);
  const allValues = target !== null ? [...values, target] : values;
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || 1;
  const min = rawMin - span * 0.1;
  const max = rawMax + span * 0.1;
  const range = max - min || 1;

  const stepX = history.length > 1 ? plotWidth / (history.length - 1) : 0;
  const xFor = (i: number) => padLeft + i * stepX;
  const yFor = (v: number) => padTop + plotHeight - ((v - min) / range) * plotHeight;

  const path = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${xFor(p.i).toFixed(1)},${yFor(p.value).toFixed(1)}`)
    .join(" ");

  const areaPath = `${path} L${xFor(points[points.length - 1]!.i).toFixed(1)},${(padTop + plotHeight).toFixed(1)} L${xFor(points[0]!.i).toFixed(1)},${(padTop + plotHeight).toFixed(1)} Z`;

  const tickCount = 3;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => min + (range * i) / tickCount);

  const labelIndices = [0, Math.floor((history.length - 1) / 2), history.length - 1].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Historical performance chart"
    >
      {yTicks.map((tick, i) => (
        <g key={i}>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={yFor(tick)}
            y2={yFor(tick)}
            stroke="oklch(var(--border))"
            strokeWidth={1}
          />
          <text
            x={padLeft - 8}
            y={yFor(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground"
            fontSize={10}
          >
            {formatMetricValue(tick, unit, valueType)}
          </text>
        </g>
      ))}

      {target !== null && (
        <>
          <line
            x1={padLeft}
            x2={width - padRight}
            y1={yFor(target)}
            y2={yFor(target)}
            stroke="oklch(var(--status-neutral))"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={width - padRight}
            y={yFor(target) - 4}
            textAnchor="end"
            className="fill-muted-foreground"
            fontSize={10}
          >
            Target ({formatMetricValue(target, unit, valueType)})
          </text>
        </>
      )}

      <path d={areaPath} fill="oklch(var(--accent) / 0.08)" stroke="none" />
      <path
        d={path}
        fill="none"
        stroke="oklch(var(--accent))"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p) => (
        <circle key={p.i} cx={xFor(p.i)} cy={yFor(p.value)} r={2.5} fill="oklch(var(--accent))" />
      ))}

      {labelIndices.map((i) => (
        <text
          key={i}
          x={xFor(i)}
          y={height - 8}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize={10}
        >
          {new Date(`${history[i]!.periodStart}T00:00:00Z`).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </text>
      ))}
    </svg>
  );
}
