// csat_score behavior tests. Rewritten in Phase 1C commit 7: the metric now reads
// satisfaction ratings SUBMITTED in the period (satisfaction_ratings endpoint,
// score=received) instead of the satisfaction_rating field of updated tickets —
// the week a customer answers is the week the rating counts.
import { describe, it, expect } from 'vitest';
import { compute } from './csat_score';
import { makeRating, makeTicket, zendeskWeek } from './testUtils';

describe('csat_score', () => {
  it('returns null for an empty week (no data, not zero)', () => {
    expect(compute(zendeskWeek({ slaTargetMinutes: 30 }))).toBeNull();
  });

  it('returns null when no survey was answered this period, even with ticket activity', () => {
    const tickets = [makeTicket({ id: 1, satisfaction_rating: { score: 'good' } })];
    expect(compute(zendeskWeek({ tickets }))).toBeNull();
  });

  it('computes percent good over answered ratings, rounded to 2 decimals', () => {
    const ratings = [
      makeRating({ id: 1, score: 'good' }),
      makeRating({ id: 2, score: 'bad' }),
      makeRating({ id: 3, score: 'bad' }),
    ];
    expect(compute(zendeskWeek({ ratings }))).toBe(33.33);
  });

  it('ignores non-answer scores defensively (connector already filters to received)', () => {
    const ratings = [
      makeRating({ id: 1, score: 'good' }),
      makeRating({ id: 2, score: 'offered' }),
    ];
    expect(compute(zendeskWeek({ ratings }))).toBe(100);
  });

  it('returns 0 when every answered rating is bad (measured zero, not null)', () => {
    const ratings = [makeRating({ id: 1, score: 'bad' })];
    expect(compute(zendeskWeek({ ratings }))).toBe(0);
  });

  it('returns 100 when every answered rating is good', () => {
    const ratings = [makeRating({ id: 1, score: 'good' })];
    expect(compute(zendeskWeek({ ratings }))).toBe(100);
  });
});
