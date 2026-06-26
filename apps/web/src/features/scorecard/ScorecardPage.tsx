import { useState } from 'react';
import { useParams, Navigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEmployee } from '../../hooks/useEmployee';
import { useEmployeeMetrics } from '../../hooks/useEmployeeMetrics';
import { useScorecardNotes } from '../../hooks/useScorecardNotes';
import { KpiTile, KpiTileSkeleton } from '../../components/KpiTile';
import { NotesPanel } from '../notes/NotesPanel';
import { supabase } from '../../lib/supabase';

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

export function ScorecardPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const { session, loading: authLoading } = useAuth();
  const { employee, loading: empLoading, error: empError } = useEmployee(employeeId ?? '');
  const { metrics, loading: metricsLoading, error: metricsError } = useEmployeeMetrics(employeeId ?? '');
  const {
    sessions,
    loading: notesLoading,
    error: notesError,
    createSession,
    toggleActionItem,
  } = useScorecardNotes(employeeId ?? '');
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');

  if (!employeeId) return <Navigate to="/dashboard" replace />;

  if (authLoading || empLoading) return <PageSkeleton />;

  if (!session) return <Navigate to="/login" replace />;

  if (empError) {
    return (
      <div className="min-h-screen bg-hr-gray flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg text-center max-w-md">
          <p className="text-slate-500 mb-2">Unable to load employee data.</p>
          <p className="text-sm text-slate-400">{empError}</p>
          <Link to="/dashboard" className="text-hr-green text-sm mt-4 inline-block hover:underline">
            Back to your team
          </Link>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-hr-gray flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg text-center max-w-md">
          <p className="text-slate-500 mb-2">Employee not found.</p>
          <p className="text-sm text-slate-400">
            They may not be on your team, or the link may be incorrect.
          </p>
          <Link to="/dashboard" className="text-hr-green text-sm mt-4 inline-block hover:underline">
            Back to your team
          </Link>
        </div>
      </div>
    );
  }

  const managerId = session.user.id;

  const handleShare = async () => {
    if (!employeeId) return;
    setShareStatus('sharing');

    const { data, error: insertError } = await supabase
      .from('share_tokens')
      .insert({ employee_id: employeeId, created_by: managerId })
      .select('token')
      .single();

    if (insertError || !data) {
      setShareStatus('error');
      setTimeout(() => setShareStatus('idle'), 3000);
      return;
    }

    const url = `${window.location.origin}/shared/${data.token as string}`;
    await navigator.clipboard.writeText(url);
    setShareStatus('copied');
    setTimeout(() => setShareStatus('idle'), 3000);
  };

  const currentWeekMetrics = metrics.filter(m => m.currentValue !== null);
  const lastWeekMetrics = metrics.filter(m => m.lastWeekValue !== null);

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-slate-300 hover:text-white transition-colors">
            ← Your Team
          </Link>
          <h1 className="text-lg font-bold">Employee Scorecard</h1>
        </div>
        <span className="text-sm text-slate-300">{session.user.email}</span>
      </nav>

      <main className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-hr-navy">{employee.full_name}</h2>
            <p className="text-sm text-slate-500">{employee.email}</p>
          </div>
          <button
            onClick={handleShare}
            disabled={shareStatus === 'sharing'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              shareStatus === 'copied'
                ? 'bg-hr-green-light text-hr-green'
                : shareStatus === 'error'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-hr-green text-white hover:bg-hr-green-dark'
            }`}
            aria-label="Share scorecard with employee"
          >
            {shareStatus === 'idle' && 'Share'}
            {shareStatus === 'sharing' && 'Creating link...'}
            {shareStatus === 'copied' && 'Link copied!'}
            {shareStatus === 'error' && 'Failed — try again'}
          </button>
        </div>

        <section>
          <h3 className="text-lg font-bold text-hr-navy mb-4">This Week So Far</h3>
          {metricsError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-4 text-sm">
              {metricsError}
            </div>
          )}
          {metricsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }, (_, i) => (
                <KpiTileSkeleton key={i} />
              ))}
            </div>
          ) : currentWeekMetrics.length === 0 && metrics.every(m => m.currentValue === null) ? (
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

        <section>
          <h3 className="text-lg font-bold text-hr-navy mb-4">Last Week (Completed)</h3>
          {lastWeekMetrics.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center">
              <p className="text-slate-500 mb-1">No completed snapshot for last week.</p>
              <p className="text-sm text-slate-400">
                Last week's snapshot will appear after the Sunday sync.
              </p>
            </div>
          ) : (
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
          )}
        </section>

        <section>
          {notesError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-4 text-sm">
              {notesError}
            </div>
          )}
          <NotesPanel
            sessions={sessions}
            loading={notesLoading}
            managerId={managerId}
            onSave={createSession}
            onToggleActionItem={toggleActionItem}
          />
        </section>
      </main>
    </div>
  );
}
