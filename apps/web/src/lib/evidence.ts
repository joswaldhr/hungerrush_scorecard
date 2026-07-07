// Evidence-panel view model (Cadence): EmployeeMetric[] → assessed, calendar-
// slotted, source-grouped rows. Pure functions — the panel components render
// this without further math.
import {
  METRIC_SPECS,
  assessTrend,
  resolveDomain,
  weeksBeforeUtc,
  weekStartStr,
  type MetricDefinition,
  type MetricSpec,
  type MetricSource,
  type TrendAssessment,
} from '@scorecard/shared';
import { maxIso, type EmployeeMetric } from './employeeMetrics';

/** Sparkline window: 8 calendar slots ending at the anchor week. */
export const SPARKLINE_WEEKS = 8;

/**
 * A source is "showing last sync" once its newest stamp is older than this.
 * The live sync runs every 4h with an 8h overnight gap (22:00 → 06:00 UTC),
 * so 9h is the smallest bound that never cries wolf overnight.
 */
export const STALE_AFTER_MS = 9 * 60 * 60 * 1000;

export interface EvidenceMetric {
  definition: MetricDefinition;
  spec: MetricSpec | undefined;
  assessment: TrendAssessment;
  /** This-week-so-far value (the row's headline window; null = not synced yet). */
  currentValue: number | null;
  /** Frozen last-week value (the row's second labeled window). */
  lastWeekValue: number | null;
  /** Calendar-mapped slots, oldest → newest; null = week without a snapshot. */
  slots: Array<{ value: number } | null>;
  /** Resolved sparkline y-scale (spec domain as minimum extent). */
  domain: [number, number];
  weeksOfHistory: number;
  latestSyncedAt: string | null;
}

export interface EvidenceGroup {
  source: MetricSource;
  label: string;
  metrics: EvidenceMetric[];
  /** Deepest history among the group's metrics — the "N wk" chip. */
  weeksOfHistory: number;
  latestSyncedAt: string | null;
  stale: boolean;
}

const SOURCE_LABELS: Record<MetricSource, string> = {
  zendesk: 'Zendesk',
  assembled: 'Assembled',
  forethought: 'Forethought',
};
const SOURCE_ORDER: MetricSource[] = ['zendesk', 'assembled', 'forethought'];

/**
 * Map history onto the `weeks` calendar weeks ending at anchorWeek (L5
 * semantics, generalized from KpiTile's 4-slot mapper): a missing week stays
 * an empty slot instead of packing the sequence.
 */
export function mapHistoryToWeekSlots(
  history: Array<{ periodStart: string; value: number }>,
  anchorWeek: string,
  weeks: number,
): Array<{ value: number } | null> {
  const anchor = new Date(`${anchorWeek}T00:00:00Z`);
  const byWeek = new Map(history.map(h => [h.periodStart, h]));
  const slots: Array<{ value: number } | null> = [];
  for (let n = weeks - 1; n >= 0; n--) {
    slots.push(byWeek.get(weekStartStr(weeksBeforeUtc(anchor, n))) ?? null);
  }
  return slots;
}

export function buildEvidenceMetrics(
  metrics: EmployeeMetric[],
  anchorWeek: string,
): EvidenceMetric[] {
  return metrics.map(m => {
    const spec = METRIC_SPECS[m.definition.key];
    const values = m.history.map(h => h.value);
    return {
      definition: m.definition,
      spec,
      assessment: assessTrend(values, m.definition.direction, spec?.band),
      currentValue: m.currentValue,
      lastWeekValue: m.lastWeekValue,
      slots: mapHistoryToWeekSlots(m.history, anchorWeek, SPARKLINE_WEEKS),
      domain: resolveDomain(spec?.domain, values),
      weeksOfHistory: m.history.length,
      latestSyncedAt: m.latestSyncedAt,
    };
  });
}

export function isStale(latestSyncedAt: string | null, now: Date): boolean {
  if (latestSyncedAt === null) return false; // nothing synced yet ≠ degraded
  return now.getTime() - new Date(latestSyncedAt).getTime() > STALE_AFTER_MS;
}

export function groupEvidenceBySource(
  evidence: EvidenceMetric[],
  now: Date = new Date(),
): EvidenceGroup[] {
  return SOURCE_ORDER.flatMap(source => {
    const metrics = evidence.filter(m => m.definition.source === source);
    if (metrics.length === 0) return [];
    const latestSyncedAt = maxIso(metrics.map(m => m.latestSyncedAt));
    return [{
      source,
      label: SOURCE_LABELS[source],
      metrics,
      weeksOfHistory: Math.max(...metrics.map(m => m.weeksOfHistory)),
      latestSyncedAt,
      stale: isStale(latestSyncedAt, now),
    }];
  });
}
