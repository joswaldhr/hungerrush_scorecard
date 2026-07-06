// Week-data shapes produced by the fetcher connectors and consumed by the metric
// modules' compute functions. Api-local on purpose: they wrap raw source-API types.
import type { MetricSpec } from '@scorecard/shared';
import type {
  ZendeskSatisfactionRating,
  ZendeskTicket,
  ZendeskTicketMetricSet,
} from '../types/zendesk';
import type { AssembledActivity, AssembledAgentState } from '../types/assembled';

export interface ZendeskWeekData {
  /** Tickets UPDATED in the period — activity semantics (ticket_volume). Metrics with
   *  created-in-period semantics filter these via ticketsCreatedInPeriod (L1 split). */
  tickets: ZendeskTicket[];
  metricSets: Map<number, ZendeskTicketMetricSet>;
  slaTargetMinutes: number | null;
  /** CSAT surveys ANSWERED in the period for this agent (submitted-in-period semantics). */
  ratings: ZendeskSatisfactionRating[];
  periodStart: Date;
  periodEnd: Date;
}

export interface AssembledWeekData {
  states: AssembledAgentState[];
  /** This agent's activities only (org-wide fetch is filtered by the connector). */
  activities: AssembledActivity[];
  productiveTypeIds: Set<string>;
  productiveStateNames: Set<string>;
}

// One module per metric file: its spec plus a pure compute over one source's week data.
// Kept as two types (not a union) so the registry arrays stay type-safe without
// discriminant tricks — the sync knows which source's data it is holding.

export interface ZendeskMetricModule {
  spec: MetricSpec;
  compute(data: ZendeskWeekData): number | null;
}

export interface AssembledMetricModule {
  spec: MetricSpec;
  compute(data: AssembledWeekData): number | null;
}
