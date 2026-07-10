import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { AssembledWeekData } from './types';
import { toIntervals, totalDuration } from './intervals';

export const spec: MetricSpec = METRIC_SPECS['transfer_hours']!;

export function compute(data: AssembledWeekData): number | null {
  const states = data.states.filter(s => s.state === 'Transfer');
  if (states.length === 0) return null;
  return totalDuration(toIntervals(states));
}
