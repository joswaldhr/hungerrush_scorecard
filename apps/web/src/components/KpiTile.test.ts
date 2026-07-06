// Characterization tests — pin CURRENT trend-badge behavior (getTrend) before Phase 1B/1C.
// L4 (Last Week tiles receive current-week history) and L12 (partial-week comparison) are
// consequences of how callers use this function; the function's own quirks are pinned here.
import { describe, it, expect } from 'vitest';
import { getTrend, mapHistoryToCalendarSlots } from './KpiTile';

const h = (...values: number[]) => values.map(value => ({ value }));
const p = (periodStart: string, value: number) => ({ periodStart, value });

describe('getTrend', () => {
  it('null value → neutral', () => {
    expect(getTrend(null, h(1, 2, 3), 'higher_is_better')).toBe('neutral');
  });

  it('fewer than 2 history points → neutral', () => {
    expect(getTrend(5, h(), 'higher_is_better')).toBe('neutral');
    expect(getTrend(5, h(10), 'higher_is_better')).toBe('neutral');
  });

  it('higher_is_better: latest above prior average → improving', () => {
    expect(getTrend(5, h(10, 10, 20), 'higher_is_better')).toBe('improving');
  });

  it('higher_is_better: latest below prior average → attention', () => {
    expect(getTrend(5, h(20, 20, 10), 'higher_is_better')).toBe('attention');
  });

  it('lower_is_better: latest below prior average → improving', () => {
    expect(getTrend(5, h(20, 20, 10), 'lower_is_better')).toBe('improving');
  });

  it('lower_is_better: latest above prior average → attention', () => {
    expect(getTrend(5, h(10, 10, 20), 'lower_is_better')).toBe('attention');
  });

  it('PRESERVE-FOR-PARITY: latest exactly equal to prior average → attention, not neutral', () => {
    // `latest > priorAvg ? improving : attention` — equality lands on attention.
    expect(getTrend(5, h(10, 10, 10), 'higher_is_better')).toBe('attention');
    expect(getTrend(5, h(10, 10, 10), 'lower_is_better')).toBe('attention');
  });

  it('trend always compares the LAST history point, regardless of the value shown on the tile (why L4 is fixed at the call sites)', () => {
    // The `value` argument only gates null; the comparison uses history's last element.
    // Last Week tiles therefore pass history truncated to <= last week (commit 8) —
    // with full history they would show a current-week trend. L12 (partial-week
    // comparison on This Week tiles) remains working-as-designed.
    expect(getTrend(999, h(10, 10, 20), 'higher_is_better')).toBe('improving');
    expect(getTrend(1, h(10, 10, 20), 'higher_is_better')).toBe('improving');
  });
});

describe('mapHistoryToCalendarSlots (L5 fix, commit 9)', () => {
  it('aligns each point to its calendar week, oldest slot first', () => {
    const slots = mapHistoryToCalendarSlots(
      [p('2026-06-15', 1), p('2026-06-22', 2), p('2026-06-29', 3), p('2026-07-06', 4)],
      '2026-07-06',
    );
    expect(slots.map(s => s?.value ?? null)).toEqual([1, 2, 3, 4]);
  });

  it('a missing middle week stays an empty slot instead of collapsing', () => {
    const slots = mapHistoryToCalendarSlots(
      [p('2026-06-22', 5), p('2026-07-06', 7)],
      '2026-07-06',
    );
    expect(slots.map(s => s?.value ?? null)).toEqual([null, 5, null, 7]);
  });

  it('points older than the 4-week window are ignored', () => {
    const slots = mapHistoryToCalendarSlots(
      [p('2026-05-04', 9), p('2026-07-06', 1)],
      '2026-07-06',
    );
    expect(slots.map(s => s?.value ?? null)).toEqual([null, null, null, 1]);
  });

  it('anchoring to last week shifts the window (Last Week tiles)', () => {
    const slots = mapHistoryToCalendarSlots(
      [p('2026-06-29', 3), p('2026-07-06', 4)],
      '2026-06-29',
    );
    expect(slots.map(s => s?.value ?? null)).toEqual([null, null, null, 3]);
  });

  it('empty history is four empty slots', () => {
    expect(mapHistoryToCalendarSlots([], '2026-07-06')).toEqual([null, null, null, null]);
  });
});
