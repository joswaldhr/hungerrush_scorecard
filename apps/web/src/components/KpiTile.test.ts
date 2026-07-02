// Characterization tests — pin CURRENT trend-badge behavior (getTrend) before Phase 1B/1C.
// L4 (Last Week tiles receive current-week history) and L12 (partial-week comparison) are
// consequences of how callers use this function; the function's own quirks are pinned here.
import { describe, it, expect } from 'vitest';
import { getTrend } from './KpiTile';

const h = (...values: number[]) => values.map(value => ({ value }));

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

  it('PRESERVE-FOR-PARITY (L4/L12): trend always compares the LAST history point, regardless of the value shown on the tile', () => {
    // The `value` argument only gates null; the comparison uses history's last element.
    // This is why Last Week tiles show a current-week trend when given full history.
    expect(getTrend(999, h(10, 10, 20), 'higher_is_better')).toBe('improving');
    expect(getTrend(1, h(10, 10, 20), 'higher_is_better')).toBe('improving');
  });
});
