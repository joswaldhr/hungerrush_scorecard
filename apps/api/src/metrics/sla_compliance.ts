import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { collectReplySeconds, roundPercent } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['sla_compliance']!;

// Percent of replies within the SLA target. Null when no SLA policy is configured
// (slaTargetMinutes null — true in prod today) or no ticket has a reply metric.
// Deliberately still computed over the full UPDATED-in-period set — the L1
// created-in-period split (commit 7) covered first_reply_time and resolution_rate
// only; SLA semantics get decided when the metric is activated (release plan W4).
export function compute(data: ZendeskWeekData): number | null {
  if (data.slaTargetMinutes === null) return null;
  const replySeconds = collectReplySeconds(data.tickets, data.metricSets);
  if (replySeconds.length === 0) return null;
  const targetSeconds = data.slaTargetMinutes * 60;
  const met = replySeconds.filter(s => s <= targetSeconds).length;
  return roundPercent(met, replySeconds.length);
}
