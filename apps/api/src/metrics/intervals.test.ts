// Characterization tests — pin CURRENT behavior of the interval math, moved verbatim
// from connectors/assembled.ts in Phase 1B. Fixtures and expectations are unchanged
// from the pre-refactor suite.
import { describe, it, expect } from 'vitest';
import { mergeIntervals, totalDuration, overlapDuration } from './intervals';

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
