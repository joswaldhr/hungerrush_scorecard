import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useManagerRollup } from '../../hooks/useManagerRollup';
import type { MetricTrend } from '../../hooks/useManagerRollup';
import type { MetricDefinition } from '@scorecard/shared';

function TrendCell({ trend }: { trend: MetricTrend }) {
  if (trend.total === 0) {
    return <span className="text-slate-400 text-sm">No data</span>;
  }

  const neutral = trend.total - trend.improving - trend.declining;
  const majorityImproving = trend.improving > trend.declining;
  const majorityDeclining = trend.declining > trend.improving;

  let colorClass = 'text-slate-400';
  if (majorityImproving) colorClass = 'text-hr-green';
  if (majorityDeclining) colorClass = 'text-amber-500';

  return (
    <span className={`text-sm font-medium ${colorClass}`}>
      {trend.improving} of {trend.total}
      {neutral > 0 && (
        <span className="text-slate-400 font-normal"> ({neutral} steady)</span>
      )}
    </span>
  );
}

function TableSkeleton() {
  return (
    <div className="bg-white rounded-lg overflow-hidden">
      <div className="animate-pulse p-4 space-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-200 rounded w-12" />
            <div className="h-4 bg-slate-200 rounded w-16" />
            <div className="h-4 bg-slate-200 rounded w-16" />
            <div className="h-4 bg-slate-200 rounded w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RollupTable({
  rows,
  definitions,
  onManagerClick,
}: {
  rows: ReturnType<typeof useManagerRollup>['rows'];
  definitions: MetricDefinition[];
  onManagerClick: (managerId: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-slate-200">
            <th className="px-4 py-3 text-sm font-semibold text-hr-navy">Manager</th>
            <th className="px-4 py-3 text-sm font-semibold text-hr-navy text-center">Team</th>
            {definitions.map(def => (
              <th key={def.key} className="px-4 py-3 text-sm font-semibold text-hr-navy text-center">
                {def.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={row.manager.id}
              onClick={() => onManagerClick(row.manager.id)}
              className="border-b border-slate-100 hover:bg-hr-green-light/50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3">
                <p className="font-medium text-hr-navy">{row.manager.full_name}</p>
                <p className="text-xs text-slate-500">{row.manager.email}</p>
              </td>
              <td className="px-4 py-3 text-center text-sm text-slate-600">
                {row.employeeCount}
              </td>
              {definitions.map(def => (
                <td key={def.key} className="px-4 py-3 text-center">
                  <TrendCell trend={row.trends[def.key] ?? { improving: 0, declining: 0, total: 0 }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function RollupPage() {
  const { session, loading: authLoading } = useAuth();
  const { rows, definitions, loading, error } = useManagerRollup();
  const navigate = useNavigate();

  if (authLoading) return <TableSkeleton />;
  if (!session) return <Navigate to="/login" replace />;

  const role = session.user.app_metadata?.['role'] as string | undefined;
  if (role !== 'senior_manager' && role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  const handleManagerClick = (managerId: string) => {
    navigate(`/dashboard?manager=${managerId}`);
  };

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold">Team Rollup</h1>
        <span className="text-sm text-slate-300">{session.user.email}</span>
      </nav>

      <main className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-hr-navy">Your Managers</h2>
          <p className="text-sm text-slate-500 mt-1">
            Trend shows how many team members are improving compared to last week
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
          <RollupTable
            rows={rows}
            definitions={definitions}
            onManagerClick={handleManagerClick}
          />
        )}
      </main>
    </div>
  );
}
