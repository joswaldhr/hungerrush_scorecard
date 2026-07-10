import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['ob_talk_time']!;

export function compute(data: ZendeskWeekData): number | null {
  const calls = data.calls.filter(c => c.direction === 'outbound');
  if (calls.length === 0) return null;
  const total = calls.reduce((sum, c) => sum + (c => c.talk_time)(c), 0);
  return Math.round(total / calls.length);
}
