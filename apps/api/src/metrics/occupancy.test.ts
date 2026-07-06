// occupancy behavior tests. Re-encoded in Phase 1C commit 10 (L6 fix): an empty
// productive-state intersection is "no measurement" (null), never a measured 0%.
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

  it('L6 fix: returns null when states exist but none match a productive name', () => {
    // The prod defect: activity-type names never matched agent-state strings, so every
    // occupancy row ever written was a misleading 0%. An empty intersection means the
    // mapping does not apply — no measurement, no row.
    expect(compute(assembledWeek({
      states: [state('online', 0, 3600), state('away', 3600, 7200)],
      productiveStateNames,
    }))).toBeNull();
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
