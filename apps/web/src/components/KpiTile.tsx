import { format, parseISO } from 'date-fns';
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
  improving: 'bg-[#E1F5EE] text-[#0F6E56]',
  attention: 'bg-[#FAEEDA] text-[#854F0B]',
  neutral: 'bg-slate-100 text-slate-400',
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
              className="w-2 h-full border border-dashed border-slate-200 rounded-sm bg-transparent"
            />
          );
        }
        const heightPct = Math.max((slot.value / maxVal) * 100, 8);
        return (
          <div
            key={i}
            className="w-2 bg-[#1D9E75] rounded-sm"
            style={{ height: `${heightPct}%`, minHeight: '4px' }}
          />
        );
      })}
    </div>
  );
}

export function KpiTileSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-lg border border-slate-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="h-3 bg-slate-200 rounded w-1/3" />
        <div className="h-5 bg-slate-200 rounded-full w-8" />
      </div>
      <div className="h-7 bg-slate-200 rounded w-1/2" />
      <div className="flex items-end gap-1 h-8">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="w-2 bg-slate-200 rounded-sm h-full" />
        ))}
      </div>
    </div>
  );
}

export function KpiTile({ definition, value, syncedAt, history }: KpiTileProps) {
  const isNull = value === null || value === 0;
  const trend = getTrend(value, history, definition.direction);
  const nullLabel = NULL_LABELS[definition.key] ?? 'No data';

  return (
    <div className="group bg-white rounded-lg border border-slate-200 p-3 space-y-1 transition-colors hover:border-slate-300">
      <div className="flex items-center justify-between">
        <span className="text-xs text-slate-400">{definition.name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${BADGE_STYLES[trend]}`}>
          {getBadgeLabel(trend, definition.direction)}
        </span>
      </div>

      {isNull ? (
        <p className="text-base text-slate-400">{nullLabel}</p>
      ) : (
        <p className="text-2xl font-medium text-hr-navy">
          {formatMetricValue(value, definition.unit)}
        </p>
      )}

      <Sparkline history={history} />

      <div className="hidden group-hover:block border-t border-slate-100 pt-2">
        <p className="text-xs text-slate-400">{definition.coaching_prompt}</p>
      </div>

      {!isNull && syncedAt && (
        <p className="text-xs text-slate-400">
          Updated {format(parseISO(syncedAt), 'MMM d, h:mm a')}
        </p>
      )}
    </div>
  );
}
