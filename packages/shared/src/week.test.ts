// Pins the week-boundary semantics all five former call sites converged on in Phase 1C
// commit 6 (L2): the UTC Monday the sync has always used — identical to the retired
// getCurrentWeekStart() in apps/api/src/services/syncService.ts.
import { describe, it, expect } from 'vitest';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from './week';

describe('currentWeekStartUtc', () => {
  it('returns the same day for a Monday, at UTC midnight', () => {
    const monday = new Date('2026-07-06T15:30:00Z');
    expect(currentWeekStartUtc(monday).toISOString()).toBe('2026-07-06T00:00:00.000Z');
  });

  it('returns the week Monday for a mid-week day', () => {
    const wednesday = new Date('2026-07-08T09:00:00Z');
    expect(currentWeekStartUtc(wednesday).toISOString()).toBe('2026-07-06T00:00:00.000Z');
  });

  it('returns the PREVIOUS Monday for a Sunday (UTC day 0)', () => {
    const sunday = new Date('2026-07-12T23:59:59Z');
    expect(currentWeekStartUtc(sunday).toISOString()).toBe('2026-07-06T00:00:00.000Z');
  });

  it('L2 regression: early-Monday UTC (still Sunday evening in US timezones) belongs to the NEW week', () => {
    // 2026-07-06T01:30Z is Sunday 20:30 in America/New_York — local-Monday math put
    // this in the old week and the dashboard showed "no data" until local midnight.
    const mondayEarlyUtc = new Date('2026-07-06T01:30:00Z');
    expect(weekStartStr(currentWeekStartUtc(mondayEarlyUtc))).toBe('2026-07-06');
  });

  it('crosses month and year boundaries', () => {
    // 2026-01-01 is a Thursday — its week Monday is 2025-12-29.
    expect(weekStartStr(currentWeekStartUtc(new Date('2026-01-01T12:00:00Z')))).toBe('2025-12-29');
  });

  it('always lands on a UTC Monday at most 6 days before the input', () => {
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.UTC(2026, 5, 1 + i, 13, 45));
      const monday = currentWeekStartUtc(d);
      expect(monday.getUTCDay()).toBe(1);
      expect(monday.getTime()).toBeLessThanOrEqual(d.getTime());
      expect(d.getTime() - monday.getTime()).toBeLessThan(7 * 24 * 60 * 60 * 1000);
    }
  });
});

describe('weeksBeforeUtc', () => {
  const monday = new Date('2026-07-06T00:00:00Z');

  it('steps back whole calendar weeks', () => {
    expect(weekStartStr(weeksBeforeUtc(monday, 1))).toBe('2026-06-29');
    expect(weekStartStr(weeksBeforeUtc(monday, 3))).toBe('2026-06-15');
  });

  it('is immune to DST transitions (pure UTC arithmetic)', () => {
    // US spring-forward was 2026-03-08; the Mondays around it stay exactly 7 UTC days apart.
    const afterDst = new Date('2026-03-09T00:00:00Z');
    expect(weekStartStr(weeksBeforeUtc(afterDst, 1))).toBe('2026-03-02');
  });
});

describe('weekStartStr', () => {
  it('formats as YYYY-MM-DD', () => {
    expect(weekStartStr(new Date('2026-07-06T00:00:00.000Z'))).toBe('2026-07-06');
  });
});
