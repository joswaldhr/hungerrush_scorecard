import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllPages } from '../lib/fetchAllPages';
import {
  METRIC_SPECS,
  assessTrend,
  currentWeekStartUtc,
  weeksBeforeUtc,
  weekStartStr,
  type Employee,
  type MetricDefinition,
  type TrendTone,
} from '@scorecard/shared';
import { SPARKLINE_WEEKS } from '../lib/evidence';
import { rosterSummary } from '../lib/coaching';
import { SESSION_LOOKBACK_WEEKS } from './useScorecardNotes';

export interface RosterEntry {
  employee: Employee;
  summary: { tone: TrendTone; label: string };
  lastSessionDate: string | null;
  /** True when at least one active metric has a snapshot in the current or last week. */
  hasData: boolean;
}

/**
 * Roster strip data: every visible employee (RLS scopes who that is; pass a
 * managerId to scope a rollup drill-down server-side) with a trend-tone
 * summary over the sparkline window and their most recent 1:1. Tones only
 * include metrics that have at least one point, so a person with no data
 * reads "no data yet" rather than "ramping". hasData keeps the old
 * dashboard's meaning — actively syncing (current or last week) — so people
 * whose data stopped weeks ago don't crowd the default view.
 */
export function useRoster(managerId: string | null = null) {
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const thisMonday = currentWeekStartUtc();
    const windowStartStr = weekStartStr(weeksBeforeUtc(thisMonday, SPARKLINE_WEEKS - 1));
    const lastMondayStr = weekStartStr(weeksBeforeUtc(thisMonday, 1));
    const sessionFloor = weekStartStr(weeksBeforeUtc(thisMonday, SESSION_LOOKBACK_WEEKS));

    // Wave 1: who + which metrics. Wave 2 scopes its queries by both.
    const empQuery = supabase.from('employees').select('*').order('full_name');
    const [empRes, defsRes] = await Promise.all([
      managerId ? empQuery.eq('manager_id', managerId) : empQuery,
      supabase.from('metric_definitions').select('*').eq('is_active', true).order('display_order'),
    ]);

    const employees = (empRes.data ?? []) as Employee[];
    const defs = (defsRes.data ?? []) as MetricDefinition[];
    const activeKeys = defs.map(d => d.key);
    // Only manager-scoped rosters filter by employee id — an org-wide id list
    // would blow past URL length limits; RLS already scopes the wide case.
    const scopeIds = managerId ? employees.map(e => e.id) : null;

    const [snapshotsRes, sessionsRes] =
      employees.length === 0 || activeKeys.length === 0
        ? [{ data: [], error: null }, { data: [], error: null }]
        : await Promise.all([
            // Paginated (L7): 8 weeks × all visible employees exceeds PostgREST's 1,000-row cap.
            fetchAllPages<{ employee_id: string; metric_key: string; value: number; period_start: string }>(
              (from, to) => {
                let q = supabase
                  .from('metric_snapshots')
                  .select('employee_id, metric_key, value, period_start')
                  .gte('period_start', windowStartStr)
                  .in('metric_key', activeKeys);
                if (scopeIds) q = q.in('employee_id', scopeIds);
                return q.order('id').range(from, to);
              },
            ),
            fetchAllPages<{ employee_id: string; session_date: string }>((from, to) => {
              let q = supabase
                .from('scorecard_sessions')
                .select('employee_id, session_date')
                .gte('session_date', sessionFloor);
              if (scopeIds) q = q.in('employee_id', scopeIds);
              return q.order('id').range(from, to);
            }),
          ]);

    // Surface the first failure (S5) — sections that DID load still render.
    const firstError = empRes.error ?? defsRes.error ?? snapshotsRes.error ?? sessionsRes.error;
    if (firstError) setError(firstError.message);

    if (!empRes.error) {
      // values per employee per metric, chronological
      const byEmployee = new Map<string, Map<string, Array<{ periodStart: string; value: number }>>>();
      for (const row of snapshotsRes.data ?? []) {
        let byMetric = byEmployee.get(row.employee_id);
        if (!byMetric) {
          byMetric = new Map();
          byEmployee.set(row.employee_id, byMetric);
        }
        const list = byMetric.get(row.metric_key) ?? [];
        list.push({ periodStart: row.period_start, value: row.value });
        byMetric.set(row.metric_key, list);
      }

      const lastSessionByEmployee = new Map<string, string>();
      for (const s of sessionsRes.data ?? []) {
        const prev = lastSessionByEmployee.get(s.employee_id);
        if (!prev || s.session_date > prev) lastSessionByEmployee.set(s.employee_id, s.session_date);
      }

      setEntries(
        employees.map(employee => {
          const byMetric = byEmployee.get(employee.id);
          const tones: TrendTone[] = [];
          let hasData = false;
          if (byMetric) {
            for (const def of defs) {
              const points = byMetric.get(def.key);
              if (!points || points.length === 0) continue;
              points.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
              const spec = METRIC_SPECS[def.key];
              tones.push(assessTrend(points.map(p => p.value), def.direction, spec?.band).tone);
              if (points[points.length - 1]!.periodStart >= lastMondayStr) hasData = true;
            }
          }
          return {
            employee,
            summary: rosterSummary(tones),
            lastSessionDate: lastSessionByEmployee.get(employee.id) ?? null,
            hasData,
          };
        }),
      );
    }

    setLoading(false);
  }, [managerId]);

  useEffect(() => {
    // New scope key: drop the previous scope's entries (S5 key-change reset).
    setEntries([]);
    load();
  }, [load]);

  return { entries, loading, error, refetch: load };
}
