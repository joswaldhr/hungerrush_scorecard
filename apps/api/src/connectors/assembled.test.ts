// Characterization tests — pin CURRENT behavior of the Assembled metric computation
// before the Phase 1B registry refactor. The L6 defect (0% written when productive
// state names match nothing) is pinned intentionally as PRESERVE-FOR-PARITY and is
// fixed in Phase 1C commit 10 (see docs/refactor-plan.md §f).
import { describe, it, expect } from 'vitest';
import {
  mergeIntervals,
  totalDuration,
  overlapDuration,
  computeScheduleAdherence,
  computeOccupancy,
  computeHandleTime,
} from './assembled';
import type { AssembledAgentState, AssembledActivity } from '../types/assembled';

function state(name: string, start: number, end: number): AssembledAgentState {
  return { agent_id: 'a1', state: name, start_time: start, end_time: end };
}

function activity(typeId: string, start: number, end: number): AssembledActivity {
  return { agent_id: 'a1', type_id: typeId, start_time: start, end_time: end };
}

describe('interval math', () => {
  it('mergeIntervals: empty input → empty output', () => {
    expect(mergeIntervals([])).toEqual([]);
  });

  it('mergeIntervals: keeps disjoint intervals separate', () => {
    expect(mergeIntervals([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ])).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 30 },
    ]);
  });

  it('mergeIntervals: merges overlapping and adjacent intervals (start <= previous end)', () => {
    expect(mergeIntervals([
      { start: 0, end: 10 },
      { start: 5, end: 15 },
      { start: 15, end: 20 },
    ])).toEqual([{ start: 0, end: 20 }]);
  });

  it('mergeIntervals: a contained interval does not extend the container', () => {
    expect(mergeIntervals([
      { start: 0, end: 100 },
      { start: 10, end: 20 },
    ])).toEqual([{ start: 0, end: 100 }]);
  });

  it('totalDuration: overlapping time counts once', () => {
    expect(totalDuration([
      { start: 0, end: 100 },
      { start: 50, end: 150 },
    ])).toBe(150);
  });

  it('overlapDuration: computes intersection across merged sets', () => {
    expect(overlapDuration(
      [{ start: 0, end: 100 }],
      [{ start: 50, end: 150 }],
    )).toBe(50);
    expect(overlapDuration(
      [{ start: 0, end: 10 }],
      [{ start: 20, end: 30 }],
    )).toBe(0);
  });
});

describe('computeOccupancy', () => {
  const productive = new Set(['Chat']);

  it('returns null with no states at all (no data, not zero)', () => {
    expect(computeOccupancy([], productive)).toBeNull();
  });

  it('returns null when the only states are Offline (never logged in)', () => {
    expect(computeOccupancy([state('Offline', 0, 3600)], productive)).toBeNull();
  });

  it('PRESERVE-FOR-PARITY (L6): returns 0 when states exist but none match a productive name', () => {
    // This is the defect live in production: activity-type names don't match agent-state
    // strings, so every occupancy row ever written is 0%. Correct behavior (Phase 1C
    // commit 10) is null when the productive-name mapping matches nothing.
    const states = [state('online', 0, 3600), state('away', 3600, 7200)];
    expect(computeOccupancy(states, productive)).toBe(0);
  });

  it('computes productive time over logged-in time, excluding Offline', () => {
    const states = [
      state('Chat', 0, 3600),
      state('Lunch', 3600, 7200),
      state('Offline', 7200, 10800),
    ];
    expect(computeOccupancy(states, productive)).toBe(50);
  });

  it('rounds to 2 decimals', () => {
    const states = [state('Chat', 0, 1000), state('Lunch', 1000, 3000)];
    expect(computeOccupancy(states, productive)).toBe(33.33);
  });
});

describe('computeScheduleAdherence', () => {
  const productiveTypeIds = new Set(['t-productive']);
  const productiveNames = new Set(['Chat']);

  it('returns null when nothing productive is scheduled', () => {
    expect(computeScheduleAdherence([state('Chat', 0, 3600)], [], productiveTypeIds, productiveNames)).toBeNull();
    expect(computeScheduleAdherence(
      [state('Chat', 0, 3600)],
      [activity('t-break', 0, 3600)],
      productiveTypeIds,
      productiveNames,
    )).toBeNull();
  });

  it('PRESERVE-FOR-PARITY (L6): returns 0 when scheduled time exists but no state matches', () => {
    const states = [state('online', 0, 3600)];
    const activities = [activity('t-productive', 0, 3600)];
    expect(computeScheduleAdherence(states, activities, productiveTypeIds, productiveNames)).toBe(0);
  });

  it('computes overlap of productive states with scheduled productive time', () => {
    const states = [state('Chat', 0, 1800)];
    const activities = [activity('t-productive', 0, 3600)];
    expect(computeScheduleAdherence(states, activities, productiveTypeIds, productiveNames)).toBe(50);
  });

  it('working unscheduled time does not raise adherence above 100', () => {
    const states = [state('Chat', 0, 7200)];
    const activities = [activity('t-productive', 0, 3600)];
    expect(computeScheduleAdherence(states, activities, productiveTypeIds, productiveNames)).toBe(100);
  });
});

describe('computeHandleTime', () => {
  const productive = new Set(['Chat']);

  it('returns null with no states (no data)', () => {
    expect(computeHandleTime([], productive)).toBeNull();
  });

  it('returns null when no state matches a productive name — the asymmetry with occupancy 0 is intentional-to-preserve', () => {
    // Same unmapped-state scenario as L6, but handle_time already does the right thing
    // (null). This asymmetry is why production has 126 occupancy rows and 0 handle_time rows.
    expect(computeHandleTime([state('online', 0, 3600)], productive)).toBeNull();
  });

  it('averages the duration of individual productive state entries', () => {
    const states = [state('Chat', 0, 300), state('Chat', 1000, 1600)];
    expect(computeHandleTime(states, productive)).toBe(450);
  });

  it('rounds to whole seconds', () => {
    const states = [state('Chat', 0, 100), state('Chat', 200, 301)];
    expect(computeHandleTime(states, productive)).toBe(101);
  });
});
