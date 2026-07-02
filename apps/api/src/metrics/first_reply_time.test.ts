// Characterization tests — pin CURRENT first_reply_time behavior through the Phase 1B
// refactor. Known defects stay pinned (PRESERVE-FOR-PARITY) and are re-encoded to
// correct behavior in Phase 1C, one commit per fix (docs/refactor-plan.md §f).
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

  it('PRESERVE-FOR-PARITY (L11): business time 0 is included and drags the average down', () => {
    // A reply outside business hours records business: 0 — the object is truthy, so 0 is pushed.
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    const metricSets = metricSetMap([makeMetricSet(1, 0), makeMetricSet(2, 10)]);
    expect(compute(zendeskWeek({ tickets, metricSets }))).toBe(300);
  });
});
