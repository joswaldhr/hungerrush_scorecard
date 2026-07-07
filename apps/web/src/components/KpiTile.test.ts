// Pins the tile badge's mapping onto the ONE Cadence trend engine (Phase 3):
// assessTrend tones map win→improving, discuss→attention, steady/new→neutral.
// The old zero-threshold last-vs-average badge (Phase 1A characterization)
// retired with this — the badge must agree with the manager's briefing.
import { describe, it, expect } from 'vitest';
import { getTrend, mapHistoryToCalendarSlots } from './KpiTile';

const h = (...values: number[]) => values.map(value => ({ value }));
const p = (periodStart: string, value: number) => ({ periodStart, value });

describe('getTrend (Cadence engine mapping)', () => {
  it('null value → neutral', () => {
    expect(getTrend(null, h(1, 2, 3, 4), 'higher_is_better')).toBe('neutral');
  });

  it('fewer than 4 history points → neutral (trend "new" until week 4)', () => {
    expect(getTrend(5, h(), 'higher_is_better')).toBe('neutral');
    expect(getTrend(5, h(10, 20, 30), 'higher_is_better')).toBe('neutral');
  });

  it('higher_is_better: ≥6% above the prior average → improving, ≤−6% → attention', () => {
    expect(getTrend(5, h(10, 10, 10, 11), 'higher_is_better')).toBe('improving');
    expect(getTrend(5, h(10, 10, 10, 9), 'higher_is_better')).toBe('attention');
  });

  it('lower_is_better inverts the direction', () => {
    expect(getTrend(5, h(10, 10, 10, 9), 'lower_is_better')).toBe('improving');
    expect(getTrend(5, h(10, 10, 10, 11), 'lower_is_better')).toBe('attention');
  });

  it('inside the ±6% steady band → neutral (the old badge flagged any movement)', () => {
    expect(getTrend(5, h(100, 100, 100, 103), 'higher_is_better')).toBe('neutral');
    expect(getTrend(5, h(100, 100, 100, 97), 'higher_is_better')).toBe('neutral');
  });

  it('band metrics: in-band → neutral, outside → attention, never improving', () => {
    const band: [number, number] = [75, 88];
    expect(getTrend(5, h(80, 80, 80, 85), 'higher_is_better', band)).toBe('neutral');
    expect(getTrend(5, h(80, 80, 80, 92), 'higher_is_better', band)).toBe('attention');
    expect(getTrend(5, h(60, 60, 60, 80), 'higher_is_better', band)).toBe('neutral');
  });

  it('trend compares the LAST history point, regardless of the value shown on the tile (L4 fixed at call sites)', () => {
    expect(getTrend(999, h(10, 10, 10, 20), 'higher_is_better')).toBe('improving');
    expect(getTrend(1, h(10, 10, 10, 20), 'higher_is_better')).toBe('improving');
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
