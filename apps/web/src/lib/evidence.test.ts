import { describe, it, expect } from 'vitest';
import type { MetricDefinition } from '@scorecard/shared';
import {
  mapHistoryToWeekSlots,
  buildEvidenceMetrics,
  groupEvidenceBySource,
  isStale,
  SPARKLINE_WEEKS,
  STALE_AFTER_MS,
} from './evidence';
import type { EmployeeMetric } from './employeeMetrics';

function def(
  key: string,
  source: MetricDefinition['source'],
  direction: MetricDefinition['direction'],
  unit = 'count',
): MetricDefinition {
  return {
    id: `id-${key}`,
    key,
    name: key,
    unit,
    source,
    coaching_prompt: 'prompt',
    direction,
    is_active: true,
    display_order: 1,
    created_at: '2026-01-01',
  };
}

function metric(overrides: Partial<EmployeeMetric> & { definition: MetricDefinition }): EmployeeMetric {
  return {
    currentValue: null,
    currentSyncedAt: null,
    lastWeekValue: null,
    history: [],
    latestSyncedAt: null,
    ...overrides,
  };
}

describe('mapHistoryToWeekSlots', () => {
  it('keeps a missing week as an empty slot instead of packing the sequence (L5)', () => {
    const slots = mapHistoryToWeekSlots(
      [
        { periodStart: '2026-06-15', value: 10 },
        // 2026-06-22 missing
        { periodStart: '2026-06-29', value: 30 },
        { periodStart: '2026-07-06', value: 40 },
      ],
      '2026-07-06',
      4,
    );
    expect(slots).toEqual([{ periodStart: '2026-06-15', value: 10 }, null, { periodStart: '2026-06-29', value: 30 }, { periodStart: '2026-07-06', value: 40 }]);
  });

  it('produces exactly `weeks` slots, oldest first', () => {
    const slots = mapHistoryToWeekSlots([{ periodStart: '2026-07-06', value: 1 }], '2026-07-06', SPARKLINE_WEEKS);
    expect(slots).toHaveLength(SPARKLINE_WEEKS);
    expect(slots[SPARKLINE_WEEKS - 1]).toEqual({ periodStart: '2026-07-06', value: 1 });
    expect(slots.slice(0, SPARKLINE_WEEKS - 1).every(s => s === null)).toBe(true);
  });
});

