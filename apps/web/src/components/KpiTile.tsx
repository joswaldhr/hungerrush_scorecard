import { formatMetricValue } from '../lib/formatMetric';
import { timeAgo } from '../lib/timeAgo';
import { mapHistoryToWeekSlots } from '../lib/evidence';
import {
  assessTrend,
  currentWeekStartUtc,
  trendWindow,
  weekStartStr,
  METRIC_SPECS,
  type MetricDefinition,
  type MetricDirection,
} from '@scorecard/shared';

interface KpiTileProps {
  definition: MetricDefinition;
  value: number | null;
  syncedAt: string | null;
  history: Array<{ periodStart: string; value: number }>;
  /** YYYY-MM-DD Monday of the sparkline's rightmost slot (default: current UTC week). */
  weekAnchor?: string;
}

type TrendDirection = 'improving' | 'attention' | 'neutral';

// The tile badge now derives from the ONE Cadence trend engine (assessTrend:
// current vs prior-period average, ±6% steady, band metrics, <4 points =
// new). This retires the old zero-threshold last-vs-average badge so the
// public shared page can no longer contradict the manager's briefing on the
// same data. Exported for tests.
export function getTrend(
  value: number | null,
  history: Array<{ value: number }>,
  direction: MetricDirection,
  band?: readonly [number, number],
): TrendDirection {
  if (value === null) return 'neutral';
  const tone = assessTrend(history.map(h => h.value), direction, band).tone;
  return tone === 'win' ? 'improving' : tone === 'discuss' ? 'attention' : 'neutral';
}

const BADGE_STYLES: Record<TrendDirection, string> = {
  improving: 'bg-hr-green-light text-hr-green-dark border-half border-hr-green/20',
  attention: 'bg-hr-amber-light text-hr-amber border-half border-hr-amber/20',
  neutral: 'bg-hr-sand text-hr-text-3 border-half border-hr-base',
};

function getBadgeLabel(trend: TrendDirection, direction: string): string {
  if (trend === 'neutral') return '—';
  if (trend === 'improving') {
    return direction === 'higher_is_better' ? '↑' : '↓';
  }
  return direction === 'higher_is_better' ? '↓' : '↑';
}

// Null-label copy lives in METRIC_SPECS (packages/shared) as of Phase 1B — this map is
// the fallback until Phase 3 rewires components (docs/refactor-plan.md D10/S11).
const NULL_LABELS: Record<string, string> = {
  sla_compliance: 'Not configured',
  csat_score: 'No ratings yet',
  schedule_adherence: 'No schedule data',
  occupancy: 'No schedule data',
  handle_time: 'No schedule data',
};

// L5 calendar mapping — thin wrapper over the generalized mapper in
// lib/evidence.ts (this tile keeps 4 slots until it retires with the
// SharedScorecardPage reskin). Exported for tests.
export function mapHistoryToCalendarSlots(
  history: Array<{ periodStart: string; value: number }>,
  anchorWeek: string,
): Array<{ value: number } | null> {
  return mapHistoryToWeekSlots(history, anchorWeek, 4);
}

function Sparkline({
  history,
  anchorWeek,
}: {
  history: Array<{ periodStart: string; value: number }>;
  anchorWeek: string;
}) {
  const slots = mapHistoryToCalendarSlots(history, anchorWeek);
  const values = slots.filter((s): s is { value: number } => s !== null);
  const maxVal = values.length > 0 ? Math.max(...values.map(v => v.value)) : 0;

  return (
    <div className="flex flex-row items-end gap-1 h-8 w-full">
      {slots.map((slot, i) => {
        if (!slot || maxVal === 0) {
          return (
            <div
              key={i}
              className="w-2 h-full border border-dashed border-hr-sand-md rounded-sm bg-transparent"
            />
          );
        }
        const heightPct = Math.max((slot.value / maxVal) * 100, 8);
        return (
          <div
            key={i}
            className="w-2 bg-hr-green rounded-sm"
            style={{ height: `${heightPct}%`, minHeight: '4px' }}
          />
        );
      })}
    </div>
  );
}

export function KpiTileSkeleton() {
  return (
    <div className="bg-white border-half border-hr-base rounded-xl p-5 animate-pulse">
      <div className="h-2.5 bg-hr-sand-md rounded w-1/2 mb-4" />
      <div className="h-8 bg-hr-sand-md rounded w-2/3 mb-2" />
      <div className="h-2 bg-hr-sand-md rounded w-1/3" />
    </div>
  );
}

function getValueColor(value: number | null): string {
  if (value === null) return 'text-hr-text-3';
  return 'text-hr-text-1';
}

export function KpiTile({ definition, value, syncedAt, history, weekAnchor }: KpiTileProps) {
  const isNull = value === null;
  // Same anchoring rule as the briefing: count metrics measure their trend
  // through the last completed week when the tile shows the in-progress week.
  const thisMondayStr = weekStartStr(currentWeekStartUtc());
  const trendHistory = trendWindow(history, definition.unit, weekAnchor ?? thisMondayStr, thisMondayStr);
  const trend = getTrend(value, trendHistory, definition.direction, METRIC_SPECS[definition.key]?.band);
  const nullLabel =
    METRIC_SPECS[definition.key]?.nullLabel ?? NULL_LABELS[definition.key] ?? 'No data yet';
  const valueColorClass = getValueColor(value);

  return (
    <div className={`bg-white border-half border-hr-base rounded-xl ${isNull ? 'p-4 min-h-0' : 'p-5'} hover:shadow-card-hover hover:border-hr-strong transition-all duration-150 group`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-hr-text-3">
          {definition.name}
        </p>
        <span className={`text-xs px-2 py-0.5 rounded-full ${BADGE_STYLES[trend]}`}>
          {getBadgeLabel(trend, definition.direction)}
        </span>
      </div>

      {isNull ? (
        <>
          <p className="text-3xl font-semibold tracking-[-0.025em] leading-none text-hr-text-3 mb-1.5">—</p>
          <p className="text-[11px] text-hr-text-3">{nullLabel}</p>
        </>
      ) : (
        <p className={`text-3xl font-semibold tracking-[-0.025em] leading-none mb-1.5 ${valueColorClass}`}>
          {formatMetricValue(value, definition.unit)}
        </p>
      )}

      {!isNull && (
        <div className="mt-3">
          <Sparkline history={history} anchorWeek={weekAnchor ?? thisMondayStr} />
          {history.length > 0 && (
            <p className="text-[10px] text-slate-300 mt-1">4 weeks</p>
          )}
        </div>
      )}

      <p className="text-[11px] text-slate-400 leading-relaxed mt-2 pt-2 border-t border-[#F0EEE9]">
        {definition.coaching_prompt}
      </p>

      {!isNull && syncedAt && (
        <p className="text-[11px] text-hr-text-3 mt-1">
          Synced {timeAgo(syncedAt)}
        </p>
      )}
    </div>
  );
}
