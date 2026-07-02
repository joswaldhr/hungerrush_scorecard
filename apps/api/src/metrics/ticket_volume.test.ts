// Characterization tests — pin CURRENT ticket_volume behavior through the Phase 1B
// refactor. Fixtures and expectations carried over from the pre-refactor suite
// (the composite empty-input test decomposed per metric).
import { describe, it, expect } from 'vitest';
import { compute } from './ticket_volume';
import { makeTicket, zendeskWeek } from './testUtils';

describe('ticket_volume', () => {
  it('returns 0 for an empty week (measured zero, not null — the zero-vs-null distinction)', () => {
    expect(compute(zendeskWeek({ slaTargetMinutes: 30 }))).toBe(0);
  });

  it('counts every ticket regardless of status or metric availability', () => {
    const tickets = [
      makeTicket({ id: 1, status: 'open' }),
      makeTicket({ id: 2, status: 'solved' }),
      makeTicket({ id: 3, status: 'pending' }),
    ];
    expect(compute(zendeskWeek({ tickets }))).toBe(3);
  });
});
