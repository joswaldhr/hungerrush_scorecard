// Characterization tests — pin CURRENT schedule_adherence behavior through the Phase 1B
// refactor. The L6 defect (0% when productive state names match nothing) is pinned
// intentionally as PRESERVE-FOR-PARITY and is fixed in Phase 1C commit 10.
import { describe, it, expect } from 'vitest';
import { compute } from './schedule_adherence';
import { state, activity, assembledWeek } from './testUtils';

const productiveTypeIds = new Set(['t-productive']);
const productiveStateNames = new Set(['Chat']);

describe('schedule_adherence', () => {
  it('returns null when nothing productive is scheduled', () => {
    expect(compute(assembledWeek({
      states: [state('Chat', 0, 3600)],
      productiveTypeIds,
      productiveStateNames,
    }))).toBeNull();
    expect(compute(assembledWeek({
      states: [state('Chat', 0, 3600)],
      activities: [activity('t-break', 0, 3600)],
      productiveTypeIds,
      productiveStateNames,
    }))).toBeNull();
  });

  it('PRESERVE-FOR-PARITY (L6): returns 0 when scheduled time exists but no state matches', () => {
    expect(compute(assembledWeek({
      states: [state('online', 0, 3600)],
      activities: [activity('t-productive', 0, 3600)],
      productiveTypeIds,
      productiveStateNames,
    }))).toBe(0);
  });

  it('computes overlap of productive states with scheduled productive time', () => {
    expect(compute(assembledWeek({
      states: [state('Chat', 0, 1800)],
      activities: [activity('t-productive', 0, 3600)],
      productiveTypeIds,
      productiveStateNames,
    }))).toBe(50);
  });

  it('working unscheduled time does not raise adherence above 100', () => {
    expect(compute(assembledWeek({
      states: [state('Chat', 0, 7200)],
      activities: [activity('t-productive', 0, 3600)],
      productiveTypeIds,
      productiveStateNames,
    }))).toBe(100);
  });
});
