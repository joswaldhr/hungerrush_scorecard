// schedule_adherence behavior tests. Re-encoded in Phase 1C commit 10 (L6 fix): an
// empty productive-state intersection is "no measurement" (null); a zero overlap
// with MATCHING states (worked entirely off-schedule) stays a measured 0.
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

  it('L6 fix: returns null when scheduled time exists but no state matches a productive name', () => {
    expect(compute(assembledWeek({
      states: [state('online', 0, 3600)],
      activities: [activity('t-productive', 0, 3600)],
      productiveTypeIds,
      productiveStateNames,
    }))).toBeNull();
  });

  it('zero overlap with MATCHING states stays a measured 0 (worked entirely off-schedule)', () => {
    expect(compute(assembledWeek({
      states: [state('Chat', 7200, 10800)],
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
