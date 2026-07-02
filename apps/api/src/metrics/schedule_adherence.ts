import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { AssembledWeekData } from './types';
import { overlapDuration, toIntervals, totalDuration } from './intervals';

export const spec: MetricSpec = METRIC_SPECS['schedule_adherence']!;

// Overlap of productive states with scheduled productive time / total scheduled time.
// PRESERVE-FOR-PARITY (L6): when scheduled time exists but no state name matches the
// productive set, this returns 0 (not null) — fixed in Phase 1C commit 10.
export function compute(data: AssembledWeekData): number | null {
  const scheduled = toIntervals(data.activities.filter(a => data.productiveTypeIds.has(a.type_id)));
  const actual = toIntervals(data.states.filter(s => data.productiveStateNames.has(s.state)));
  const scheduledTotal = totalDuration(scheduled);
  if (scheduledTotal === 0) return null;
  return Math.round((overlapDuration(scheduled, actual) / scheduledTotal) * 10000) / 100;
}
