import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { fetchAllPages } from '../lib/fetchAllPages';
import {
  currentWeekStartUtc,
  weeksBeforeUtc,
  weekStartStr,
  type Employee,
  type MetricDefinition,
  type TrendTone,
} from '@scorecard/shared';
import { SPARKLINE_WEEKS, metricTone } from '../lib/evidence';
import { rosterSummary } from '../lib/coaching';
import { SESSION_LOOKBACK_WEEKS } from './useScorecardNotes';

export interface RosterEntry {
  employee: Employee;
  summary: { tone: TrendTone; label: string };
  lastSessionDate: string | null;
  hasData: boolean;
}

export function useRoster(managerId: string | null = null) {
  const { data: entries = [], isLoading: loading, error, refetch } = useQuery({
    queryKey: ['roster', managerId],
    queryFn: async () => {
      const thisMonday = currentWeekStartUtc();
      const thisMondayStr = weekStartStr(thisMonday);
      const windowStartStr = weekStartStr(weeksBeforeUtc(thisMonday, SPARKLINE_WEEKS - 1));
      const lastMondayStr = weekStartStr(weeksBeforeUtc(thisMonday, 1));
      const sessionFloor = weekStartStr(weeksBeforeUtc(thisMonday, SESSION_LOOKBACK_WEEKS));

      const empQuery = supabase.from('employees').select('*').order('full_name');
      const [empRes, defsRes] = await Promise.all([
        managerId ? empQuery.eq('manager_id', managerId) : empQuery,
        supabase.from('metric_definitions').select('*').eq('is_active', true).order('display_order'),
      ]);

      const firstError = empRes.error ?? defsRes.error;
      if (firstError) throw new Error(firstError.message);

      const employees = (empRes.data ?? []) as Employee[];
      const defs = (defsRes.data ?? []) as MetricDefinition[];
      const activeKeys = defs.map(d => d.key);
      const scopeIds = managerId ? employees.map(e => e.id) : null;

      if (employees.length === 0 || activeKeys.length === 0) return [];

      const [snapshotsRes, sessionsRes] = await Promise.all([
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

      if (snapshotsRes.error) throw new Error(snapshotsRes.error.message);
      if (sessionsRes.error) throw new Error(sessionsRes.error.message);

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

      return employees.map(employee => {
        const byMetric = byEmployee.get(employee.id);
        const tones: TrendTone[] = [];
        let hasData = false;
        if (byMetric) {
          for (const def of defs) {
            const points = byMetric.get(def.key);
            if (!points || points.length === 0) continue;
            points.sort((a, b) => a.periodStart.localeCompare(b.periodStart));
            tones.push(metricTone(points, def, thisMondayStr));
            if (points[points.length - 1]!.periodStart >= lastMondayStr) hasData = true;
          }
        }
        return {
          employee,
          summary: rosterSummary(tones),
          lastSessionDate: lastSessionByEmployee.get(employee.id) ?? null,
          hasData,
        };
      });
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return { entries, loading, error: error ? error.message : null, refetch };
}
