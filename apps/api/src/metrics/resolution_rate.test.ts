// resolution_rate behavior tests. Re-encoded in Phase 1C commit 7 to the L1 split:
// the rate describes tickets CREATED in the period (the fixture default created_at
// is in-period, so the arithmetic cases read unchanged).
import { describe, it, expect } from 'vitest';
import { compute } from './resolution_rate';
import { makeTicket, zendeskWeek } from './testUtils';

describe('resolution_rate', () => {
  it('returns null for an empty week (no data, not zero)', () => {
    expect(compute(zendeskWeek({ slaTargetMinutes: 30 }))).toBeNull();
  });

  it('counts solved and closed against created-in-period tickets, rounded to 2 decimals', () => {
    const tickets = [
      makeTicket({ id: 1, status: 'solved' }),
      makeTicket({ id: 2, status: 'closed' }),
      makeTicket({ id: 3, status: 'open' }),
    ];
    expect(compute(zendeskWeek({ tickets }))).toBe(66.67);
  });

  it('returns 0 when tickets exist but none are resolved (measured zero, not null)', () => {
    const tickets = [makeTicket({ id: 1, status: 'open' })];
    expect(compute(zendeskWeek({ tickets }))).toBe(0);
  });

  it('L1 fix: tickets created before the period are excluded from the rate', () => {
    const tickets = [
      makeTicket({ id: 1, status: 'solved' }),
      makeTicket({ id: 2, status: 'solved', created_at: '2026-03-02T09:00:00Z' }),
      makeTicket({ id: 3, status: 'open' }),
    ];
    // Only tickets 1 and 3 are this period's — 1 of 2 resolved.
    expect(compute(zendeskWeek({ tickets }))).toBe(50);
  });

  it('L1 fix: null when every ticket was created before the period (updated-only work)', () => {
    const tickets = [makeTicket({ id: 1, status: 'solved', created_at: '2026-03-02T09:00:00Z' })];
    expect(compute(zendeskWeek({ tickets }))).toBeNull();
  });
});
