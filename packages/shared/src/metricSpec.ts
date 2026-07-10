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
  /**
   * Fixed sparkline scale [min, max] (Cadence honest charts): the MINIMUM
   * y-extent — small wiggles look small; out-of-range data extends the edge
   * (see resolveDomain in trend.ts). Display-only, no DB counterpart.
   */
  domain?: readonly [number, number];
  /**
   * Healthy range [lo, hi] (inclusive) — a band metric has no good direction:
   * in-band = steady, outside = discuss. Overrides `direction` for trend tone
   * and shades the range on sparklines. The DB `direction` enum stays as-is;
   * a band enum migration is deferred until a second band metric appears
   * (ADOPTION.md).
   */
  band?: readonly [number, number];
}

export const METRIC_SPECS: Readonly<Record<string, MetricSpec>> = {
  ticket_volume: {
    key: 'ticket_volume',
    source: 'zendesk',
    unit: 'count',
    direction: 'higher_is_better',
    nullLabel: 'No data yet',
    shortLabel: 'Tickets',
    domain: [0, 70],
  },
  first_reply_time: {
    key: 'first_reply_time',
    source: 'zendesk',
    unit: 'seconds',
    direction: 'lower_is_better',
    nullLabel: 'No data yet',
    shortLabel: 'First Reply',
    domain: [0, 3600],
  },
  csat_score: {
    key: 'csat_score',
    source: 'zendesk',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No ratings yet',
    shortLabel: 'CSAT',
    domain: [70, 100],
  },
  sla_compliance: {
    key: 'sla_compliance',
    source: 'zendesk',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'Not configured',
    shortLabel: 'SLA',
    domain: [0, 100],
  },
  resolution_rate: {
    key: 'resolution_rate',
    source: 'zendesk',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No data yet',
    shortLabel: 'Resolution',
    domain: [0, 100],
  },
  schedule_adherence: {
    key: 'schedule_adherence',
    source: 'assembled',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Adherence',
    domain: [60, 100],
  },
  occupancy: {
    key: 'occupancy',
    source: 'assembled',
    unit: 'percent',
    direction: 'higher_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Occupancy',
    domain: [55, 100],
    band: [75, 88],
  },
  handle_time: {
    key: 'handle_time',
    source: 'assembled',
    unit: 'seconds',
    direction: 'lower_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Handle Time',
    domain: [0, 3600],
  },
  ib_calls_offered: {
    key: 'ib_calls_offered',
    source: 'zendesk',
    unit: 'count',
    direction: 'higher_is_better',
    nullLabel: 'No inbound calls',
    shortLabel: 'IB Offered',
  },
  ib_calls_answered: {
    key: 'ib_calls_answered',
    source: 'zendesk',
    unit: 'count',
    direction: 'higher_is_better',
    nullLabel: 'No inbound calls',
    shortLabel: 'IB Answered',
  },
  ib_calls_declined: {
    key: 'ib_calls_declined',
    source: 'zendesk',
    unit: 'count',
    direction: 'lower_is_better',
    nullLabel: 'No inbound calls',
    shortLabel: 'IB Declined',
  },
  ib_calls_missed: {
    key: 'ib_calls_missed',
    source: 'zendesk',
    unit: 'count',
    direction: 'lower_is_better',
    nullLabel: 'No inbound calls',
    shortLabel: 'IB Missed',
  },
  ib_talk_time: {
    key: 'ib_talk_time',
    source: 'zendesk',
    unit: 'seconds',
    direction: 'lower_is_better',
    nullLabel: 'No inbound calls',
    shortLabel: 'IB Talk Time',
  },
  ob_talk_time: {
    key: 'ob_talk_time',
    source: 'zendesk',
    unit: 'seconds',
    direction: 'lower_is_better',
    nullLabel: 'No outbound calls',
    shortLabel: 'OB Talk Time',
  },
  ob_calls: {
    key: 'ob_calls',
    source: 'zendesk',
    unit: 'count',
    direction: 'higher_is_better',
    nullLabel: 'No outbound calls',
    shortLabel: 'OB Calls',
  },
  tickets_assigned: {
    key: 'tickets_assigned',
    source: 'zendesk',
    unit: 'count',
    direction: 'higher_is_better',
    nullLabel: 'No tickets',
    shortLabel: 'Assigned',
  },
  backlog: {
    key: 'backlog',
    source: 'zendesk',
    unit: 'count',
    direction: 'lower_is_better',
    nullLabel: 'No backlog',
    shortLabel: 'Backlog',
  },
  away_hours: {
    key: 'away_hours',
    source: 'assembled',
    unit: 'seconds', // actually hours, but we usually store seconds and convert to hours in UI, or store as count? Wait, time is usually seconds.
    direction: 'lower_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Away',
  },
  transfer_hours: {
    key: 'transfer_hours',
    source: 'assembled',
    unit: 'seconds',
    direction: 'lower_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Transfer',
  },
  online_hours: {
    key: 'online_hours',
    source: 'assembled',
    unit: 'seconds',
    direction: 'higher_is_better',
    nullLabel: 'No schedule data',
    shortLabel: 'Online',
  },
  attendance_points: {
    key: 'attendance_points',
    source: 'manual',
    unit: 'count',
    direction: 'lower_is_better',
    nullLabel: 'No points recorded',
    shortLabel: 'Attendance',
  },
  tickets_audited: {
    key: 'tickets_audited',
    source: 'manual',
    unit: 'count',
    direction: 'higher_is_better',
    nullLabel: 'No audits recorded',
    shortLabel: 'QA Audits',
  },
};
