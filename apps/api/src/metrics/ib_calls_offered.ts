import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['ib_calls_offered']!;

export function compute(data: ZendeskWeekData): number | null {
  const calls = data.calls.filter(c => c.direction === 'inbound');
  return calls.length === 0 ? null : calls.length;
}
