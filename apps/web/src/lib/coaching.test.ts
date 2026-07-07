import { describe, it, expect } from 'vitest';
import { assessTrend, type TrendAssessment } from '@scorecard/shared';
import type { AssessedTiming } from './evidence';
import {
  buildTalkingPoints,
  rosterSummary,
  NEW_HIRE_COPY,
  STEADY_WEEK_COPY,
  STEADY_WEEK_SUGGESTION,
  type AssessedMetric,
} from './coaching';

function assessed(
  key: string,
  label: string,
  unit: string,
  assessment: Partial<TrendAssessment> & { tone: TrendAssessment['tone'] },
  timing: AssessedTiming | null = 'current',
): AssessedMetric {
  return {
    key,
    label,
    unit,
    timing,
    assessment: {
      current: 10,
      priorAverage: 10,
      absoluteChange: 0,
      pctChange: 0,
      bandPosition: null,
      ...assessment,
    },
  };
}

describe('buildTalkingPoints — flags only', () => {
  it('a discuss flag becomes the lead point with an opening question', () => {
    const points = buildTalkingPoints([
      assessed('first_reply_time', 'First Reply Time', 'seconds', {
        tone: 'discuss', current: 2520, priorAverage: 1800, absoluteChange: 720, pctChange: 40,
      }),
    ]);
    expect(points).toHaveLength(1);
    expect(points[0]!.kind).toBe('discuss');
    expect(points[0]!.text).toBe('First Reply Time up 40% — 42.0 min now.');
    expect(points[0]!.ask).toContain('changed in your queue');
  });

  it('orders discuss before celebrate regardless of metric order', () => {
    const points = buildTalkingPoints([
      assessed('csat_score', 'Customer Satisfaction', 'percent', {
        tone: 'win', current: 96, priorAverage: 88, absoluteChange: 8, pctChange: 9.1,
      }),
      assessed('ticket_volume', 'Ticket Volume', 'count', {
        tone: 'discuss', current: 30, priorAverage: 40, absoluteChange: -10, pctChange: -25,
      }),
    ]);
    expect(points.map(p => p.kind)).toEqual(['discuss', 'celebrate']);
    expect(points[1]!.text).toBe('Customer Satisfaction up 9% vs. the last few weeks.');
  });

  it('only the first discuss and first celebrate keep their ask', () => {
    const discuss = (key: string) =>
      assessed(key, key, 'count', {
        tone: 'discuss', current: 5, priorAverage: 10, absoluteChange: -5, pctChange: -50,
      });
    const win = (key: string) =>
      assessed(key, key, 'count', {
        tone: 'win', current: 20, priorAverage: 10, absoluteChange: 10, pctChange: 100,
      });
    const points = buildTalkingPoints([discuss('a'), discuss('b'), win('c'), win('d')]);
    expect(points.map(p => Boolean(p.ask))).toEqual([true, false, true, false]);
  });

  it('steady and new metrics contribute nothing', () => {
    const points = buildTalkingPoints([
      assessed('a', 'A', 'count', { tone: 'steady' }),
      assessed('b', 'B', 'count', { tone: 'new', priorAverage: null, absoluteChange: null, pctChange: null }),
    ]);
    expect(points).toEqual([]);
  });

  it('above-band occupancy gets the sustainability framing and pace question', () => {
    const points = buildTalkingPoints([
      assessed('occupancy', 'Occupancy', 'percent', {
        tone: 'discuss', current: 93, priorAverage: 90, absoluteChange: 3, pctChange: 3.3,
        bandPosition: 'above',
      }),
    ]);
    expect(points[0]!.text).toBe(
      'Occupancy at 93.0% — above the healthy range; worth checking the pace is sustainable.',
    );
    expect(points[0]!.ask).toContain('pace');
  });

  it('below-band occupancy names the healthy range without a direction judgment', () => {
    const points = buildTalkingPoints([
      assessed('occupancy', 'Occupancy', 'percent', {
        tone: 'discuss', current: 62, priorAverage: 70, absoluteChange: -8, pctChange: -11.4,
        bandPosition: 'below',
      }),
    ]);
    expect(points[0]!.text).toBe('Occupancy at 62.0% — below the healthy range this week.');
  });

  it('never says "now" about a value that is not this week\'s', () => {
    const points = buildTalkingPoints([
      assessed('first_reply_time', 'First Reply Time', 'seconds', {
        tone: 'discuss', current: 2520, priorAverage: 1800, absoluteChange: 720, pctChange: 40,
      }, 'stale'),
    ]);
    expect(points[0]!.text).toBe('First Reply Time up 40% — 42.0 min at last sync.');
    expect(points[0]!.text).not.toContain('now');
  });

  it('anchored count metrics speak in last-week tense', () => {
    const points = buildTalkingPoints([
      assessed('ticket_volume', 'Ticket Volume', 'count', {
        tone: 'discuss', current: 25, priorAverage: 40, absoluteChange: -15, pctChange: -37.5,
      }, 'lastWeek'),
    ]);
    expect(points[0]!.text).toBe('Ticket Volume down 38% — 25 last week.');
    expect(points[0]!.text).not.toContain('now');
  });

  it('a win off a zero prior average reads as building, not a percentage', () => {
    const points = buildTalkingPoints([
      assessed('ticket_volume', 'Ticket Volume', 'count', {
        tone: 'win', current: 5, priorAverage: 0, absoluteChange: 5, pctChange: null,
      }),
    ]);
    expect(points[0]!.text).toBe('Ticket Volume at 5 this week — building from a quiet stretch.');
  });

  it('integrates with assessTrend end-to-end', () => {
    const a = assessTrend([1800, 1800, 1800, 2520], 'lower_is_better');
    const points = buildTalkingPoints([
      { key: 'first_reply_time', label: 'First Reply Time', unit: 'seconds', timing: 'current', assessment: a },
    ]);
    expect(points[0]!.kind).toBe('discuss');
    expect(points[0]!.text).toContain('up 40%');
  });

  it('context branches stay dormant without context but exist for the fast-follow', () => {
    const none = buildTalkingPoints([assessed('a', 'A', 'count', { tone: 'steady' })]);
    expect(none).toEqual([]);

    const withContext = buildTalkingPoints(
      [assessed('a', 'A', 'count', { tone: 'steady' })],
      { growth: 'Interested in the team-lead track', personal: 'Work anniversary next week' },
    );
    expect(withContext.map(p => p.kind)).toEqual(['growth', 'note']);
    expect(withContext[0]!.ask).toContain('stretch project');
  });
});

