// first_reply_time behavior tests. Re-encoded in Phase 1C commit 7 to the L1 split:
// only tickets CREATED in the period enter the average (the fixture default
// created_at is in-period, so the arithmetic cases read unchanged).
import { describe, it, expect } from 'vitest';
import { compute } from './first_reply_time';
import { makeTicket, makeMetricSet, metricSetMap, zendeskWeek } from './testUtils';

describe('first_reply_time', () => {
  it('returns null for an empty week (no data, not zero)', () => {
    expect(compute(zendeskWeek({ slaTargetMinutes: 30 }))).toBeNull();
  });

  it('converts business minutes to seconds for a single ticket', () => {
    const tickets = [makeTicket({ id: 1 })];
    const metricSets = metricSetMap([makeMetricSet(1, 10)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(600);
  });

  it('averages across tickets that have reply metrics', () => {
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    const metricSets = metricSetMap([makeMetricSet(1, 10), makeMetricSet(2, 20)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(900);
  });

  it('rounds the average to whole seconds', () => {
    // (90 + 120 + 90) / 3 = 100 exactly; (90 + 100) / 2 = 95; use a fractional case:
    // businesses 1.5 and 1.6 → (90 + 96) / 2 = 93
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    const metricSets = metricSetMap([makeMetricSet(1, 1.5), makeMetricSet(2, 1.6)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(93);
  });

  it('ignores tickets without a metric set or with null reply_time', () => {
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 }), makeTicket({ id: 3 })];
    const metricSets = metricSetMap([makeMetricSet(1, 10), makeMetricSet(2, null)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(600);
  });

  it('returns null when tickets exist but none have reply metrics (null, not 0)', () => {
    const tickets = [makeTicket({ id: 1 })];
    expect(compute(zendeskWeek({ tickets }))).toBeNull();
  });

  it('L1 fix: a ticket created BEFORE the period is excluded even though it was updated in it', () => {
    // Prod evidence: reworked months-old tickets pushed weekly averages to ~167h.
    const tickets = [
      makeTicket({ id: 1, created_at: '2026-03-02T09:00:00Z', updated_at: '2026-06-30T08:00:00Z' }),
      makeTicket({ id: 2 }),
    ];
    const metricSets = metricSetMap([makeMetricSet(1, 10000), makeMetricSet(2, 10)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(600);
  });

  it('L1 fix: null when only out-of-period tickets have reply metrics', () => {
    const tickets = [makeTicket({ id: 1, created_at: '2026-03-02T09:00:00Z' })];
    const metricSets = metricSetMap([makeMetricSet(1, 10000)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBeNull();
  });

  it('period bounds are inclusive of both edges', () => {
    const tickets = [
      makeTicket({ id: 1, created_at: '2026-06-29T00:00:00Z' }),
      makeTicket({ id: 2, created_at: '2026-07-05T23:59:59Z' }),
    ];
    const metricSets = metricSetMap([makeMetricSet(1, 10), makeMetricSet(2, 20)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(900);
  });

  it('PRESERVE-FOR-PARITY (L11): business time 0 is included and drags the average down', () => {
    // A reply outside business hours records business: 0 — the object is truthy, so 0 is pushed.
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    const metricSets = metricSetMap([makeMetricSet(1, 0), makeMetricSet(2, 10)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(300);
  });
});
