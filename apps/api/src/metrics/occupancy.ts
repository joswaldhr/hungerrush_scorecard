import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { AssembledWeekData } from './types';
import { toIntervals, totalDuration } from './intervals';

export const spec: MetricSpec = METRIC_SPECS['occupancy']!;

// Time in productive states / total logged-in time (excluding Offline).
// L6 fix (commit 10): when NO state name matches the productive set, the mapping
// doesn't apply — that is "no measurement" (null, no row), not a measured 0%.
// Prod wrote 100%-zero occupancy rows for 63 agents this way (corrected in 10b).
export function compute(data: AssembledWeekData): number | null {
  const productiveStates = data.states.filter(s => data.productiveStateNames.has(s.state));
  if (productiveStates.length === 0) return null;
  const loggedIn = toIntervals(data.states.filter(s => s.state !== 'Offline'));
  const loggedInTotal = totalDuration(loggedIn);
  if (loggedInTotal === 0) return null;
  return Math.round((totalDuration(toIntervals(productiveStates)) / loggedInTotal) * 10000) / 100;
}
