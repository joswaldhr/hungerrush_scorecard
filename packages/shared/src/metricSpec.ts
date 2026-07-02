// MetricSpec — code-side identity + labels for each metric (Phase 1B registry refactor).
// name / coaching_prompt / display_order / is_active stay DB-owned (admin-editable at
// runtime in metric_definitions). MetricSpec owns what the DB doesn't have: which source
// computes the metric and the two UI labels that were previously hardcoded per component
// (KpiTile NULL_LABELS, RollupPage SHORT_NAMES — D10/S11 in docs/refactor-plan.md).
// Specs are isomorphic data: the api registry and the web components both import this map.
import type { MetricDirection, MetricSource } from './schemas';

export type MetricUnit = 'count' | 'percent' | 'seconds';

export interface MetricSpec {
  key: string;
  source: MetricSource;
  unit: MetricUnit;
  direction: MetricDirection;
  /** KpiTile copy when the value is null ("no data" — never a performance judgment). */
  nullLabel: string;
  /** Rollup trend-chip label. */
  shortLabel: string;
}

export const METRIC_SPECS: Readonly<Record<string, MetricSpec>> = {
  ticket_volume: {
    key: 'ticket_volume',
    source: 'zendesk',
    unit: 'count',
    direction: 'higher_is_better',
    nullLabel: 'No data yet',
    shortLabel: 'Tickets',
  },
  first_reply_time: {
    key: 'first_reply_time',
    source: 'zendesk',
    unit: 'seconds',
    direction: 'lower_is_better',
    nullLabel: 'No data yet',
    shortLabel: 'First Reply',
  },
  csat_score: {
    key: 'csat_score',
    source: 'zendesk',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No ratings yet',
    shortLabel: 'CSAT',
  },
  sla_compliance: {
    key: 'sla_compliance',
    source: 'zendesk',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'Not configured',
    shortLabel: 'SLA',
  },
  resolution_rate: {
    key: 'resolution_rate',
    source: 'zendesk',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No data yet',
    shortLabel: 'Resolution',
  },
  schedule_adherence: {
    key: 'schedule_adherence',
    source: 'assembled',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Adherence',
  },
  occupancy: {
    key: 'occupancy',
    source: 'assembled',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Occupancy',
  },
  handle_time: {
    key: 'handle_time',
    source: 'assembled',
    unit: 'seconds',
    direction: 'lower_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Handle Time',
  },
};
