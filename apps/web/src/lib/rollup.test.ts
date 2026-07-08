import { describe, it, expect } from 'vitest';
import type { MetricDefinition, Profile } from '@scorecard/shared';
import { buildRollupRows, type RollupSnapshotRow } from './rollup';

const CURRENT_WEEK = '2026-07-06';
// Chronological completed weeks preceding CURRENT_WEEK.
const W = ['2026-06-01', '2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29'];

function manager(id: string, name: string): Profile {
  return {
    id,
    email: `${id}@hungerrush.com`,
    full_name: name,
    role: 'manager',
    manager_id: null,
    zendesk_agent_id: null,
    assembled_agent_id: null,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };
}

function def(
  key: string,
  direction: MetricDefinition['direction'],
  unit = 'percent',
): MetricDefinition {
  return {
    id: `id-${key}`,
    key,
    name: key,
    unit,
    source: 'zendesk',
    coaching_prompt: 'prompt',
    direction,
    is_active: true,
    display_order: 1,
    created_at: '2026-01-01',
  };
}

function snaps(
  employeeId: string,
  metricKey: string,
  byWeek: Record<string, number>,
): RollupSnapshotRow[] {
  return Object.entries(byWeek).map(([period_start, value]) => ({
    employee_id: employeeId,
    metric_key: metricKey,
    value,
    period_start,
  }));
}

const CSAT = def('csat_score', 'higher_is_better');

