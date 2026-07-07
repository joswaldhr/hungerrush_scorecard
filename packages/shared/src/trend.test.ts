// Pins the ONE Cadence trend definition (ADOPTION.md decision 4): current vs
// prior-period average (up to 4 preceding points), ±6% steady band inclusive,
// direction-aware, band metrics, <4 points = "new".
import { describe, it, expect } from 'vitest';
import { assessTrend, resolveDomain, trendWindow } from './trend';

describe('assessTrend — sparse history ("new")', () => {
  it('is "new" for an empty window, with null fields', () => {
    expect(assessTrend([], 'higher_is_better')).toEqual({
      tone: 'new',
      current: null,
      priorAverage: null,
      absoluteChange: null,
      pctChange: null,
      bandPosition: null,
    });
  });

  it('is "new" below 4 points and still reports the current value', () => {
    const a = assessTrend([90, 95, 97], 'higher_is_better');
    expect(a.tone).toBe('new');
    expect(a.current).toBe(97);
    expect(a.priorAverage).toBeNull();
  });

  it('unlocks at exactly 4 points', () => {
    expect(assessTrend([90, 90, 90, 90], 'higher_is_better').tone).not.toBe('new');
  });

  it('band metrics are also "new" when sparse', () => {
    expect(assessTrend([95, 96], 'higher_is_better', [75, 88]).tone).toBe('new');
  });
});

describe('assessTrend — direction-aware ±6%', () => {
  it('win when higher_is_better rises more than 6% above the prior average', () => {
    const a = assessTrend([10, 10, 10, 11], 'higher_is_better');
    expect(a.tone).toBe('win');
    expect(a.priorAverage).toBe(10);
    expect(a.pctChange).toBeCloseTo(10);
  });

  it('steady inside the ±6% band', () => {
    expect(assessTrend([100, 100, 100, 105], 'higher_is_better').tone).toBe('steady');
    expect(assessTrend([100, 100, 100, 95], 'higher_is_better').tone).toBe('steady');
  });

  it('the 6% boundary is inclusive on both sides', () => {
    expect(assessTrend([100, 100, 100, 106], 'higher_is_better').tone).toBe('win');
    expect(assessTrend([100, 100, 100, 94], 'higher_is_better').tone).toBe('discuss');
  });

  it('inverts for lower_is_better (a falling reply time is a win)', () => {
    expect(assessTrend([100, 100, 100, 90], 'lower_is_better').tone).toBe('win');
    expect(assessTrend([100, 100, 100, 110], 'lower_is_better').tone).toBe('discuss');
  });
});

describe('assessTrend — prior window is the 4 points immediately preceding current', () => {
  it('ignores points older than the window', () => {
    // Without the cap the 1000s would drag the prior average to ~434 → discuss.
    const a = assessTrend([1000, 1000, 1000, 10, 10, 10, 10, 10], 'higher_is_better');
    expect(a.priorAverage).toBe(10);
    expect(a.tone).toBe('steady');
  });

  it('uses only 3 priors at exactly 4 points', () => {
    const a = assessTrend([10, 20, 30, 20], 'higher_is_better');
    expect(a.priorAverage).toBe(20);
  });
});

describe('assessTrend — band metrics (healthy range, not a direction)', () => {
  const band: [number, number] = [75, 88];

  it('steady inside the band, inclusive at both edges', () => {
    expect(assessTrend([80, 80, 80, 75], 'higher_is_better', band).tone).toBe('steady');
    expect(assessTrend([80, 80, 80, 88], 'higher_is_better', band).tone).toBe('steady');
  });

  it('discuss outside the band in either direction — never "win"', () => {
    expect(assessTrend([80, 80, 80, 92], 'higher_is_better', band).tone).toBe('discuss');
    expect(assessTrend([80, 80, 80, 70], 'higher_is_better', band).tone).toBe('discuss');
  });

  it('exposes bandPosition as the single boundary comparison', () => {
    expect(assessTrend([80, 80, 80, 92], 'higher_is_better', band).bandPosition).toBe('above');
    expect(assessTrend([80, 80, 80, 70], 'higher_is_better', band).bandPosition).toBe('below');
    expect(assessTrend([80, 80, 80, 80], 'higher_is_better', band).bandPosition).toBe('in');
    expect(assessTrend([80, 80, 80, 80], 'higher_is_better').bandPosition).toBeNull();
    expect(assessTrend([80, 92], 'higher_is_better', band).bandPosition).toBeNull(); // sparse
  });

  it('a big in-band improvement still reads steady (band has no win state)', () => {
    expect(assessTrend([60, 60, 60, 80], 'higher_is_better', band).tone).toBe('steady');
  });
});

describe('assessTrend — zero prior average (no percentage exists)', () => {
  it('movement off zero is judged by direction, with pctChange null', () => {
    const up = assessTrend([0, 0, 0, 5], 'higher_is_better');
    expect(up.tone).toBe('win');
    expect(up.pctChange).toBeNull();
    expect(up.absoluteChange).toBe(5);
    expect(assessTrend([0, 0, 0, 5], 'lower_is_better').tone).toBe('discuss');
  });

  it('all-zero stays steady', () => {
    expect(assessTrend([0, 0, 0, 0], 'higher_is_better').tone).toBe('steady');
  });
});

describe('trendWindow — counts measure through the last completed week', () => {
  const p = (periodStart: string, value: number) => ({ periodStart, value });
  const CURRENT = '2026-07-06';
  const history = [p('2026-06-15', 40), p('2026-06-22', 38), p('2026-06-29', 41), p(CURRENT, 3)];

  it('drops the in-progress week for count metrics (partial sums are bias, not noise)', () => {
    expect(trendWindow(history, 'count', CURRENT, CURRENT)).toEqual(history.slice(0, 3));
  });

  it('keeps the live value for rates and averages', () => {
    expect(trendWindow(history, 'percent', CURRENT, CURRENT)).toEqual(history);
    expect(trendWindow(history, 'seconds', CURRENT, CURRENT)).toEqual(history);
  });

  it('passes frozen views through untouched — a completed anchor week has no partial bias', () => {
    const frozen = history.slice(0, 3); // last-week view: history ends at a completed week
    expect(trendWindow(frozen, 'count', '2026-06-29', CURRENT)).toEqual(frozen);
  });

  it('a count with only the partial current week yields an empty window (tone "new")', () => {
    expect(trendWindow([p(CURRENT, 3)], 'count', CURRENT, CURRENT)).toEqual([]);
  });
});

describe('resolveDomain — spec domain is the minimum extent', () => {
  it('keeps the spec domain when data fits inside it', () => {
    expect(resolveDomain([70, 100], [90, 95, 92])).toEqual([70, 100]);
  });

  it('extends an edge instead of clipping an outlier', () => {
    expect(resolveDomain([70, 100], [50, 95])).toEqual([50, 100]);
    expect(resolveDomain([0, 70], [10, 110])).toEqual([0, 110]);
  });

  it('falls back to the data extent without a spec domain', () => {
    expect(resolveDomain(undefined, [5, 9, 7])).toEqual([5, 9]);
  });
});
