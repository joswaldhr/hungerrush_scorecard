import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import type { MetricDefinition, MetricSnapshot } from '@scorecard/shared';
import { buildEmployeeMetrics, type EmployeeMetric } from '../lib/employeeMetrics';
import { SPARKLINE_WEEKS } from '../lib/evidence';

export function useEmployeeMetrics(employeeId: string) {
  const { 
    data: metrics = [], 
    isLoading: loading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ['employeeMetrics', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      
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
        throw new Error(firstError.message);
      }

      const snapshots = (snapshotsRes.data ?? []) as MetricSnapshot[];
      const definitions = (definitionsRes.data ?? []) as MetricDefinition[];

      return buildEmployeeMetrics(definitions, snapshots);
    },
    enabled: !!employeeId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return { 
    metrics, 
    loading, 
    error: error ? error.message : null, 
    refetch 
  };
}
