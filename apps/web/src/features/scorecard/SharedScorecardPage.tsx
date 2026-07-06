// PUBLIC ROUTE — no authentication required.
// Do not add AppLayout or sidebar to this page.

import { useParams } from 'react-router-dom';
import { currentWeekStartUtc, weeksBeforeUtc, weekStartStr } from '@scorecard/shared';
import { useSharedScorecard } from '../../hooks/useSharedScorecard';
import { KpiTile, KpiTileSkeleton } from '../../components/KpiTile';
import { LogoMark } from '../../components/AppLayout';

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-[#F7F6F3]">
      <nav className="bg-[#1E2E4A] text-white px-6 py-4 flex items-center gap-3">
        <LogoMark size={24} />
        <span className="text-[13px] font-medium text-white/80 tracking-tight">Your Weekly Snapshot</span>
      </nav>
      <main className="max-w-5xl mx-auto px-5 py-8 sm:px-10 space-y-10">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-slate-100 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {Array.from({ length: 6 }, (_, i) => (
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
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="bg-white border border-[#E8E6E1] rounded-xl p-8 text-center max-w-md">
          <p className="text-[13px] text-slate-700">Invalid share link.</p>
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
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="bg-white border border-[#E8E6E1] rounded-xl p-8 text-center max-w-md">
          {errorType === 'expired' && (
            <>
              <p className="text-[17px] font-medium text-slate-800 mb-2">Link Expired</p>
              <p className="text-[13px] text-slate-500">{error}</p>
            </>
          )}
          {errorType === 'not_found' && (
            <>
              <p className="text-[17px] font-medium text-slate-800 mb-2">Link Not Found</p>
              <p className="text-[13px] text-slate-500">{error}</p>
            </>
          )}
          {errorType === 'network' && (
            <>
              <p className="text-[17px] font-medium text-slate-800 mb-2">Connection Error</p>
              <p className="text-[13px] text-slate-500">{error}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { employee, definitions, snapshots } = data;

  // UTC week identity from the shared util (L2) — must match the sync's period_start.
  const thisMonday = currentWeekStartUtc();
  const thisMondayStr = weekStartStr(thisMonday);
  const lastMondayStr = weekStartStr(weeksBeforeUtc(thisMonday, 1));

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
    <div className="min-h-screen bg-[#F7F6F3]">
      <nav className="bg-[#1E2E4A] text-white px-6 py-4 flex items-center gap-3">
        <LogoMark size={24} />
        <span className="text-[13px] font-medium text-white/80 tracking-tight">Your Weekly Snapshot</span>
      </nav>

      <main className="max-w-5xl mx-auto px-5 py-8 sm:px-10 space-y-10">
        <div className="flex items-center gap-4">
          <div className="h-11 w-11 bg-[#E1F5EE] rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-[#0F6E56] font-semibold text-lg">
              {employee.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <h2 className="text-[17px] font-medium text-slate-800">{employee.full_name}</h2>
            <p className="text-[12px] text-slate-400">{employee.email}</p>
          </div>
        </div>

        <div className="bg-[#F0FDF4] border border-[#86EFAC] rounded-xl p-4 mb-5">
          <p className="text-[13px] text-[#166534] leading-relaxed">
            Your manager shared this snapshot of your recent metrics as a conversation starter for your 1:1. These numbers show momentum and growth opportunities — not a performance review.
          </p>
        </div>

        <section>
          <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-4">This Week So Far</p>
          {currentWeekMetrics.length === 0 && metrics.every(m => m.currentValue === null) ? (
            <div className="bg-white rounded-xl border border-[#E8E6E1] p-6 text-center">
              <p className="text-[13px] text-slate-700 mb-1">No metrics synced for this week yet.</p>
              <p className="text-[13px] text-slate-400">
                Data refreshes every 4 hours — check back soon.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
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
            <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-4">Last Week (Completed)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {metrics
                .filter(m => m.lastWeekValue !== null)
                .map(m => (
                  <KpiTile
                    key={m.definition.id}
                    definition={m.definition}
                    value={m.lastWeekValue}
                    syncedAt={null}
                    history={m.history.filter(h => h.periodStart <= lastMondayStr)}
                  />
                ))}
            </div>
          </section>
        )}

        <p className="text-[11px] text-slate-400 text-center pt-4">
          Read-only view shared by your manager
        </p>
      </main>
    </div>
  );
}
