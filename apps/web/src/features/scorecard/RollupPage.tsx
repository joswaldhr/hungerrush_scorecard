import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useManagerRollup } from '../../hooks/useManagerRollup';
import type { ManagerRollupRow, MetricTrend } from '../../hooks/useManagerRollup';

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
  const isPositive =
    (trend.direction === 'higher_is_better' && trend.improving > trend.declining) ||
    (trend.direction === 'lower_is_better' && trend.declining > trend.improving);
  const isNegative =
    (trend.direction === 'higher_is_better' && trend.declining > trend.improving) ||
    (trend.direction === 'lower_is_better' && trend.improving > trend.declining);

  const chipClass = isPositive
    ? 'bg-[#E1F5EE] text-[#0F6E56]'
    : isNegative
      ? 'bg-[#FAEEDA] text-[#854F0B]'
      : 'bg-slate-100 text-slate-500';

  const goodCount = trend.direction === 'lower_is_better' ? trend.declining : trend.improving;
  const label = SHORT_NAMES[metricKey] ?? metricKey;

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${chipClass}`}>
      {label} {goodCount} of {trend.total}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="animate-pulse flex items-center gap-4 px-4 py-3 bg-white rounded-lg">
          <div className="w-[300px] flex-shrink-0 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
          <div className="flex-1 flex gap-2">
            <div className="h-6 bg-slate-200 rounded-full w-24" />
            <div className="h-6 bg-slate-200 rounded-full w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RollupPage() {
  const { session, loading: authLoading } = useAuth();
  const { rows, definitions, weekRange, loading, error } = useManagerRollup();
  const navigate = useNavigate();

  if (authLoading) return <div className="min-h-screen bg-hr-gray p-6"><TableSkeleton /></div>;
  if (!session) return <Navigate to="/login" replace />;

  const role = session.user.app_metadata?.['role'] as string | undefined;
  if (role !== 'senior_manager' && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleManagerClick = (row: ManagerRollupRow) => {
    const params = new URLSearchParams({ manager: row.manager.id, name: row.manager.full_name });
    navigate(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-4 sm:px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Team Rollup</h1>
        <span className="hidden sm:inline text-sm text-slate-300">{session.user.email}</span>
      </nav>

      <main className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-medium text-hr-navy">Your Managers</h2>
          <p className="text-xs text-slate-400 mt-1">
            {rows.length} managers
            {weekRange ? ` · ${weekRange}` : ''}
            {!weekRange && rows.length > 0 ? ' · Trend data builds after two weekly syncs' : ''}
          </p>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <TableSkeleton />
        ) : rows.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center">
            <p className="text-slate-500 mb-2">No managers found in your team.</p>
            <p className="text-sm text-slate-400">
              Your direct reports will appear here once the org sync has run.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {rows.map(row => {
              const chips = definitions.filter(d => (row.trends[d.key]?.total ?? 0) > 0);
              return (
                <div
                  key={row.manager.id}
                  onClick={() => handleManagerClick(row)}
                  className="group flex items-center bg-white rounded-lg px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <div className="w-[300px] flex-shrink-0 min-w-0">
                    <p className="font-medium text-sm text-hr-navy truncate">{row.manager.full_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400 truncate">{row.manager.email}</span>
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {`${row.employeeCount} report${row.employeeCount === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 flex flex-wrap gap-1.5 min-w-0">
                    {chips.length > 0 ? (
                      chips.map(def => {
                        const trend = row.trends[def.key];
                        if (!trend) return null;
                        return <TrendChip key={def.key} metricKey={def.key} trend={trend} />;
                      })
                    ) : (
                      <span className="text-xs text-slate-300">No data yet</span>
                    )}
                  </div>
                  <div className="ml-2 opacity-0 group-hover:opacity-100 text-slate-300 text-xs transition-opacity flex-shrink-0">
                    &#8250;
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
