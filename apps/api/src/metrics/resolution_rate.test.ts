// Characterization tests — pin CURRENT resolution_rate behavior through the Phase 1B
// refactor. Fixtures and expectations carried over from the pre-refactor suite.
// The old computeAllMetrics had an unreachable inner null-guard (L9) folded into the
// empty-week early return — identical observable behavior, pinned here.
import { describe, it, expect } from 'vitest';
import { compute } from './resolution_rate';
import { makeTicket, zendeskWeek } from './testUtils';

describe('resolution_rate', () => {
  it('returns null for an empty week (no data, not zero)', () => {
    expect(compute(zendeskWeek({ slaTargetMinutes: 30 }))).toBeNull();
  });

  it('counts solved and closed against all tickets, rounded to 2 decimals', () => {
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
});
