import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';
import { collectReplySeconds, roundPercent } from './zendeskCommon';

export const spec: MetricSpec = METRIC_SPECS['sla_compliance']!;

// Percent of replies within the SLA target. Null when no SLA policy is configured
// (slaTargetMinutes null — true in prod today) or no ticket has a reply metric.
export function compute(data: ZendeskWeekData): number | null {
  if (data.slaTargetMinutes === null) return null;
  const replySeconds = collectReplySeconds(data);
  if (replySeconds.length === 0) return null;
  const targetSeconds = data.slaTargetMinutes * 60;
  const met = replySeconds.filter(s => s <= targetSeconds).length;
  return roundPercent(met, replySeconds.length);
}
