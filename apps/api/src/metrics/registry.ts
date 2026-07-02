// The metric registry — deliberately boring: import each metric module, list it once.
// Adding a metric = 1 new file in this directory + 1 line in the matching array below
// + 1 migration inserting its metric_definitions row (recipe in docs/metrics.md).
// The sync writes registry ∩ is_active: toggling is_active in the admin UI starts/stops
// both sync and display with no deploy.
import type { AssembledMetricModule, ZendeskMetricModule } from './types';
import * as ticketVolume from './ticket_volume';
import * as firstReplyTime from './first_reply_time';
import * as csatScore from './csat_score';
import * as slaCompliance from './sla_compliance';
import * as resolutionRate from './resolution_rate';
import * as scheduleAdherence from './schedule_adherence';
import * as occupancy from './occupancy';
import * as handleTime from './handle_time';

export const ZENDESK_METRICS: ZendeskMetricModule[] = [
  ticketVolume,
  firstReplyTime,
  csatScore,
  slaCompliance,
  resolutionRate,
];

export const ASSEMBLED_METRICS: AssembledMetricModule[] = [
  scheduleAdherence,
  occupancy,
  handleTime,
];

export const ALL_METRICS: ReadonlyArray<ZendeskMetricModule | AssembledMetricModule> = [
  ...ZENDESK_METRICS,
  ...ASSEMBLED_METRICS,
];
