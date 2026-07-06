import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import type { MetricDefinition, MetricSnapshot } from '@scorecard/shared';
import { buildEmployeeMetrics, type EmployeeMetric } from '../lib/employeeMetrics';

export function useEmployeeMetrics(employeeId: string) {
  const [metrics, setMetrics] = useState<EmployeeMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // UTC week identity from the shared util (L2) — must match the sync's period_start.
      const thisMonday = currentWeekStartUtc();
      const fourWeeksAgoStr = weekStartStr(weeksBeforeUtc(thisMonday, 3));

      const [snapshotsRes, definitionsRes] = await Promise.all([
        supabase
          .from('metric_snapshots')
          .select('*')
          .eq('employee_id', employeeId)
          .gte('period_start', fourWeeksAgoStr)
          .order('period_start'),
        supabase
          .from('metric_definitions')
          .select('*')
          .eq('is_active', true)
          .order('display_order'),
      ]);

      if (snapshotsRes.error) {
        setError(snapshotsRes.error.message);
        setLoading(false);
        return;
      }
      if (definitionsRes.error) {
        setError(definitionsRes.error.message);
        setLoading(false);
        return;
      }

      const snapshots = (snapshotsRes.data ?? []) as MetricSnapshot[];
      const definitions = (definitionsRes.data ?? []) as MetricDefinition[];

      setMetrics(buildEmployeeMetrics(definitions, snapshots));
      setLoading(false);
    }

    load();
  }, [employeeId]);

  return { metrics, loading, error };
}
