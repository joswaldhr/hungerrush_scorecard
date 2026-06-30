import { useState } from 'react';
import { useParams, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEmployee } from '../../hooks/useEmployee';
import { useEmployeeMetrics } from '../../hooks/useEmployeeMetrics';
import { useScorecardNotes } from '../../hooks/useScorecardNotes';
import { KpiTile, KpiTileSkeleton } from '../../components/KpiTile';
import { NotesPanel } from '../notes/NotesPanel';
import { supabase } from '../../lib/supabase';
import { generateScorecardPdf } from '../../lib/pdfExport';

function PageSkeleton() {
  return (
    <div className="min-h-screen bg-hr-gray">
      <div className="bg-hr-navy text-white px-6 py-4">
        <div className="animate-pulse h-5 bg-slate-600 rounded w-48" />
      </div>
      <main className="max-w-5xl mx-auto p-6 sm:p-8 space-y-10">
        <div className="animate-pulse space-y-2">
          <div className="h-6 bg-slate-200 rounded w-1/3" />
          <div className="h-4 bg-slate-200 rounded w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <KpiTileSkeleton key={i} />
          ))}
        </div>
      </main>
    </div>
  );
}

export function ScorecardPage() {
  const { employeeId } = useParams<{ employeeId: string }>();
  const location = useLocation();
  const locationNavigate = useNavigate();
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
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');

  const employeeIds = (location.state as { employeeIds?: string[] } | null)?.employeeIds ?? null;
  const currentIndex = employeeIds && employeeId ? employeeIds.indexOf(employeeId) : -1;
  const prevId = employeeIds && currentIndex > 0 ? employeeIds[currentIndex - 1] : null;
  const nextId = employeeIds && currentIndex >= 0 && currentIndex < employeeIds.length - 1 ? employeeIds[currentIndex + 1] : null;
  const positionLabel = employeeIds && currentIndex >= 0 ? `${currentIndex + 1} of ${employeeIds.length}` : null;

  const goTo = (id: string) => {
    locationNavigate(`/scorecard/${id}`, { state: { employeeIds } });
  };

  if (!employeeId) return <Navigate to="/dashboard" replace />;

  if (authLoading || empLoading) return <PageSkeleton />;

  if (!session) return <Navigate to="/login" replace />;

  if (empError) {
    return (
      <div className="min-h-screen bg-hr-gray flex items-center justify-center">
        <div className="bg-white p-4 sm:p-8 rounded-lg text-center max-w-md">
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
        <div className="bg-white p-4 sm:p-8 rounded-lg text-center max-w-md">
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

  const handleExportPdf = async () => {
    if (!employee || !employeeId) return;
    setExportStatus('exporting');

    try {
      generateScorecardPdf(
        employee.full_name,
        employee.email,
        metrics.map(m => ({ definition: m.definition, value: m.currentValue })),
        session.user.email ?? '',
      );

      const apiUrl = import.meta.env.VITE_API_URL as string;
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (apiUrl && accessToken) {
        await fetch(`${apiUrl}/api/audit/export`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ employee_id: employeeId }),
        });
      }

      setExportStatus('done');
      setTimeout(() => setExportStatus('idle'), 3000);
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  const currentWeekMetrics = metrics.filter(m => m.currentValue !== null && m.currentValue !== 0);
  const lastWeekMetrics = metrics.filter(m => m.lastWeekValue !== null && m.lastWeekValue !== 0);
  const allCurrentNull = metrics.every(m => m.currentValue === null || m.currentValue === 0);

  const sortedMetrics = [...metrics].sort((a, b) => {
    const aNull = a.currentValue === null || a.currentValue === 0;
    const bNull = b.currentValue === null || b.currentValue === 0;
    if (aNull !== bNull) return aNull ? 1 : -1;
    return a.definition.display_order - b.definition.display_order;
  });

  return (
    <div className="min-h-screen bg-hr-gray">
      <nav className="bg-hr-navy text-white px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="text-sm text-slate-300 hover:text-white transition-colors">
            ← Your Team
          </Link>
          <h1 className="text-lg font-bold">Employee Scorecard</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => prevId && goTo(prevId)}
              disabled={!prevId}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                prevId
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              aria-label="Previous employee"
            >
              ←
            </button>
            {positionLabel && (
              <span className="text-xs text-slate-400">{positionLabel}</span>
            )}
            <button
              onClick={() => nextId && goTo(nextId)}
              disabled={!nextId}
              className={`px-2 py-1 text-sm rounded transition-colors ${
                nextId
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-600 cursor-not-allowed'
              }`}
              aria-label="Next employee"
            >
              →
            </button>
          </div>
          <span className="hidden sm:inline text-sm text-slate-300">{session.user.email}</span>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-6 sm:p-8 space-y-10">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{employee.full_name}</h2>
            <p className="text-sm text-slate-500">{employee.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPdf}
              disabled={exportStatus === 'exporting'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                exportStatus === 'done'
                  ? 'bg-hr-green-light text-hr-green'
                  : exportStatus === 'error'
                    ? 'bg-red-50 text-red-600'
                    : 'text-slate-400 border border-slate-200 hover:text-slate-600 hover:border-slate-300'
              }`}
              aria-label="Export scorecard as PDF"
            >
              {exportStatus === 'idle' && 'Export PDF'}
              {exportStatus === 'exporting' && 'Exporting...'}
              {exportStatus === 'done' && 'Downloaded!'}
              {exportStatus === 'error' && 'Failed — try again'}
            </button>
            <button
              onClick={handleShare}
              disabled={shareStatus === 'sharing'}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                shareStatus === 'copied'
                  ? 'bg-hr-green-light text-hr-green'
                  : shareStatus === 'error'
                    ? 'bg-red-50 text-red-600'
                    : 'text-hr-green border border-hr-green hover:bg-hr-green-light'
              }`}
              aria-label="Share scorecard with employee"
            >
              {shareStatus === 'idle' && 'Share'}
              {shareStatus === 'sharing' && 'Creating link...'}
              {shareStatus === 'copied' && 'Link copied!'}
              {shareStatus === 'error' && 'Failed — try again'}
            </button>
          </div>
        </div>

        <section>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-4">This Week So Far</p>
          {metricsError && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg mb-4 text-sm">
              {metricsError}
            </div>
          )}
          {metricsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 6 }, (_, i) => (
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
            <>
              {allCurrentNull && (
                <p className="text-xs text-slate-400 mb-3">This week's data refreshes every 4 hours.</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sortedMetrics.map(m => (
                  <KpiTile
                    key={m.definition.id}
                    definition={m.definition}
                    value={m.currentValue}
                    syncedAt={m.currentSyncedAt}
                    history={m.history}
                  />
                ))}
              </div>
            </>
          )}
        </section>

        <section>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-4">Last Week (Completed)</p>
          {lastWeekMetrics.length === 0 ? (
            <div className="bg-white p-6 rounded-lg text-center">
              <p className="text-slate-500 mb-1">No completed snapshot for last week.</p>
              <p className="text-sm text-slate-400">
                Last week's snapshot will appear after the Sunday sync.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {lastWeekMetrics
                .sort((a, b) => a.definition.display_order - b.definition.display_order)
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

        <div className="bg-white rounded-xl border border-slate-200 p-6 mt-8">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-4">1:1 Notes</p>
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
        </div>
      </main>
    </div>
  );
}
