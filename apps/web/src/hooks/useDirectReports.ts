import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllPages } from '../lib/fetchAllPages';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import type { Employee } from '@scorecard/shared';

export interface EmployeePreviewMetrics {
  ticket_volume: number | null;
  first_reply_time: number | null;
  latestPeriodStart: string | null;
}

export function useDirectReports() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesWithMetrics, setEmployeesWithMetrics] = useState<Set<string>>(new Set());
  const [previewMetrics, setPreviewMetrics] = useState<Map<string, EmployeePreviewMetrics>>(new Map());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // UTC week identity from the shared util (L2) — must match the sync's period_start.
    const thisMonday = currentWeekStartUtc();
    const thisMondayStr = weekStartStr(thisMonday);
    const lastMondayStr = weekStartStr(weeksBeforeUtc(thisMonday, 1));

    // Both snapshot reads are paginated (L7: PostgREST caps unpaginated selects at
    // 1,000 rows). "Has data" is scoped to the current + last week — bounded forever,
    // and matches the window the dashboard actually previews.
    const [empRes, snapshotRes, previewRes] = await Promise.all([
      supabase
        .from('employees')
        .select('*')
        .order('full_name'),
      fetchAllPages<{ employee_id: string }>((from, to) =>
        supabase
          .from('metric_snapshots')
          .select('employee_id')
          .in('period_start', [thisMondayStr, lastMondayStr])
          .order('id')
          .range(from, to),
      ),
      fetchAllPages<{
        employee_id: string;
        metric_key: string;
        value: number;
        period_start: string;
        synced_at: string;
      }>((from, to) =>
        supabase
          .from('metric_snapshots')
          .select('employee_id, metric_key, value, period_start, synced_at')
          .in('metric_key', ['ticket_volume', 'first_reply_time'])
          .eq('period_start', thisMondayStr)
          .order('id')
          .range(from, to),
      ),
    ]);

    // Surface the first failure (S5) — the sections that DID load still render.
    const firstError = empRes.error ?? snapshotRes.error ?? previewRes.error;
    if (firstError) {
      setError(firstError.message);
    }

    if (!empRes.error) {
      setEmployees((empRes.data ?? []) as Employee[]);
    }

    if (snapshotRes.data) {
      const ids = new Set(snapshotRes.data.map(r => r.employee_id));
      setEmployeesWithMetrics(ids);
    }

    if (previewRes.data) {
      const map = new Map<string, EmployeePreviewMetrics>();
      let latestSync: string | null = null;

      for (const row of previewRes.data) {
        if (!map.has(row.employee_id)) {
          map.set(row.employee_id, { ticket_volume: null, first_reply_time: null, latestPeriodStart: null });
        }
        const entry = map.get(row.employee_id)!;
        const key = row.metric_key as 'ticket_volume' | 'first_reply_time';
        if (entry[key] === null) {
          entry[key] = row.value;
        }
        if (!entry.latestPeriodStart || row.period_start > entry.latestPeriodStart) {
          entry.latestPeriodStart = row.period_start;
        }
        if (!latestSync || row.synced_at > latestSync) {
          latestSync = row.synced_at;
        }
      }

      setPreviewMetrics(map);
      setLastSyncedAt(latestSync);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { employees, employeesWithMetrics, previewMetrics, lastSyncedAt, loading, error, refetch: load };
}
