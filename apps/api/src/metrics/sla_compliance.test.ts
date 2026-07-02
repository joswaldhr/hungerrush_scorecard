// Characterization tests — pin CURRENT sla_compliance behavior through the Phase 1B
// refactor. Fixtures and expectations carried over from the pre-refactor suite.
import { describe, it, expect } from 'vitest';
import { compute } from './sla_compliance';
import { makeTicket, makeMetricSet, metricSetMap, zendeskWeek } from './testUtils';

describe('sla_compliance', () => {
  it('returns null for an empty week even when a target is configured', () => {
    expect(compute(zendeskWeek({ slaTargetMinutes: 30 }))).toBeNull();
  });

  it('returns null when no SLA target is configured', () => {
    const tickets = [makeTicket({ id: 1 })];
    const metricSets = metricSetMap([makeMetricSet(1, 10)]);
    expect(compute(zendeskWeek({ tickets, metricSets, slaTargetMinutes: null }))).toBeNull();
  });

  it('returns null when a target exists but no tickets have reply metrics', () => {
    const tickets = [makeTicket({ id: 1 })];
    expect(compute(zendeskWeek({ tickets, slaTargetMinutes: 30 }))).toBeNull();
  });

  it('computes percent of replies within target (target in minutes vs reply in seconds)', () => {
    const tickets = [makeTicket({ id: 1 }), makeTicket({ id: 2 })];
    // target 30 min = 1800s; replies 600s (met) and 3600s (missed) → 50%
    const metricSets = metricSetMap([makeMetricSet(1, 10), makeMetricSet(2, 60)]);
    expect(compute(zendeskWeek({ tickets, metricSets, slaTargetMinutes: 30 }))).toBe(50);
  });

  it('a reply exactly at the target counts as met', () => {
    const tickets = [makeTicket({ id: 1 })];
    const metricSets = metricSetMap([makeMetricSet(1, 30)]);
    expect(compute(zendeskWeek({ tickets, metricSets, slaTargetMinutes: 30 }))).toBe(100);
  });
});
