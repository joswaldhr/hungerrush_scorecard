import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { roundPercent } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['resolution_rate']!;

// Percent of the week's tickets solved or closed. Null for an empty week;
// 0 is a measured zero (tickets exist, none resolved). The old computeAllMetrics
// had an unreachable inner null-guard here (L9) — folded into the empty-week
// early return with identical observable behavior.
export function compute(data: ZendeskWeekData): number | null {
  if (data.tickets.length === 0) return null;
  const resolved = data.tickets.filter(t => t.status === 'solved' || t.status === 'closed').length;
  return roundPercent(resolved, data.tickets.length);
}
