import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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

  useEffect(() => {
    async function load() {
      const [empRes, snapshotRes, previewRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .order('full_name'),
        supabase
          .from('metric_snapshots')
          .select('employee_id'),
        supabase
          .from('metric_snapshots')
          .select('employee_id, metric_key, value, period_start, synced_at')
          .in('metric_key', ['ticket_volume', 'first_reply_time'])
          .order('period_start', { ascending: false }),
      ]);

      if (empRes.error) {
        setError(empRes.error.message);
      } else {
        setEmployees((empRes.data ?? []) as Employee[]);
      }

      if (snapshotRes.data) {
        const ids = new Set(snapshotRes.data.map((r: { employee_id: string }) => r.employee_id));
        setEmployeesWithMetrics(ids);
      }

      if (previewRes.data) {
        const map = new Map<string, EmployeePreviewMetrics>();
        let latestSync: string | null = null;

        for (const row of previewRes.data as Array<{
          employee_id: string;
          metric_key: string;
          value: number;
          period_start: string;
          synced_at: string;
        }>) {
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
    }

    load();
  }, []);

  return { employees, employeesWithMetrics, previewMetrics, lastSyncedAt, loading, error };
}
