import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { format, parseISO } from 'date-fns';
import { formatMetricValue } from '../lib/formatMetric';
import type { MetricDefinition } from '@scorecard/shared';

interface KpiTileProps {
  definition: MetricDefinition;
  value: number | null;
  syncedAt: string | null;
  history: Array<{ periodStart: string; value: number }>;
}

function getTrendColor(
  history: Array<{ value: number }>,
  direction: string,
): string {
  if (history.length < 2) return '#94a3b8'; // slate-400
  const last = history[history.length - 1];
  if (!last) return '#94a3b8';
  const latest = last.value;
  const priorAvg =
    history.slice(0, -1).reduce((sum, p) => sum + p.value, 0) /
    (history.length - 1);
  const improving =
    direction === 'higher_is_better' ? latest > priorAvg : latest < priorAvg;
  return improving ? '#1D9E75' : '#f59e0b'; // hr-green : amber-500
}

export function KpiTileSkeleton() {
  return (
    <div className="animate-pulse bg-white rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded w-1/3" />
        <div className="h-4 w-4 bg-slate-200 rounded" />
      </div>
      <div className="h-8 bg-slate-200 rounded w-1/2" />
      <div className="h-8 bg-slate-200 rounded w-full" />
      <div className="h-12 bg-slate-200 rounded w-full" />
      <div className="h-3 bg-slate-200 rounded w-1/4" />
    </div>
  );
}

const NULL_LABELS: Record<string, string> = {
  sla_compliance: 'Not configured',
  csat_score: 'No ratings yet',
  schedule_adherence: 'No schedule data',
  occupancy: 'No schedule data',
  handle_time: 'No schedule data',
};

export function KpiTile({ definition, value, syncedAt, history }: KpiTileProps) {
  const directionArrow = definition.direction === 'higher_is_better' ? '↑' : '↓';
  const isConfigured = value !== null;
  const nullLabel = NULL_LABELS[definition.key] ?? 'Not configured';
  const trendColor = getTrendColor(history, definition.direction);

  return (
    <div className="bg-white rounded-lg p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-hr-navy">{definition.name}</h3>
        <span className="text-slate-400 text-sm" title={`${definition.direction.replace('_', ' ')}`}>
          {directionArrow}
        </span>
      </div>

      {isConfigured ? (
        <p className="text-2xl font-bold text-hr-navy">
          {formatMetricValue(value, definition.unit)}
        </p>
      ) : (
        <p className="text-lg text-slate-400">{nullLabel}</p>
      )}

      {isConfigured && history.length > 0 && (
        <div className="h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history}>
              <Line
                type="monotone"
                dataKey="value"
                stroke={trendColor}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs text-slate-500 leading-relaxed">{definition.coaching_prompt}</p>

      {syncedAt && (
        <p className="text-xs text-slate-400">
          Updated {format(parseISO(syncedAt), 'MMM d, h:mm a')}
        </p>
      )}
    </div>
  );
}
