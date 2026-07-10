import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['ib_calls_answered']!;

export function compute(data: ZendeskWeekData): number | null {
  const calls = data.calls.filter(c => c.direction === 'inbound' && c.completion_status === 'completed');
  if (calls.length === 0) return null;
  return calls.length;
}
