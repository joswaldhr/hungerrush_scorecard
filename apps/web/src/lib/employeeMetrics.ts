import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import type { MetricDefinition, MetricSnapshot } from '@scorecard/shared';

export interface EmployeeMetric {
  definition: MetricDefinition;
  currentValue: number | null;
  currentSyncedAt: string | null;
  lastWeekValue: number | null;
  history: Array<{ periodStart: string; value: number }>;
}

// The share API returns this subset of MetricSnapshot; direct Supabase reads return full rows.
type SnapshotLike = Pick<MetricSnapshot, 'metric_key' | 'value' | 'period_start' | 'synced_at'>;

// The one snapshot→view-model mapping (D5), used by useEmployeeMetrics and
// SharedScorecardPage. Sorts history ascending itself — trend math reads
// history[length - 1] as "latest", so caller query order must not leak in
// (the share API returns snapshots newest-first).
export function buildEmployeeMetrics(
  definitions: MetricDefinition[],
  snapshots: SnapshotLike[],
): EmployeeMetric[] {
  // UTC week identity from the shared util (L2) — must match the sync's period_start.
  const thisMonday = currentWeekStartUtc();
  const thisMondayStr = weekStartStr(thisMonday);
  const lastMondayStr = weekStartStr(weeksBeforeUtc(thisMonday, 1));

  const ordered = [...snapshots].sort((a, b) => a.period_start.localeCompare(b.period_start));

  return definitions.map(def => {
    const metricSnapshots = ordered.filter(s => s.metric_key === def.key);
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
}
