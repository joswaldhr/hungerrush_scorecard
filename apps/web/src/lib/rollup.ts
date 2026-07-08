// Rollup view-model (Cadence): per-manager tone counts derived from the ONE
// trend engine via metricTone — this replaced the rollup's this-vs-last-week
// counting, the last pre-Cadence trend code (closes refactor-plan D6).
// Chips are trend counts and the card stat pair is flag counts — the two
// allowed aggregates; no composite, no rank. Pure functions; the hook fetches.
import type { MetricDefinition, Profile } from '@scorecard/shared';
import { metricTone } from './evidence';

export interface MetricToneCounts {
  win: number;
  discuss: number;
  steady: number;
  /** Trend not unlocked yet — fewer than 4 points in the window. */
  new: number;
  /** Reports with at least one point for this metric. */
  total: number;
}

export interface ManagerRollupRow {
  manager: Profile;
  employeeCount: number;
  /** Reports absent from the AD graph at the last org sync (0020) — badged, excluded from tone counts. */
  inactiveCount: number;
  /** Per metric key — only keys where at least one ACTIVE report has a point. */
  tones: Record<string, MetricToneCounts>;
  /** Flag counts across the team (person × metric), briefing-header class. */
  wins: number;
  toDiscuss: number;
}

export interface RollupSnapshotRow {
  employee_id: string;
  metric_key: string;
  value: number;
  period_start: string;
}

export function buildRollupRows(
  managers: Profile[],
  employees: Array<{ id: string; manager_id: string; is_active: boolean }>,
  definitions: MetricDefinition[],
  snapshots: RollupSnapshotRow[],
  currentWeek: string,
): ManagerRollupRow[] {
  // employeeId → metricKey → chronological points
  const byEmployee = new Map<string, Map<string, Array<{ periodStart: string; value: number }>>>();
  for (const s of snapshots) {
    let byMetric = byEmployee.get(s.employee_id);
    if (!byMetric) {
      byMetric = new Map();
      byEmployee.set(s.employee_id, byMetric);
    }
    const list = byMetric.get(s.metric_key) ?? [];
    list.push({ periodStart: s.period_start, value: s.value });
    byMetric.set(s.metric_key, list);
  }
  for (const byMetric of byEmployee.values()) {
    for (const list of byMetric.values()) {
      list.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
    }
  }

  const employeesByManager = new Map<string, Array<{ id: string; is_active: boolean }>>();
  for (const e of employees) {
    const list = employeesByManager.get(e.manager_id) ?? [];
    list.push({ id: e.id, is_active: e.is_active });
    employeesByManager.set(e.manager_id, list);
  }

  // Only profiles that actually manage employees get a row.
  const rows = managers
    .filter(m => employeesByManager.has(m.id))
    .map(manager => {
      const team = employeesByManager.get(manager.id) ?? [];
      // Inactive reports (no longer in the AD graph) stay in the headcount and
      // get a visible count on the card, but their FROZEN histories are
      // excluded from tone counts — a person who stopped syncing would
      // otherwise read "new"/"steady" forever and quietly skew the chips.
      const active = team.filter(e => e.is_active);
      const tones: Record<string, MetricToneCounts> = {};
      let wins = 0;
      let toDiscuss = 0;
      for (const def of definitions) {
        const counts: MetricToneCounts = { win: 0, discuss: 0, steady: 0, new: 0, total: 0 };
        for (const emp of active) {
          const points = byEmployee.get(emp.id)?.get(def.key);
          if (!points || points.length === 0) continue;
          counts[metricTone(points, def, currentWeek)]++;
          counts.total++;
        }
        if (counts.total > 0) tones[def.key] = counts;
        wins += counts.win;
        toDiscuss += counts.discuss;
      }
      return {
        manager,
        employeeCount: team.length,
        inactiveCount: team.length - active.length,
        tones,
        wins,
        toDiscuss,
      };
    });

  // Data-availability order (metrics with any coverage), then name — never a
  // performance rank.
  rows.sort((a, b) => {
    const aChips = Object.keys(a.tones).length;
    const bChips = Object.keys(b.tones).length;
    if (aChips !== bChips) return bChips - aChips;
    return a.manager.full_name.localeCompare(b.manager.full_name);
  });
  return rows;
}
