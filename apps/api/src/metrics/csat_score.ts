import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { roundPercent } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['csat_score']!;

// Percent of the period's ANSWERED surveys rated good (commit 7: submitted-in-period
// semantics via the satisfaction_ratings endpoint — the week a customer answers is
// the week the rating counts, regardless of when the ticket was created or updated).
// Null when no survey was answered this period; 0 is a measured zero (all bad).
export function compute(data: ZendeskWeekData): number | null {
  let good = 0;
  let rated = 0;
  for (const r of data.ratings) {
    if (r.score === 'good' || r.score === 'bad') {
      rated++;
      if (r.score === 'good') good++;
    }
  }
  return rated === 0 ? null : roundPercent(good, rated);
}
