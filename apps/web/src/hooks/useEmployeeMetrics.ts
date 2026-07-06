import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import type { MetricDefinition, MetricSnapshot } from '@scorecard/shared';

export interface EmployeeMetric {
  definition: MetricDefinition;
  currentValue: number | null;
  currentSyncedAt: string | null;
  lastWeekValue: number | null;
  history: Array<{ periodStart: string; value: number }>;
}

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

      const thisMondayStr = weekStartStr(thisMonday);
      const lastMondayStr = weekStartStr(weeksBeforeUtc(thisMonday, 1));

      const result: EmployeeMetric[] = definitions.map(def => {
        const metricSnapshots = snapshots.filter(s => s.metric_key === def.key);
        const current = metricSnapshots.find(s => s.period_start === thisMondayStr);
        const lastWeek = metricSnapshots.find(s => s.period_start === lastMondayStr);
        const history = metricSnapshots.map(s => ({
          periodStart: s.period_start,
          value: s.value,
        }));

        return {
          definition: def,
          currentValue: current?.value ?? null,
          currentSyncedAt: current?.synced_at ?? null,
          lastWeekValue: lastWeek?.value ?? null,
          history,
        };
      });

      setMetrics(result);
      setLoading(false);
    }

    load();
  }, [employeeId]);

  return { metrics, loading, error };
}
