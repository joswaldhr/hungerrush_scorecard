// Test-only fixture builders shared by the per-metric characterization tests.
// Excluded from the production build via tsconfig.build.json.
import type { ZendeskTicket, ZendeskTicketMetricSet } from '../types/zendesk';
import type { AssembledAgentState, AssembledActivity } from '../types/assembled';
import type { AssembledWeekData, ZendeskWeekData } from './types';

export function makeTicket(overrides: Partial<ZendeskTicket> & { id: number }): ZendeskTicket {
  return {
    status: 'open',
    assignee_id: 1,
    created_at: '2026-06-29T08:00:00Z',
    updated_at: '2026-06-30T08:00:00Z',
    satisfaction_rating: null,
    ...overrides,
  };
}

export function makeMetricSet(
  ticketId: number,
  businessReplyMinutes: number | null,
): ZendeskTicketMetricSet {
  return {
    id: ticketId * 1000,
    ticket_id: ticketId,
    reply_time_in_minutes:
      businessReplyMinutes === null
        ? null
        : { calendar: businessReplyMinutes * 2, business: businessReplyMinutes },
    full_resolution_time_in_minutes: null,
  };
}

export function metricSetMap(sets: ZendeskTicketMetricSet[]): Map<number, ZendeskTicketMetricSet> {
  return new Map(sets.map(s => [s.ticket_id, s]));
}

export function zendeskWeek(overrides: Partial<ZendeskWeekData> = {}): ZendeskWeekData {
  return {
    tickets: [],
    metricSets: metricSetMap([]),
    slaTargetMinutes: null,
    ...overrides,
  };
}

export function state(name: string, start: number, end: number): AssembledAgentState {
  return { agent_id: 'a1', state: name, start_time: start, end_time: end };
}

export function activity(typeId: string, start: number, end: number): AssembledActivity {
  return { agent_id: 'a1', type_id: typeId, start_time: start, end_time: end };
}

export function assembledWeek(overrides: Partial<AssembledWeekData> = {}): AssembledWeekData {
  return {
    states: [],
    activities: [],
    productiveTypeIds: new Set<string>(),
    productiveStateNames: new Set<string>(),
    ...overrides,
  };
}