describe('buildRollupRows', () => {
  it('counts tones per metric from the one trend engine', () => {
    const rows = buildRollupRows(
      [manager('m1', 'Alex')],
      [
        { id: 'e1', manager_id: 'm1', is_active: true },
        { id: 'e2', manager_id: 'm1', is_active: true },
        { id: 'e3', manager_id: 'm1', is_active: true },
        { id: 'e4', manager_id: 'm1', is_active: true },
      ],
      [CSAT],
      [
        // e1: +12.5% vs prior average → win
        ...snaps('e1', 'csat_score', { [W[1]!]: 80, [W[2]!]: 80, [W[3]!]: 80, [W[4]!]: 80, [CURRENT_WEEK]: 90 }),
        // e2: −12.5% → discuss
        ...snaps('e2', 'csat_score', { [W[1]!]: 80, [W[2]!]: 80, [W[3]!]: 80, [W[4]!]: 80, [CURRENT_WEEK]: 70 }),
        // e3: +2.5% → steady
        ...snaps('e3', 'csat_score', { [W[1]!]: 80, [W[2]!]: 80, [W[3]!]: 80, [W[4]!]: 80, [CURRENT_WEEK]: 82 }),
        // e4: 2 points → new
        ...snaps('e4', 'csat_score', { [W[4]!]: 80, [CURRENT_WEEK]: 85 }),
      ],
      CURRENT_WEEK,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]!.tones['csat_score']).toEqual({ win: 1, discuss: 1, steady: 1, new: 1, total: 4 });
    expect(rows[0]!.wins).toBe(1);
    expect(rows[0]!.toDiscuss).toBe(1);
    expect(rows[0]!.employeeCount).toBe(4);
  });

  it('anchors count-unit trends to the last completed week (a partial Monday is not a collapse)', () => {
    const tickets = def('ticket_volume', 'higher_is_better', 'count');
    const rows = buildRollupRows(
      [manager('m1', 'Alex')],
      [{ id: 'e1', manager_id: 'm1', is_active: true }],
      [tickets],
      // Steady 50/wk for five completed weeks; the in-progress week has 3 so far.
      snaps('e1', 'ticket_volume', {
        [W[0]!]: 50, [W[1]!]: 50, [W[2]!]: 50, [W[3]!]: 50, [W[4]!]: 50, [CURRENT_WEEK]: 3,
      }),
      CURRENT_WEEK,
    );
    expect(rows[0]!.tones['ticket_volume']).toEqual({ win: 0, discuss: 0, steady: 1, new: 0, total: 1 });
  });

  it('band metrics count steady inside the band and discuss outside — never win', () => {
    const occupancy = def('occupancy', 'higher_is_better');
    occupancy.key = 'occupancy'; // spec band 75–88
    const rows = buildRollupRows(
      [manager('m1', 'Alex')],
      [
        { id: 'e1', manager_id: 'm1', is_active: true },
        { id: 'e2', manager_id: 'm1', is_active: true },
      ],
      [occupancy],
      [
        // e1 rises a lot but stays in band → steady
        ...snaps('e1', 'occupancy', { [W[1]!]: 76, [W[2]!]: 76, [W[3]!]: 76, [W[4]!]: 76, [CURRENT_WEEK]: 86 }),
        // e2 above the band → discuss (burnout-risk framing, not a win)
        ...snaps('e2', 'occupancy', { [W[1]!]: 80, [W[2]!]: 80, [W[3]!]: 80, [W[4]!]: 80, [CURRENT_WEEK]: 95 }),
      ],
      CURRENT_WEEK,
    );
    expect(rows[0]!.tones['occupancy']).toEqual({ win: 0, discuss: 1, steady: 1, new: 0, total: 2 });
  });

  it('sorts snapshots chronologically itself — caller query order cannot leak in', () => {
    const ordered = snaps('e1', 'csat_score', {
      [W[1]!]: 80, [W[2]!]: 80, [W[3]!]: 80, [W[4]!]: 80, [CURRENT_WEEK]: 90,
    });
    const rows = buildRollupRows(
      [manager('m1', 'Alex')],
      [{ id: 'e1', manager_id: 'm1', is_active: true }],
      [CSAT],
      [...ordered].reverse(),
      CURRENT_WEEK,
    );
    expect(rows[0]!.tones['csat_score']!.win).toBe(1);
  });

  it('drops profiles that manage no employees and omits metrics nobody has points for', () => {
    const rows = buildRollupRows(
      [manager('m1', 'Alex'), manager('m2', 'Blake')],
      [{ id: 'e1', manager_id: 'm1', is_active: true }],
      [CSAT, def('resolution_rate', 'higher_is_better')],
      snaps('e1', 'csat_score', { [CURRENT_WEEK]: 90 }),
      CURRENT_WEEK,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.manager.id).toBe('m1');
    expect(rows[0]!.tones['resolution_rate']).toBeUndefined();
    expect(rows[0]!.tones['csat_score']!.total).toBe(1);
  });

  it('excludes no-longer-synced reports from tone counts but keeps them in the headcount', () => {
    const rows = buildRollupRows(
      [manager('m1', 'Alex')],
      [
        { id: 'e1', manager_id: 'm1', is_active: true },
        { id: 'e2', manager_id: 'm1', is_active: false }, // ghost — frozen history
      ],
      [CSAT],
      [
        ...snaps('e1', 'csat_score', { [W[1]!]: 80, [W[2]!]: 80, [W[3]!]: 80, [W[4]!]: 80, [CURRENT_WEEK]: 90 }),
        // The ghost has a full (frozen) history that would otherwise count as steady.
        ...snaps('e2', 'csat_score', { [W[1]!]: 80, [W[2]!]: 80, [W[3]!]: 80, [W[4]!]: 80, [CURRENT_WEEK]: 80 }),
      ],
      CURRENT_WEEK,
    );
    expect(rows[0]!.employeeCount).toBe(2);
    expect(rows[0]!.inactiveCount).toBe(1);
    expect(rows[0]!.tones['csat_score']).toEqual({ win: 1, discuss: 0, steady: 0, new: 0, total: 1 });
  });

  it('orders by metric coverage then name — data availability, not performance', () => {
    const rows = buildRollupRows(
      [manager('m1', 'Avery'), manager('m2', 'Blake'), manager('m3', 'Casey')],
      [
        { id: 'e1', manager_id: 'm1', is_active: true },
        { id: 'e2', manager_id: 'm2', is_active: true },
        { id: 'e3', manager_id: 'm3', is_active: true },
      ],
      [CSAT, def('resolution_rate', 'higher_is_better')],
      [
        // Casey's team covers two metrics; Avery and Blake one each.
        ...snaps('e3', 'csat_score', { [CURRENT_WEEK]: 90 }),
        ...snaps('e3', 'resolution_rate', { [CURRENT_WEEK]: 90 }),
        ...snaps('e1', 'csat_score', { [CURRENT_WEEK]: 50 }),
        ...snaps('e2', 'csat_score', { [CURRENT_WEEK]: 99 }),
      ],
      CURRENT_WEEK,
    );
    expect(rows.map(r => r.manager.full_name)).toEqual(['Casey', 'Avery', 'Blake']);
  });
});
