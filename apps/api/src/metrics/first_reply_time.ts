import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { collectReplySeconds, ticketsCreatedInPeriod } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['first_reply_time']!;

// Average first-reply time in seconds (Zendesk business-hours minutes × 60) over
// tickets CREATED in the period (L1 split, commit 7) — a reworked old ticket's
// months-old reply time no longer enters the average.
// Null when no created-in-period ticket has a reply metric.
export function compute(data: ZendeskWeekData): number | null {
  const replySeconds = collectReplySeconds(ticketsCreatedInPeriod(data), data.metricSets);
  if (replySeconds.length === 0) return null;
  return Math.round(replySeconds.reduce((a, b) => a + b, 0) / replySeconds.length);
}
