// Characterization tests — pin CURRENT csat_score behavior through the Phase 1B
// refactor. Fixtures and expectations carried over from the pre-refactor suite.
import { describe, it, expect } from 'vitest';
import { compute } from './csat_score';
import { makeTicket, zendeskWeek } from './testUtils';

describe('csat_score', () => {
  it('returns null for an empty week (no data, not zero)', () => {
    expect(compute(zendeskWeek({ slaTargetMinutes: 30 }))).toBeNull();
  });

  it('returns null when no ticket has a good/bad rating (null, not 0)', () => {
    const tickets = [
      makeTicket({ id: 1, satisfaction_rating: null }),
      makeTicket({ id: 2, satisfaction_rating: { score: 'offered' } }),
    ];
    expect(compute(zendeskWeek({ tickets }))).toBeNull();
  });

  it('computes percent good over rated, rounded to 2 decimals', () => {
    const tickets = [
      makeTicket({ id: 1, satisfaction_rating: { score: 'good' } }),
      makeTicket({ id: 2, satisfaction_rating: { score: 'bad' } }),
      makeTicket({ id: 3, satisfaction_rating: { score: 'bad' } }),
      makeTicket({ id: 4, satisfaction_rating: { score: 'offered' } }),
    ];
    expect(compute(zendeskWeek({ tickets }))).toBe(33.33);
  });

  it('returns 0 when every rating is bad (measured zero, not null)', () => {
    const tickets = [makeTicket({ id: 1, satisfaction_rating: { score: 'bad' } })];
    expect(compute(zendeskWeek({ tickets }))).toBe(0);
  });

  it('returns 100 when every rating is good', () => {
    const tickets = [makeTicket({ id: 1, satisfaction_rating: { score: 'good' } })];
    expect(compute(zendeskWeek({ tickets }))).toBe(100);
  });
});
