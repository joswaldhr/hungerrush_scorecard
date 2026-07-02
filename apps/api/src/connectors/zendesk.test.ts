// Characterization tests — pin CURRENT behavior of the Zendesk metric computation
// before the Phase 1B registry refactor. Known defects are pinned intentionally and
// labeled PRESERVE-FOR-PARITY; they are re-encoded to correct behavior in Phase 1C,
// one commit per fix (see docs/refactor-plan.md §f).
import { describe, it, expect } from 'vitest';
import { computeAllMetrics } from './zendesk';
import type { ZendeskTicket, ZendeskTicketMetricSet } from '../types/zendesk';

function makeTicket(overrides: Partial<ZendeskTicket> & { id: number }): ZendeskTicket {
  return {
    status: 'open',
    assignee_id: 1,
    created_at: '2026-06-29T08:00:00Z',
    updated_at: '2026-06-30T08:00:00Z',
    satisfaction_rating: null,
    ...overrides,
  };
}

function makeMetricSet(
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

function metricSetMap(sets: ZendeskTicketMetricSet[]): Map<number, ZendeskTicketMetricSet> {
  return new Map(sets.map(s => [s.ticket_id, s]));
}

describe('computeAllMetrics — empty input', () => {
  it('returns volume 0 and null for everything else (zero-vs-null distinction)', () => {
    const result = computeAllMetrics([], metricSetMap([]), 30);
    expect(result).toEqual({
      ticketVolume: 0,
      firstReplyTime: null,
      csatScore: null,
      slaCompliance: null,
      resolutionRate: null,
    });
  });
});

describe('computeAllMetrics — ticket volume', () => {
  it('counts every ticket regardless of status or metric availability', () => {
    const tickets = [
      makeTicket({ id: 1, status: 'open' }),
      makeTicket({ id: 2, status: 'solved' }),
      makeTicket({ id: 3, status: 'pending' }),
    ];
    const result = computeAllMetrics(tickets, metricSetMap([]), null);
    expect(result.ticketVolume).toBe(3);
  });
});

describe('computeAllMetrics — first reply time', () => {
  it('converts business minutes to seconds for a single ticket', () => {
    const tickets = [makeTicket({ id: 1 })];
    const sets = metricSetMap([makeMetricSet(1, 10)]);
    expect(computeAllMetrics(tickets, sets, null).firstReplyTime).toBe(600);
  });

  it('averages across tickets that have reply metrics', () => {
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    const sets = metricSetMap([makeMetricSet(1, 10), makeMetricSet(2, 20)]);
    expect(computeAllMetrics(tickets, sets, null).firstReplyTime).toBe(900);
  });

  it('rounds the average to whole seconds', () => {
    // (90 + 120 + 90) / 3 = 100 exactly; (90 + 100) / 2 = 95; use a fractional case:
    // businesses 1.5 and 1.6 → (90 + 96) / 2 = 93
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    const sets = metricSetMap([makeMetricSet(1, 1.5), makeMetricSet(2, 1.6)]);
    expect(computeAllMetrics(tickets, sets, null).firstReplyTime).toBe(93);
  });

  it('ignores tickets without a metric set or with null reply_time', () => {
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 }), makeTicket({ id: 3 })];
    const sets = metricSetMap([makeMetricSet(1, 10), makeMetricSet(2, null)]);
    expect(computeAllMetrics(tickets, sets, null).firstReplyTime).toBe(600);
  });

  it('returns null when tickets exist but none have reply metrics (null, not 0)', () => {
    const tickets = [makeTicket({ id: 1 })];
    expect(computeAllMetrics(tickets, metricSetMap([]), null).firstReplyTime).toBeNull();
  });

  it('PRESERVE-FOR-PARITY (L11): business time 0 is included and drags the average down', () => {
    // A reply outside business hours records business: 0 — the object is truthy, so 0 is pushed.
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    const sets = metricSetMap([makeMetricSet(1, 0), makeMetricSet(2, 10)]);
    expect(computeAllMetrics(tickets, sets, null).firstReplyTime).toBe(300);
  });
});

describe('computeAllMetrics — CSAT', () => {
  it('returns null when no ticket has a good/bad rating (null, not 0)', () => {
    const tickets = [
      makeTicket({ id: 1, satisfaction_rating: null }),
      makeTicket({ id: 2, satisfaction_rating: { score: 'offered' } }),
    ];
    expect(computeAllMetrics(tickets, metricSetMap([]), null).csatScore).toBeNull();
  });

  it('computes percent good over rated, rounded to 2 decimals', () => {
    const tickets = [
      makeTicket({ id: 1, satisfaction_rating: { score: 'good' } }),
      makeTicket({ id: 2, satisfaction_rating: { score: 'bad' } }),
      makeTicket({ id: 3, satisfaction_rating: { score: 'bad' } }),
      makeTicket({ id: 4, satisfaction_rating: { score: 'offered' } }),
    ];
    expect(computeAllMetrics(tickets, metricSetMap([]), null).csatScore).toBe(33.33);
  });

  it('returns 0 when every rating is bad (measured zero, not null)', () => {
    const tickets = [makeTicket({ id: 1, satisfaction_rating: { score: 'bad' } })];
    expect(computeAllMetrics(tickets, metricSetMap([]), null).csatScore).toBe(0);
  });

  it('returns 100 when every rating is good', () => {
    const tickets = [makeTicket({ id: 1, satisfaction_rating: { score: 'good' } })];
    expect(computeAllMetrics(tickets, metricSetMap([]), null).csatScore).toBe(100);
  });
});

describe('computeAllMetrics — SLA compliance', () => {
  it('returns null when no SLA target is configured', () => {
    const tickets = [makeTicket({ id: 1 })];
    const sets = metricSetMap([makeMetricSet(1, 10)]);
    expect(computeAllMetrics(tickets, sets, null).slaCompliance).toBeNull();
  });

  it('returns null when a target exists but no tickets have reply metrics', () => {
    const tickets = [makeTicket({ id: 1 })];
    expect(computeAllMetrics(tickets, metricSetMap([]), 30).slaCompliance).toBeNull();
  });

  it('computes percent of replies within target (target in minutes vs reply in seconds)', () => {
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    // target 30 min = 1800s; replies 600s (met) and 3600s (missed) → 50%
    const sets = metricSetMap([makeMetricSet(1, 10), makeMetricSet(2, 60)]);
    expect(computeAllMetrics(tickets, sets, 30).slaCompliance).toBe(50);
  });

  it('a reply exactly at the target counts as met', () => {
    const tickets = [makeTicket({ id: 1 })];
    const sets = metricSetMap([makeMetricSet(1, 30)]);
    expect(computeAllMetrics(tickets, sets, 30).slaCompliance).toBe(100);
  });
});

describe('computeAllMetrics — resolution rate', () => {
  it('counts solved and closed against all tickets, rounded to 2 decimals', () => {
    const tickets = [
      makeTicket({ id: 1, status: 'solved' }),
      makeTicket({ id: 2, status: 'closed' }),
      makeTicket({ id: 3, status: 'open' }),
    ];
    expect(computeAllMetrics(tickets, metricSetMap([]), null).resolutionRate).toBe(66.67);
  });

  it('returns 0 when tickets exist but none are resolved (measured zero, not null)', () => {
    const tickets = [makeTicket({ id: 1, status: 'open' })];
    expect(computeAllMetrics(tickets, metricSetMap([]), null).resolutionRate).toBe(0);
  });
});
