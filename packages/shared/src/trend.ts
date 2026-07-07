// The ONE trend definition (Phase 3 Cadence — supersedes every earlier trend
// computation; ADOPTION.md decision 4). Everything that says "improving",
// "discuss", or draws a tone dot derives from assessTrend:
//
//   current value vs the PRIOR-PERIOD AVERAGE (mean of up to the 4 points
//   immediately preceding the current one) · ±6% steady threshold ·
//   direction-aware · band metrics = healthy range, not a direction ·
//   fewer than 4 points = "new" (trends unlock at week 4).
//
// Applies identically to scorecard rows, rollup chips, and frozen last-week
// views — callers pass whatever chronological window they mean; the last
// value IS "current" for that view. Pure functions, no Date, no I/O.
import type { MetricDirection } from './schemas';

export type TrendTone = 'win' | 'discuss' | 'steady' | 'new';

export const TREND_STEADY_PCT = 6;
export const TREND_MIN_POINTS = 4;
export const TREND_PRIOR_WINDOW = 4;

export interface TrendAssessment {
  tone: TrendTone;
  /** Latest value in the window (null only for an empty window). */
  current: number | null;
  /** Mean of the prior window; null when sparse ("new"). */
  priorAverage: number | null;
  /** current − priorAverage; null when sparse. */
  absoluteChange: number | null;
  /** Percent change vs priorAverage; null when sparse OR priorAverage is 0. */
  pctChange: number | null;
}

/**
 * Assess one metric's trend from chronological values (oldest first, the last
 * value is "current" for the caller's view). Missing weeks are simply absent —
 * the prior average is over available points, capped at TREND_PRIOR_WINDOW.
 * A band (healthy range, inclusive) overrides direction: in-band = steady,
 * outside = discuss; band metrics have no "win" state.
 */
export function assessTrend(
  values: number[],
  direction: MetricDirection,
  band?: readonly [number, number],
): TrendAssessment {
  const current = values.length > 0 ? values[values.length - 1]! : null;

  if (values.length < TREND_MIN_POINTS || current === null) {
    return { tone: 'new', current, priorAverage: null, absoluteChange: null, pctChange: null };
  }

  const priors = values.slice(
    Math.max(0, values.length - 1 - TREND_PRIOR_WINDOW),
    values.length - 1,
  );
  const priorAverage = priors.reduce((a, b) => a + b, 0) / priors.length;
  const absoluteChange = current - priorAverage;
  const pctChange = priorAverage === 0 ? null : (absoluteChange / priorAverage) * 100;

  if (band) {
    const [lo, hi] = band;
    const tone: TrendTone = current >= lo && current <= hi ? 'steady' : 'discuss';
    return { tone, current, priorAverage, absoluteChange, pctChange };
  }

  let tone: TrendTone;
  if (pctChange === null) {
    // Prior average is 0: no percentage exists. Same-as-prior stays steady;
    // any movement off zero is judged by direction alone.
    tone =
      absoluteChange === 0 ? 'steady'
        : (absoluteChange > 0) === (direction === 'higher_is_better') ? 'win'
          : 'discuss';
  } else {
    const signed = direction === 'lower_is_better' ? -pctChange : pctChange;
    tone = signed >= TREND_STEADY_PCT ? 'win' : signed <= -TREND_STEADY_PCT ? 'discuss' : 'steady';
  }
  return { tone, current, priorAverage, absoluteChange, pctChange };
}

/**
 * Resolve a sparkline's y-scale: the spec domain is the MINIMUM extent (so a
 * small wiggle can never be zoomed into a cliff — honest by construction);
 * out-of-range data extends the edge rather than clipping (never lie about
 * outliers). No spec domain: the data's own extent.
 */
export function resolveDomain(
  specDomain: readonly [number, number] | undefined,
  values: number[],
): [number, number] {
  const dataLo = values.length > 0 ? Math.min(...values) : 0;
  const dataHi = values.length > 0 ? Math.max(...values) : 0;
  if (!specDomain) return [dataLo, dataHi];
  return [Math.min(specDomain[0], dataLo), Math.max(specDomain[1], dataHi)];
}
