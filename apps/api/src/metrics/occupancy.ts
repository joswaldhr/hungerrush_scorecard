import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { AssembledWeekData } from './types';
import { toIntervals, totalDuration } from './intervals';

export const spec: MetricSpec = METRIC_SPECS['occupancy']!;

// Time in productive states / total logged-in time (excluding Offline).
// PRESERVE-FOR-PARITY (L6): when logged-in time exists but no state name matches the
// productive set, this returns 0 (not null) — fixed in Phase 1C commit 10.
export function compute(data: AssembledWeekData): number | null {
  const loggedIn = toIntervals(data.states.filter(s => s.state !== 'Offline'));
  const productive = toIntervals(data.states.filter(s => data.productiveStateNames.has(s.state)));
  const loggedInTotal = totalDuration(loggedIn);
  if (loggedInTotal === 0) return null;
  return Math.round((totalDuration(productive) / loggedInTotal) * 10000) / 100;
}
