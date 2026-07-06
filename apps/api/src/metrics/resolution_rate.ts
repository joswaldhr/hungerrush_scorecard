import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { roundPercent, ticketsCreatedInPeriod } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['resolution_rate']!;

// Percent of the tickets CREATED in the period already solved or closed (L1 split,
// commit 7). Null when nothing was created this period — even if older tickets were
// updated; 0 is a measured zero (new tickets exist, none resolved yet).
export function compute(data: ZendeskWeekData): number | null {
  const created = ticketsCreatedInPeriod(data);
  if (created.length === 0) return null;
  const resolved = created.filter(t => t.status === 'solved' || t.status === 'closed').length;
  return roundPercent(resolved, created.length);
}
