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

// PRESERVE-FOR-PARITY (L11): a reply outside business hours records business: 0 —
// the reply_time_in_minutes object is truthy, so the 0 is pushed and drags averages down.
// Takes the ticket list explicitly so callers choose the semantics: first_reply_time
// passes created-in-period tickets, sla_compliance passes the full updated set.
export function collectReplySeconds(
  tickets: ZendeskTicket[],
  metricSets: Map<number, ZendeskTicketMetricSet>,
): number[] {
  const replySeconds: number[] = [];
  for (const t of tickets) {
    const ms = metricSets.get(t.id);
    if (ms?.reply_time_in_minutes) {
      replySeconds.push(ms.reply_time_in_minutes.business * 60);
    }
  }
  return replySeconds;
}
