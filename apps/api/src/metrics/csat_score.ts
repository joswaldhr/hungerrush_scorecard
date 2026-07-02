import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { roundPercent } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['csat_score']!;

// Percent of rated tickets rated good. Null when nothing was rated good/bad
// (includes the empty-week case); 0 is a measured zero (every rating bad).
export function compute(data: ZendeskWeekData): number | null {
  let good = 0;
  let rated = 0;
  for (const t of data.tickets) {
    const score = t.satisfaction_rating?.score;
    if (score === 'good' || score === 'bad') {
      rated++;
      if (score === 'good') good++;
    }
  }
  return rated === 0 ? null : roundPercent(good, rated);
}
