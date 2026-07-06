import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { AssembledWeekData } from './types';
import { overlapDuration, toIntervals, totalDuration } from './intervals';

export const spec: MetricSpec = METRIC_SPECS['schedule_adherence']!;

// Overlap of productive states with scheduled productive time / total scheduled time.
// L6 fix (commit 10): when NO state name matches the productive set, the mapping
// doesn't apply — null (no row), not a measured 0%. A zero OVERLAP with matching
// states (worked entirely off-schedule) remains a measured 0.
export function compute(data: AssembledWeekData): number | null {
  const scheduled = toIntervals(data.activities.filter(a => data.productiveTypeIds.has(a.type_id)));
  const scheduledTotal = totalDuration(scheduled);
  if (scheduledTotal === 0) return null;
  const actualStates = data.states.filter(s => data.productiveStateNames.has(s.state));
  if (actualStates.length === 0) return null;
  return Math.round((overlapDuration(scheduled, toIntervals(actualStates)) / scheduledTotal) * 10000) / 100;
}
