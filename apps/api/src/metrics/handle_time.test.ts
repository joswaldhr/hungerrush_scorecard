// Characterization tests — pin CURRENT handle_time behavior through the Phase 1B
// refactor. Fixtures and expectations carried over from the pre-refactor suite.
import { describe, it, expect } from 'vitest';
import { compute } from './handle_time';
import { state, assembledWeek } from './testUtils';

const productiveStateNames = new Set(['Chat']);

describe('handle_time', () => {
  it('returns null with no states (no data)', () => {
    expect(compute(assembledWeek({ productiveStateNames }))).toBeNull();
  });

  it('returns null when no state matches a productive name — the asymmetry with occupancy 0 is intentional-to-preserve', () => {
    // Same unmapped-state scenario as L6, but handle_time already does the right thing
    // (null). This asymmetry is why production has 126 occupancy rows and 0 handle_time rows.
    expect(compute(assembledWeek({
      states: [state('online', 0, 3600)],
      productiveStateNames,
    }))).toBeNull();
  });

  it('averages the duration of individual productive state entries', () => {
    expect(compute(assembledWeek({
      states: [state('Chat', 0, 300), state('Chat', 1000, 1600)],
      productiveStateNames,
    }))).toBe(450);
  });

  it('rounds to whole seconds', () => {
    expect(compute(assembledWeek({
      states: [state('Chat', 0, 100), state('Chat', 200, 301)],
      productiveStateNames,
    }))).toBe(101);
  });
});
