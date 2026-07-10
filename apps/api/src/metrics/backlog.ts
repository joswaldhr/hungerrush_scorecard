import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['backlog']!;

export function compute(data: ZendeskWeekData): number | null {
  return data.openTickets.length;
}
