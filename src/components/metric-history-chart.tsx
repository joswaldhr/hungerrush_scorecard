"use client";

import { useState, useId } from "react";
import { formatMetricValue } from "@/lib/domain/metrics/types";
import type { ValueType } from "@/lib/domain/metrics/types";
import { EmptyState } from "@/components/empty-state";
import { BarChart3 } from "lucide-react";

interface HistoryPoint {
  periodStart: string;
  value: number | null;
}

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
  const gradientId = useId();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const points = history
    .map((h, i) => (h.value === null ? null : { i, value: h.value }))
    .filter((p): p is { i: number; value: number } => p !== null);

  if (points.length < 2) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Not enough history yet"
        description="This chart will fill in as more weekly data is recorded."
      />
    );
  }

  const width = 640;
  const height = 220;
  const padLeft = 44;
  const padRight = 20;
  const padTop = 24;
  const padBottom = 32;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const values = points.map((p) => p.value);
  const allValues = target !== null ? [...values, target] : values;
  const rawMin = Math.min(...allValues);
  const rawMax = Math.max(...allValues);
  const span = rawMax - rawMin || 1;
  const min = Math.max(0, rawMin - span * 0.15);
  const max = rawMax + span * 0.15;
  const range = max - min || 1;

  const stepX = history.length > 1 ? plotWidth / (history.length - 1) : 0;
  const xFor = (i: number) => padLeft + i * stepX;
  const yFor = (v: number) => padTop + plotHeight - ((v - min) / range) * plotHeight;

  const coords = points.map((p) => ({
    x: xFor(p.i),
    y: yFor(p.value),
  }));

  const smoothLinePath = getSmoothPath(coords);
  const lastCoord = coords[coords.length - 1]!;
  const firstCoord = coords[0]!;
  const areaPath = `${smoothLinePath} L ${lastCoord.x.toFixed(1)},${padTop + plotHeight} L ${firstCoord.x.toFixed(1)},${padTop + plotHeight} Z`;

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => min + (range * i) / tickCount);

  // Pick up to 7 evenly spaced dates for x-axis
  const numLabels = Math.min(history.length, 7);
  const labelIndices = Array.from({ length: numLabels }, (_, i) =>
    Math.round((i * (history.length - 1)) / (numLabels - 1))
  ).filter((v, i, arr) => arr.indexOf(v) === i);

  // If no hover, highlight the last point as default
  const activeIdx = hoveredIdx !== null ? hoveredIdx : points[points.length - 1]!.i;
  const activePoint = points.find((p) => p.i === activeIdx) ?? points[points.length - 1]!;

  return (
    <div className="relative w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full select-none"
        role="img"
        aria-label="Historical performance chart"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#009ca6" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#009ca6" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {/* Grid lines & Y-axis labels */}
        {yTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="#e2e8f0"
              strokeWidth={1}
              strokeDasharray={i === 0 ? "none" : "3 3"}
            />
            <text
              x={padLeft - 8}
              y={yFor(tick) + 3}
              textAnchor="end"
              className="fill-slate-400 font-medium"
              fontSize={10}
            >
              {formatMetricValue(tick, unit, valueType)}
            </text>
          </g>
        ))}

        {/* Target line */}
        {target !== null && (
          <g>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={yFor(target)}
              y2={yFor(target)}
              stroke="#8b5cf6"
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={width - padRight}
              y={yFor(target) - 5}
              textAnchor="end"
              className="fill-purple-600 dark:fill-purple-400 font-semibold"
              fontSize={10}
            >
              Target ({formatMetricValue(target, unit, valueType)})
            </text>
          </g>
        )}

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${gradientId})`} stroke="none" />

        {/* Line */}
        <path
          d={smoothLinePath}
          fill="none"
          stroke="#009ca6"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((p) => {
          const isActive = p.i === activeIdx;
          return (
            <circle
              key={p.i}
              cx={xFor(p.i)}
              cy={yFor(p.value)}
              r={isActive ? 5 : 3}
              fill="#009ca6"
              stroke="#ffffff"
              strokeWidth={isActive ? 2 : 1.5}
            />
          );
        })}

        {/* Invisible hover zones */}
        {points.map((p) => (
          <rect
            key={`hover-${p.i}`}
            x={xFor(p.i) - stepX / 2}
            y={padTop}
            width={stepX}
            height={plotHeight}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(p.i)}
          />
        ))}

        {/* Active Tooltip / Callout Card */}
        {activePoint &&
          (() => {
            const tx = xFor(activePoint.i);
            const ty = yFor(activePoint.value);
            const dateStr = new Date(
              `${history[activePoint.i]!.periodStart}T00:00:00Z`
            ).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
            const val = formatMetricValue(activePoint.value, unit, valueType);

            // Shift card if near edges
            const cardWidth = 92;
            const cardHeight = 44;
            const clampX = Math.max(
              padLeft + cardWidth / 2,
              Math.min(width - padRight - cardWidth / 2, tx)
            );
            const cardY = ty > padTop + cardHeight + 10 ? ty - cardHeight - 8 : ty + 12;

            return (
              <g className="transition-all duration-150">
                {/* Vertical guide line */}
                <line
                  x1={tx}
                  x2={tx}
                  y1={padTop}
                  y2={padTop + plotHeight}
                  stroke="#009ca6"
                  strokeOpacity={0.4}
                  strokeWidth={1}
                  strokeDasharray="3 2"
                />
                {/* Callout box */}
                <rect
                  x={clampX - cardWidth / 2}
                  y={cardY}
                  width={cardWidth}
                  height={cardHeight}
                  rx={8}
                  className="fill-slate-900 shadow-md"
                />
                <text
                  x={clampX}
                  y={cardY + 16}
                  textAnchor="middle"
                  className="fill-slate-300 font-medium"
                  fontSize={10}
                >
                  Week of {dateStr}
                </text>
                <text
                  x={clampX}
                  y={cardY + 33}
                  textAnchor="middle"
                  className="fill-white font-bold"
                  fontSize={13}
                >
                  {val}
                </text>
              </g>
            );
          })()}

        {/* X-axis date labels */}
        {labelIndices.map((i) => (
          <text
            key={i}
            x={xFor(i)}
            y={height - 10}
            textAnchor="middle"
            className="fill-slate-400 font-medium"
            fontSize={10}
          >
            {new Date(`${history[i]!.periodStart}T00:00:00Z`).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
          </text>
        ))}
      </svg>
    </div>
  );
}
