// Characterization tests — pin CURRENT occupancy behavior through the Phase 1B
// refactor. The L6 defect (0% when productive state names match nothing) is pinned
// intentionally as PRESERVE-FOR-PARITY and is fixed in Phase 1C commit 10.
import { describe, it, expect } from 'vitest';
import { compute } from './occupancy';
import { state, assembledWeek } from './testUtils';

const productiveStateNames = new Set(['Chat']);

describe('occupancy', () => {
  it('returns null with no states at all (no data, not zero)', () => {
    expect(compute(assembledWeek({ productiveStateNames }))).toBeNull();
  });

  it('returns null when the only states are Offline (never logged in)', () => {
    expect(compute(assembledWeek({
      states: [state('Offline', 0, 3600)],
      productiveStateNames,
    }))).toBeNull();
  });

  it('PRESERVE-FOR-PARITY (L6): returns 0 when states exist but none match a productive name', () => {
    // This is the defect live in production: activity-type names don't match agent-state
    // strings, so every occupancy row ever written is 0%. Correct behavior (Phase 1C
    // commit 10) is null when the productive-name mapping matches nothing.
    expect(compute(assembledWeek({
      states: [state('online', 0, 3600), state('away', 3600, 7200)],
      productiveStateNames,
    }))).toBe(0);
  });

  it('computes productive time over logged-in time, excluding Offline', () => {
    expect(compute(assembledWeek({
      states: [
        state('Chat', 0, 3600),
        state('Lunch', 3600, 7200),
        state('Offline', 7200, 10800),
      ],
      productiveStateNames,
    }))).toBe(50);
  });

  it('rounds to 2 decimals', () => {
    expect(compute(assembledWeek({
      states: [state('Chat', 0, 1000), state('Lunch', 1000, 3000)],
      productiveStateNames,
    }))).toBe(33.33);
  });
});
