import { useNavigate } from 'react-router-dom';
import { METRIC_SPECS } from '@scorecard/shared';
import { useManagerRollup } from '../../hooks/useManagerRollup';
import { AppLayout } from '../../components/AppLayout';
import type { ManagerRollupRow, MetricTrend } from '../../hooks/useManagerRollup';

// Chip labels live in METRIC_SPECS (packages/shared) as of Phase 1B — this map is the
// fallback until Phase 3 rewires components (docs/refactor-plan.md D10/S11).
const SHORT_NAMES: Record<string, string> = {
  ticket_volume: 'Tickets',
  first_reply_time: 'First Reply',
  csat_score: 'CSAT',
  sla_compliance: 'SLA',
  resolution_rate: 'Resolution',
  schedule_adherence: 'Adherence',
  occupancy: 'Occupancy',
  handle_time: 'Handle Time',
};

function TrendChip({ metricKey, trend }: { metricKey: string; trend: MetricTrend }) {
  const isPositive = trend.improving > trend.declining;
  const isNegative = trend.declining > trend.improving;

  const chipClass = isPositive
    ? 'bg-[#E1F5EE] text-[#0F6E56] border border-[#1D9E75]/20'
    : isNegative
      ? 'bg-[#FFFBEB] text-[#D97706] border border-[#D97706]/20'
      : 'bg-[#F7F6F3] text-slate-400 border border-[#E8E6E1]';

  const goodCount = trend.improving;
  const label = METRIC_SPECS[metricKey]?.shortLabel ?? SHORT_NAMES[metricKey] ?? metricKey;

  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full ${chipClass}`}>
      {label} · {goodCount}/{trend.total}
    </span>
  );
}

function CardSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse bg-white rounded-xl border border-[#E8E6E1] p-4 flex items-start gap-4">
          <div className="h-10 w-10 bg-slate-100 rounded-full" />
          <div className="w-64 flex-shrink-0 space-y-2">
            <div className="h-4 bg-slate-100 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
          </div>
          <div className="flex-1 flex gap-2">
            <div className="h-6 bg-slate-100 rounded-full w-24" />
            <div className="h-6 bg-slate-100 rounded-full w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Access control: AuthGuard in App.tsx gates this route to senior_manager/executive/admin (S6).
export function RollupPage() {
  const { rows, definitions, weekRange, loading, error } = useManagerRollup();
  const navigate = useNavigate();

  const subtitleText = rows.length > 0
    ? `${rows.length} managers${weekRange ? ` · ${weekRange}` : ' · Trend data builds after two weekly syncs'}`
    : undefined;

  const handleManagerClick = (row: ManagerRollupRow) => {
    const params = new URLSearchParams({ manager: row.manager.id, name: row.manager.full_name });
    navigate(`/dashboard?${params.toString()}`);
  };

  return (
    <AppLayout title="Team rollup" subtitle={subtitleText}>
      {error && (
        <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#D97706] p-4 rounded-xl mb-4 text-[13px]">
          {error}
        </div>
      )}

      {loading ? (
        <CardSkeleton />
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E8E6E1] p-12 text-center">
          <p className="text-[13px] text-slate-700 mb-2">No managers found in your team.</p>
          <p className="text-[13px] text-slate-400">
            Your direct reports will appear here once the org sync has run.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => {
            const chips = definitions.filter(d => (row.trends[d.key]?.total ?? 0) > 0);
            return (
              <button
                key={row.manager.id}
                type="button"
                onClick={() => handleManagerClick(row)}
                aria-label={`View ${row.manager.full_name}'s team`}
                className="w-full text-left bg-white rounded-xl border border-[#E8E6E1] p-4 flex items-start gap-4 hover:border-[#D3D1C7] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75] focus-visible:ring-offset-2"
              >
                <div className="w-64 flex-shrink-0 min-w-0">
                  <p className="text-[13px] font-medium text-slate-800 truncate">{row.manager.full_name}</p>
                  <p className="text-[11px] text-slate-400 truncate">{row.manager.email}</p>
                  <span className="text-[11px] text-slate-400 mt-1 inline-block">
                    {`${row.employeeCount} report${row.employeeCount === 1 ? '' : 's'}`}
                  </span>
                </div>
                <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                  {chips.length > 0 ? (
                    chips.map(def => {
                      const trend = row.trends[def.key];
                      if (!trend) return null;
                      return <TrendChip key={def.key} metricKey={def.key} trend={trend} />;
                    })
                  ) : (
                    <span className="text-[11px] text-slate-400">No data yet</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </AppLayout>
  );
}
