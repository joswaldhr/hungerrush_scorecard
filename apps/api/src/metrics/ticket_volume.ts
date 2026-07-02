import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['ticket_volume']!;

// 0 when the agent had no tickets — a measured zero, always written (never null).
export function compute(data: ZendeskWeekData): number | null {
  return data.tickets.length;
}