describe('rosterSummary — coaching-safe flag counts', () => {
  it('no data yet for an empty tone list', () => {
    expect(rosterSummary([])).toEqual({ tone: 'new', label: 'no data yet' });
  });

  it('ramping when every metric is new', () => {
    expect(rosterSummary(['new', 'new'])).toEqual({ tone: 'new', label: 'ramping' });
  });

  it('on track with zero discuss flags', () => {
    expect(rosterSummary(['win', 'steady', 'steady'])).toEqual({ tone: 'win', label: 'on track' });
  });

  it('one to discuss / focus this week by discuss count', () => {
    expect(rosterSummary(['discuss', 'steady'])).toEqual({ tone: 'steady', label: 'one to discuss' });
    expect(rosterSummary(['discuss', 'discuss', 'win'])).toEqual({ tone: 'discuss', label: 'focus this week' });
  });
});

describe('coaching-language rules over every engine string', () => {
  const FORBIDDEN = [
    'failing', 'below target', 'underperforming', 'score', 'red flag',
    // ADOPTION.md repairs: nothing that echoes "flag" or "needs attention"
    'flag', 'needs attention', 'alarm',
  ];

  it('no forbidden word appears in any generated output', () => {
    const everyText: string[] = [NEW_HIRE_COPY, STEADY_WEEK_COPY, STEADY_WEEK_SUGGESTION];

    const tones: Array<Partial<TrendAssessment> & { tone: TrendAssessment['tone'] }> = [
      { tone: 'discuss', current: 30, priorAverage: 40, absoluteChange: -10, pctChange: -25 },
      { tone: 'discuss', current: 5, priorAverage: 0, absoluteChange: 5, pctChange: null },
      { tone: 'win', current: 96, priorAverage: 88, absoluteChange: 8, pctChange: 9.1 },
      { tone: 'win', current: 5, priorAverage: 0, absoluteChange: 5, pctChange: null },
    ];
    for (const t of tones) {
      for (const p of buildTalkingPoints([assessed('m', 'Metric Name', 'count', t)])) {
        everyText.push(p.text, p.ask ?? '');
      }
    }
    for (const bandCur of [93, 62]) {
      for (const p of buildTalkingPoints([
        assessed('occupancy', 'Occupancy', 'percent', {
          tone: 'discuss', current: bandCur, priorAverage: 80,
          absoluteChange: bandCur - 80, pctChange: ((bandCur - 80) / 80) * 100,
          bandPosition: bandCur > 88 ? 'above' : 'below',
        }),
      ])) {
        everyText.push(p.text, p.ask ?? '');
      }
    }
    for (const toneList of [[], ['new', 'new'], ['win'], ['discuss'], ['discuss', 'discuss']] as const) {
      everyText.push(rosterSummary([...toneList]).label);
    }

    for (const text of everyText) {
      for (const word of FORBIDDEN) {
        expect(text.toLowerCase()).not.toContain(word);
      }
    }
  });
});
