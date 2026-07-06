// Common subexpressions shared by the Zendesk metric modules.
import type { ZendeskTicket, ZendeskTicketMetricSet } from '../types/zendesk';
import type { ZendeskWeekData } from './types';

export function roundPercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
}

// The L1 semantics split (Phase 1C commit 7): data.tickets is UPDATED-in-period
// (activity semantics, kept for ticket_volume); metrics that describe THIS WEEK'S
// work compute only from tickets CREATED in the period, so a reworked old ticket
// can no longer contaminate them (prod had reply averages of ~167h from this).
export function ticketsCreatedInPeriod(data: ZendeskWeekData): ZendeskTicket[] {
  const start = data.periodStart.getTime();
  const end = data.periodEnd.getTime();
  return data.tickets.filter(t => {
    const created = Date.parse(t.created_at);
    return created >= start && created <= end;
  });
}

// Business-hours reply seconds per ticket. Takes the ticket list explicitly so
// callers choose the semantics: first_reply_time passes created-in-period tickets,
// sla_compliance passes the full updated set.
// L11 fix (commit 7b): business: 0 with calendar > 0 means the first reply happened
// entirely OUTSIDE business hours — there is no meaningful business-time measurement,
// so the ticket is excluded (it used to enter averages as a fake instant reply and
// auto-pass SLA). business: 0 with calendar: 0 is a genuinely instant reply and stays.
export function collectReplySeconds(
  tickets: ZendeskTicket[],
  metricSets: Map<number, ZendeskTicketMetricSet>,
): number[] {
  const replySeconds: number[] = [];
  for (const t of tickets) {
    const reply = metricSets.get(t.id)?.reply_time_in_minutes;
    if (!reply) continue;
    if (reply.business === 0 && reply.calendar > 0) continue;
    replySeconds.push(reply.business * 60);
  }
  return replySeconds;
}
