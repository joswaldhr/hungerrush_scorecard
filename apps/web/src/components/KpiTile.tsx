import { formatDistanceToNow, parseISO } from 'date-fns';
import { formatMetricValue } from '../lib/formatMetric';
import {
  currentWeekStartUtc,
  weeksBeforeUtc,
  weekStartStr,
  METRIC_SPECS,
  type MetricDefinition,
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

// Exported for characterization tests (Phase 1A).
export function getTrend(
  value: number | null,
  history: Array<{ value: number }>,
  direction: string,
): TrendDirection {
  if (value === null) return 'neutral';
  if (history.length < 2) return 'neutral';
  const last = history[history.length - 1];
  if (!last) return 'neutral';
  const latest = last.value;
  const priorAvg =
    history.slice(0, -1).reduce((sum, p) => sum + p.value, 0) /
    (history.length - 1);
  if (direction === 'higher_is_better') {
    return latest > priorAvg ? 'improving' : 'attention';
  }
  return latest < priorAvg ? 'improving' : 'attention';
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

// Exported for tests (Phase 1C commit 9, L5): map history onto the 4 CALENDAR weeks
// ending at anchorWeek. A missing week stays an empty (dashed) slot instead of the
// old sequence-packing, which collapsed gaps and misaligned bars across tiles.
export function mapHistoryToCalendarSlots(
  history: Array<{ periodStart: string; value: number }>,
  anchorWeek: string,
): Array<{ value: number } | null> {
  const anchor = new Date(`${anchorWeek}T00:00:00Z`);
  const byWeek = new Map(history.map(h => [h.periodStart, h]));
  return [3, 2, 1, 0].map(n => byWeek.get(weekStartStr(weeksBeforeUtc(anchor, n))) ?? null);
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
  const trend = getTrend(value, history, definition.direction);
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
          <Sparkline history={history} anchorWeek={weekAnchor ?? weekStartStr(currentWeekStartUtc())} />
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
          Synced {formatDistanceToNow(parseISO(syncedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
