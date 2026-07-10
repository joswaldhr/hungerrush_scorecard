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
import * as ibCallsOffered from './ib_calls_offered';
import * as ibCallsAnswered from './ib_calls_answered';
import * as ibCallsDeclined from './ib_calls_declined';
import * as ibCallsMissed from './ib_calls_missed';
import * as ibTalkTime from './ib_talk_time';
import * as obTalkTime from './ob_talk_time';
import * as obCalls from './ob_calls';
import * as ticketsAssigned from './tickets_assigned';
import * as backlog from './backlog';

export const ZENDESK_METRICS: ZendeskMetricModule[] = [
  ticketVolume,
  firstReplyTime,
  csatScore,
  slaCompliance,
  resolutionRate,
  ibCallsOffered,
  ibCallsAnswered,
  ibCallsDeclined,
  ibCallsMissed,
  ibTalkTime,
  obTalkTime,
  obCalls,
  ticketsAssigned,
  backlog,
];

import * as awayHours from './away_hours';
import * as transferHours from './transfer_hours';
import * as onlineHours from './online_hours';

export const ASSEMBLED_METRICS: AssembledMetricModule[] = [
  scheduleAdherence,
  occupancy,
  handleTime,
  awayHours,
  transferHours,
  onlineHours,
];

export const ALL_METRICS: ReadonlyArray<ZendeskMetricModule | AssembledMetricModule> = [
  ...ZENDESK_METRICS,
  ...ASSEMBLED_METRICS,
];