describe('buildEvidenceMetrics', () => {
  it('assesses occupancy with the spec band (in-band big rise stays steady)', () => {
    const history = [
      { periodStart: '2026-06-15', value: 60 },
      { periodStart: '2026-06-22', value: 60 },
      { periodStart: '2026-06-29', value: 60 },
      { periodStart: '2026-07-06', value: 80 },
    ];
    const [row] = buildEvidenceMetrics(
      [metric({ definition: def('occupancy', 'assembled', 'higher_is_better', 'percent'), history, currentValue: 80 })],
      '2026-07-06',
    );
    expect(row!.assessment.tone).toBe('steady');
    expect(row!.domain).toEqual([55, 100]); // data (60–80) fits inside the spec domain

  });

  it('carries both labeled windows (this week + last week) through to the row', () => {
    const [row] = buildEvidenceMetrics(
      [metric({
        definition: def('ticket_volume', 'zendesk', 'higher_is_better'),
        currentValue: 12,
        lastWeekValue: 9,
        history: [{ periodStart: '2026-07-06', value: 12 }],
      })],
      '2026-07-06',
    );
    expect(row!.currentValue).toBe(12);
    expect(row!.lastWeekValue).toBe(9);
    expect(row!.assessment.tone).toBe('new');
    expect(row!.weeksOfHistory).toBe(1);
  });

  it('anchors count trends to the last completed week — a partial Monday is not a collapse', () => {
    const history = [
      { periodStart: '2026-06-08', value: 40 },
      { periodStart: '2026-06-15', value: 40 },
      { periodStart: '2026-06-22', value: 38 },
      { periodStart: '2026-06-29', value: 41 },
      { periodStart: '2026-07-06', value: 3 }, // in-progress week, 3 tickets so far
    ];
    const [row] = buildEvidenceMetrics(
      [metric({
        definition: def('ticket_volume', 'zendesk', 'higher_is_better'),
        history,
        currentValue: 3,
        lastWeekValue: 41,
      })],
      '2026-07-06',
    );
    expect(row!.assessment.current).toBe(41); // last COMPLETED week, not the partial 3
    expect(row!.assessment.tone).toBe('steady');
    expect(row!.assessedTiming).toBe('lastWeek');
    expect(row!.trendWeeks).toBe(4);
    expect(row!.weeksOfHistory).toBe(5);
    expect(row!.currentValue).toBe(3); // the headline still shows the live week
  });

  it('rate metrics keep the live current value and read as current', () => {
    const history = [
      { periodStart: '2026-06-15', value: 92 },
      { periodStart: '2026-06-22', value: 93 },
      { periodStart: '2026-06-29', value: 91 },
      { periodStart: '2026-07-06', value: 60 },
    ];
    const [row] = buildEvidenceMetrics(
      [metric({
        definition: def('csat_score', 'zendesk', 'higher_is_better', 'percent'),
        history,
        currentValue: 60,
      })],
      '2026-07-06',
    );
    expect(row!.assessment.current).toBe(60); // a live CSAT drop stays visible mid-week
    expect(row!.assessment.tone).toBe('discuss');
    expect(row!.assessedTiming).toBe('current');
  });

  it('a count with only the partial current week is "new" with an empty trend window', () => {
    const [row] = buildEvidenceMetrics(
      [metric({
        definition: def('ticket_volume', 'zendesk', 'higher_is_better'),
        history: [{ periodStart: '2026-07-06', value: 3 }],
        currentValue: 3,
      })],
      '2026-07-06',
    );
    expect(row!.assessment.tone).toBe('new');
    expect(row!.trendWeeks).toBe(0);
    expect(row!.assessedTiming).toBeNull();
  });
});

describe('groupEvidenceBySource', () => {
  const now = new Date('2026-07-07T12:00:00Z');

  it('groups in source order, takes the newest stamp and deepest history, and skips empty sources', () => {
    const rows = buildEvidenceMetrics(
      [
        metric({
          definition: def('occupancy', 'assembled', 'higher_is_better', 'percent'),
          history: [{ periodStart: '2026-07-06', value: 80 }],
          latestSyncedAt: '2026-07-07T10:00:00Z',
        }),
        metric({
          definition: def('ticket_volume', 'zendesk', 'higher_is_better'),
          history: [
            { periodStart: '2026-06-29', value: 9 },
            { periodStart: '2026-07-06', value: 12 },
          ],
          latestSyncedAt: '2026-07-07T11:00:00Z',
        }),
        metric({
          definition: def('csat_score', 'zendesk', 'higher_is_better', 'percent'),
          latestSyncedAt: '2026-07-07T09:00:00Z',
        }),
      ],
      '2026-07-06',
    );
    const groups = groupEvidenceBySource(rows, now);
    expect(groups.map(g => g.source)).toEqual(['zendesk', 'assembled']);
    expect(groups[0]!.latestSyncedAt).toBe('2026-07-07T11:00:00Z');
    expect(groups[0]!.weeksOfHistory).toBe(2);
    expect(groups[0]!.stale).toBe(false);
  });

  it('marks a source stale only past the 9h overnight-safe threshold', () => {
    expect(isStale('2026-07-07T03:30:00Z', now)).toBe(false); // 8.5h — overnight gap
    expect(isStale('2026-07-07T02:30:00Z', now)).toBe(true);  // 9.5h — degraded
    expect(isStale(null, now)).toBe(false);                   // never synced ≠ degraded
    expect(STALE_AFTER_MS).toBe(9 * 60 * 60 * 1000);
  });
});
