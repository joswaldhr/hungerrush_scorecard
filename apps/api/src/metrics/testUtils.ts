// Test-only fixture builders shared by the per-metric characterization tests.
// Excluded from the production build via tsconfig.build.json.
import type {
  ZendeskSatisfactionRating,
  ZendeskTicket,
  ZendeskTicketMetricSet,
} from '../types/zendesk';
import type { AssembledAgentState, AssembledActivity } from '../types/assembled';
import type { AssembledWeekData, ZendeskWeekData } from './types';

// Fixture period: the week of 2026-06-29. makeTicket's default created_at falls
// INSIDE it, so tests that don't care about the L1 created-in-period split keep
// reading naturally; out-of-period cases override created_at explicitly.
export const FIXTURE_PERIOD_START = new Date('2026-06-29T00:00:00Z');
export const FIXTURE_PERIOD_END = new Date('2026-07-05T23:59:59.999Z');

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

export function makeRating(
  overrides: Partial<ZendeskSatisfactionRating> & { id: number },
): ZendeskSatisfactionRating {
  return {
    assignee_id: 1,
    score: 'good',
    created_at: '2026-06-30T12:00:00Z',
    ticket_id: overrides.id * 10,
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
    ratings: [],
    periodStart: FIXTURE_PERIOD_START,
    periodEnd: FIXTURE_PERIOD_END,
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
