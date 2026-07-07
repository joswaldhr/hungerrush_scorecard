import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { fetchAllPages } from '../lib/fetchAllPages';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import type { Profile, MetricDefinition } from '@scorecard/shared';
import { SPARKLINE_WEEKS } from '../lib/evidence';
import { buildRollupRows, type RollupSnapshotRow } from '../lib/rollup';
import type { ManagerRollupRow } from '../lib/rollup';

export type { ManagerRollupRow, MetricToneCounts } from '../lib/rollup';

export function useManagerRollup() {
  const [rows, setRows] = useState<ManagerRollupRow[]>([]);
  const [definitions, setDefinitions] = useState<MetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weekRange, setWeekRange] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    // UTC week identity from the shared util (L2) — must match the sync's period_start.
    const thisMonday = currentWeekStartUtc();
    const thisMondayStr = weekStartStr(thisMonday);
    const windowStartStr = weekStartStr(weeksBeforeUtc(thisMonday, SPARKLINE_WEEKS - 1));

    const [managersRes, employeesRes, definitionsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name'),
      supabase
        .from('employees')
        .select('id, manager_id'),
      supabase
        .from('metric_definitions')
        .select('*')
        .eq('is_active', true)
        .order('display_order'),
    ]);

    const defs = (definitionsRes.data ?? []) as MetricDefinition[];
    const activeKeys = defs.map(d => d.key);

    // Trend-window snapshots for every visible employee. RLS scopes visibility —
    // an org-wide employee-id filter would blow past URL length limits (same
    // rationale as useRoster's wide case). Paginated (L7).
    const snapshotsRes =
      definitionsRes.error || activeKeys.length === 0
        ? { data: [] as RollupSnapshotRow[], error: null }
        : await fetchAllPages<RollupSnapshotRow>((from, to) =>
            supabase
              .from('metric_snapshots')
              .select('employee_id, metric_key, value, period_start')
              .gte('period_start', windowStartStr)
              .in('metric_key', activeKeys)
              .order('id')
              .range(from, to),
          );

    // Surface the first failure (S5); a failed refetch keeps the last good rows.
    const firstError =
      managersRes.error ?? employeesRes.error ?? definitionsRes.error ?? snapshotsRes.error;
    if (firstError) {
      setError(firstError.message);
    } else {
      const managers = (managersRes.data ?? []) as Profile[];
      const employees = (employeesRes.data ?? []) as Array<{ id: string; manager_id: string }>;
      const snapshots = snapshotsRes.data ?? [];

      setRows(buildRollupRows(managers, employees, defs, snapshots, thisMondayStr));
      setDefinitions(defs);
      if (snapshots.length > 0) {
        // thisMonday is UTC midnight — format in UTC or US-negative offsets would
        // display the previous (Sunday) date. Pure-ms day math for the same reason.
        const sunday = new Date(thisMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
        const dateFmt = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        setWeekRange(`Week of ${dateFmt.format(thisMonday)} – ${dateFmt.format(sunday)}`);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, definitions, weekRange, loading, error, refetch: load };
}
