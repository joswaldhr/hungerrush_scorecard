import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import type { MetricDefinition, MetricSnapshot } from '@scorecard/shared';
import { buildEmployeeMetrics, type EmployeeMetric } from '../lib/employeeMetrics';
import { SPARKLINE_WEEKS } from '../lib/evidence';

export function useEmployeeMetrics(employeeId: string) {
  const [metrics, setMetrics] = useState<EmployeeMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    // UTC week identity from the shared util (L2) — must match the sync's period_start.
    // 8-week window (Cadence): sparklines show up to 8 calendar slots and the trend
    // engine averages up to the 4 points preceding the current one.
    const thisMonday = currentWeekStartUtc();
    const windowStartStr = weekStartStr(weeksBeforeUtc(thisMonday, SPARKLINE_WEEKS - 1));

    const [snapshotsRes, definitionsRes] = await Promise.all([
      supabase
        .from('metric_snapshots')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('period_start', windowStartStr)
        .order('period_start'),
      supabase
        .from('metric_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
    ]);

    const firstError = snapshotsRes.error ?? definitionsRes.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const snapshots = (snapshotsRes.data ?? []) as MetricSnapshot[];
    const definitions = (definitionsRes.data ?? []) as MetricDefinition[];

    setMetrics(buildEmployeeMetrics(definitions, snapshots));
    setLoading(false);
  }, [employeeId]);

  useEffect(() => {
    // New employeeId: drop the previous employee's metrics so an error can't
    // strand the wrong person's numbers on screen. A failed same-key refetch keeps data.
    setMetrics([]);
    load();
  }, [load]);

  return { metrics, loading, error, refetch: load };
}
