import { SPARK_BAND_FILL, SPARK_BASELINE } from './toneStyles';

interface CadenceSparklineProps {
  /** Calendar-mapped slots, oldest → newest; null = week without a snapshot. */
  slots: Array<{ value: number } | null>;
  /** Resolved y-scale (spec domain as minimum extent — honest by construction). */
  domain: [number, number];
  /** Healthy range to shade (band metrics). */
  band?: readonly [number, number];
  color: string;
  ariaLabel: string;
  width?: number;
  height?: number;
}

/**
 * Anchored line sparkline: y-scale is the resolved domain, never the data's
 * min/max, so a small wiggle can never look like a collapse. A missing week
 * breaks the line into segments instead of packing the gap (L5 semantics);
 * an isolated point renders as a dot.
 */
export function CadenceSparkline({
  slots,
  domain,
  band,
  color,
  ariaLabel,
  width = 100,
  height = 32,
}: CadenceSparklineProps) {
  const [lo, hi] = domain;
  const span = hi - lo || 1;
  const y = (v: number) => height - 3 - ((v - lo) / span) * (height - 6);
  const step = width / Math.max(slots.length - 1, 1);

  // Consecutive non-null runs become polyline segments.
  const segments: Array<Array<[number, number]>> = [];
  let run: Array<[number, number]> = [];
  slots.forEach((slot, i) => {
    if (slot === null) {
      if (run.length > 0) segments.push(run);
      run = [];
    } else {
      run.push([i * step, y(slot.value)]);
    }
  });
  if (run.length > 0) segments.push(run);

  const lastSegment = segments[segments.length - 1];
  const endPoint = lastSegment ? lastSegment[lastSegment.length - 1] : undefined;

  return (
    <svg
      width={width}
      height={height}
      className="overflow-visible flex-shrink-0"
      role="img"
      aria-label={ariaLabel}
    >
      {band && (
        <rect
          x="0"
          y={y(band[1])}
          width={width}
          height={Math.max(y(band[0]) - y(band[1]), 0)}
          fill={SPARK_BAND_FILL}
          opacity="0.12"
          rx="2"
        />
      )}
      <line x1="0" y1={y(lo)} x2={width} y2={y(lo)} stroke={SPARK_BASELINE} strokeWidth="1" />
      {segments.map((seg, i) =>
        seg.length === 1 ? (
          <circle key={i} cx={seg[0]![0]} cy={seg[0]![1]} r="2" fill={color} />
        ) : (
          <polyline
            key={i}
            points={seg.map(([px, py]) => `${px},${py}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ),
      )}
      {endPoint && <circle cx={endPoint[0]} cy={endPoint[1]} r="3.2" fill={color} />}
    </svg>
  );
}
