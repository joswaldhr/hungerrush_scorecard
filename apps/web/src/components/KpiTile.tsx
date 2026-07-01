import { formatDistanceToNow, parseISO } from 'date-fns';
import { formatMetricValue } from '../lib/formatMetric';
import type { MetricDefinition } from '@scorecard/shared';

interface KpiTileProps {
  definition: MetricDefinition;
  value: number | null;
  syncedAt: string | null;
  history: Array<{ periodStart: string; value: number }>;
}

type TrendDirection = 'improving' | 'attention' | 'neutral';

function getTrend(
  value: number | null,
  history: Array<{ value: number }>,
  direction: string,
): TrendDirection {
  if (value === null || value === 0) return 'neutral';
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

const NULL_LABELS: Record<string, string> = {
  sla_compliance: 'Not configured',
  csat_score: 'No ratings yet',
  schedule_adherence: 'No schedule data',
  occupancy: 'No schedule data',
  handle_time: 'No schedule data',
};

function Sparkline({ history }: { history: Array<{ value: number }> }) {
  const historyLast4 = history.slice(-4);
  const slots: Array<{ value: number } | null> = Array(4).fill(null);
  historyLast4.forEach((h, i) => {
    slots[4 - historyLast4.length + i] = h;
  });
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
  if (value === null || value === 0) return 'text-hr-text-3';
  return 'text-hr-text-1';
}

export function KpiTile({ definition, value, syncedAt, history }: KpiTileProps) {
  const isNull = value === null || value === 0;
  const trend = getTrend(value, history, definition.direction);
  const nullLabel = NULL_LABELS[definition.key] ?? 'No data yet';
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
          <Sparkline history={history} />
        </div>
      )}

      <div className="hidden group-hover:block border-t border-half border-hr-base pt-3 mt-3">
        <p className="text-[11px] text-hr-text-3 leading-relaxed">{definition.coaching_prompt}</p>
      </div>

      {!isNull && syncedAt && (
        <p className="text-[11px] text-hr-text-3 mt-1">
          Synced {formatDistanceToNow(parseISO(syncedAt), { addSuffix: true })}
        </p>
      )}
    </div>
  );
}
