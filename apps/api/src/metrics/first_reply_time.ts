import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { collectReplySeconds } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['first_reply_time']!;

// Average first-reply time in seconds (Zendesk business-hours minutes × 60).
// Null when no ticket in the week has a reply metric (includes the empty-week case).
export function compute(data: ZendeskWeekData): number | null {
  const replySeconds = collectReplySeconds(data);
  if (replySeconds.length === 0) return null;
  return Math.round(replySeconds.reduce((a, b) => a + b, 0) / replySeconds.length);
}
