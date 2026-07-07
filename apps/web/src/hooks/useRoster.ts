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

export interface RosterEntry {
  employee: Employee;
  summary: { tone: TrendTone; label: string };
  lastSessionDate: string | null;
  /** True when at least one active metric has a snapshot in the window. */
  hasData: boolean;
}

/** How far back a 1:1 still counts as the chip's "last session". */
const SESSION_LOOKBACK_WEEKS = 26;

/**
 * Roster strip data: every visible employee (RLS scopes who that is) with a
 * trend-tone summary over the sparkline window and their most recent 1:1.
 * Tones only include metrics that have at least one point, so a person with
 * no data reads "no data yet" rather than "ramping".
 */
export function useRoster() {
  const [entries, setEntries] = useState<RosterEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const thisMonday = currentWeekStartUtc();
    const windowStartStr = weekStartStr(weeksBeforeUtc(thisMonday, SPARKLINE_WEEKS - 1));
    const sessionFloor = weekStartStr(weeksBeforeUtc(thisMonday, SESSION_LOOKBACK_WEEKS));

    const [empRes, defsRes, snapshotsRes, sessionsRes] = await Promise.all([
      supabase.from('employees').select('*').order('full_name'),
      supabase.from('metric_definitions').select('*').eq('is_active', true).order('display_order'),
      // Paginated (L7): 8 weeks × all visible employees exceeds PostgREST's 1,000-row cap.
      fetchAllPages<{ employee_id: string; metric_key: string; value: number; period_start: string }>(
        (from, to) =>
          supabase
            .from('metric_snapshots')
            .select('employee_id, metric_key, value, period_start')
            .gte('period_start', windowStartStr)
            .order('id')
            .range(from, to),
      ),
      fetchAllPages<{ employee_id: string; session_date: string }>((from, to) =>
        supabase
          .from('scorecard_sessions')
          .select('employee_id, session_date')
          .gte('session_date', sessionFloor)
          .order('id')
          .range(from, to),
      ),
    ]);

    // Surface the first failure (S5) — sections that DID load still render.
    const firstError = empRes.error ?? defsRes.error ?? snapshotsRes.error ?? sessionsRes.error;
    if (firstError) setError(firstError.message);

    const employees = (empRes.data ?? []) as Employee[];
    const defs = (defsRes.data ?? []) as MetricDefinition[];

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
          if (byMetric) {
            for (const def of defs) {
              const points = byMetric.get(def.key);
              if (!points || points.length === 0) continue;
              points.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
              const spec = METRIC_SPECS[def.key];
              tones.push(assessTrend(points.map(p => p.value), def.direction, spec?.band).tone);
            }
          }
          return {
            employee,
            summary: rosterSummary(tones),
            lastSessionDate: lastSessionByEmployee.get(employee.id) ?? null,
            hasData: tones.length > 0,
          };
        }),
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { entries, loading, error, refetch: load };
}
