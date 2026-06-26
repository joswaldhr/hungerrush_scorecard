import { useParams } from 'react-router-dom';
import { startOfWeek, subWeeks, format } from 'date-fns';
import { useSharedScorecard } from '../../hooks/useSharedScorecard';
import { KpiTile, KpiTileSkeleton } from '../../components/KpiTile';

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-hr-gray">
      <div className="bg-hr-navy text-white px-6 py-4">
        <div className="animate-pulse h-5 bg-slate-600 rounded w-48" />
      </div>
      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <KpiTileSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function SharedScorecardPage() {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <div className="min-h-screen bg-hr-gray flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg text-center max-w-md">
          <p className="text-slate-500">Invalid share link.</p>
        </div>
      </div>
    );
  }

  return <SharedScorecardContent token={token} />;
}

function SharedScorecardContent({ token }: { token: string }) {
  const { data, loading, error, errorType } = useSharedScorecard(token);

  if (loading) return <PageSkeleton />;

  if (error) {
    return (
      <div className="min-h-screen bg-hr-gray flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg text-center max-w-md">
          {errorType === 'expired' && (
            <>
              <p className="text-lg font-medium text-hr-navy mb-2">Link Expired</p>
              <p className="text-slate-500">{error}</p>
            </>
          )}
          {errorType === 'not_found' && (
            <>
              <p className="text-lg font-medium text-hr-navy mb-2">Link Not Found</p>
              <p className="text-slate-500">{error}</p>
            </>
          )}
          {errorType === 'network' && (
            <>
              <p className="text-lg font-medium text-hr-navy mb-2">Connection Error</p>
              <p className="text-slate-500">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { employee, definitions, snapshots } = data;

  const now = new Date();
  const thisMonday = startOfWeek(now, { weekStartsOn: 1 });
  const lastMonday = subWeeks(thisMonday, 1);
  const thisMondayStr = format(thisMonday, 'yyyy-MM-dd');
  const lastMondayStr = format(lastMonday, 'yyyy-MM-dd');

  const metrics = definitions.map(def => {
    const metricSnapshots = snapshots.filter(s => s.metric_key === def.key);
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

  const currentWeekMetrics = metrics.filter(m => m.currentValue !== null);

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-6 py-4">
        <h1 className="text-lg font-bold">HungerRush Scorecard</h1>
      </nav>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <div>
          <h2 className="text-xl font-bold text-hr-navy">{employee.full_name}</h2>
          <p className="text-sm text-slate-500">{employee.email}</p>
        </div>

        <section>
          <h3 className="text-lg font-bold text-hr-navy mb-4">This Week So Far</h3>
          {currentWeekMetrics.length === 0 && metrics.every(m => m.currentValue === null) ? (
            <div className="bg-white p-6 rounded-lg text-center">
              <p className="text-slate-500 mb-1">No metrics synced for this week yet.</p>
              <p className="text-sm text-slate-400">
                Data refreshes every 4 hours — check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics.map(m => (
                <KpiTile
                  key={m.definition.id}
                  definition={m.definition}
                  value={m.currentValue}
                  syncedAt={m.currentSyncedAt}
                  history={m.history}
                />
              ))}
            </div>
          )}
        </section>

        {metrics.some(m => m.lastWeekValue !== null) && (
          <section>
            <h3 className="text-lg font-bold text-hr-navy mb-4">Last Week (Completed)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metrics
                .filter(m => m.lastWeekValue !== null)
                .map(m => (
                  <KpiTile
                    key={m.definition.id}
                    definition={m.definition}
                    value={m.lastWeekValue}
                    syncedAt={null}
                    history={m.history}
                  />
                ))}
            </div>
          </section>
        )}

        <p className="text-xs text-slate-400 text-center pt-4">
          This is a read-only view shared by your manager.
        </p>
      </main>
    </div>
  );
}
