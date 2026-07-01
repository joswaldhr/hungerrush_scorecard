import { useState } from 'react';
import { useParams, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEmployee } from '../../hooks/useEmployee';
import { useEmployeeMetrics } from '../../hooks/useEmployeeMetrics';
import { useScorecardNotes } from '../../hooks/useScorecardNotes';
import { KpiTile, KpiTileSkeleton } from '../../components/KpiTile';
import { NotesPanel } from '../notes/NotesPanel';
import { AppLayout } from '../../components/AppLayout';
import { supabase } from '../../lib/supabase';
import { generateScorecardPdf } from '../../lib/pdfExport';

function PageSkeleton() {
  return (
    <AppLayout title="Your team">
      <div className="animate-pulse space-y-10">
        <div className="space-y-2">
          <div className="h-6 bg-slate-100 rounded w-1/3" />
          <div className="h-4 bg-slate-100 rounded w-1/4" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
          {Array.from({ length: 6 }, (_, i) => (
            <KpiTileSkeleton key={i} />
          ))}
        </div>
      </div>
    </AppLayout>
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
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="bg-white border border-[#E8E6E1] rounded-xl p-8 text-center max-w-md">
          <p className="text-[13px] text-slate-700 mb-2">Unable to load employee data.</p>
          <p className="text-[13px] text-slate-400">{empError}</p>
          <Link to="/dashboard" className="text-[#1D9E75] text-[13px] mt-4 inline-block hover:underline">
            Back to your team
          </Link>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-[#F7F6F3] flex items-center justify-center">
        <div className="bg-white border border-[#E8E6E1] rounded-xl p-8 text-center max-w-md">
          <p className="text-[13px] text-slate-700 mb-2">Employee not found.</p>
          <p className="text-[13px] text-slate-400">
            They may not be on your team, or the link may be incorrect.
          </p>
          <Link to="/dashboard" className="text-[#1D9E75] text-[13px] mt-4 inline-block hover:underline">
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

  const ghostBtn = 'border border-[#E8E6E1] rounded-lg px-3 py-1.5 text-[13px] text-slate-600 hover:bg-[#F7F6F3] transition-colors';
  const primaryBtn = 'bg-[#1D9E75] text-white rounded-lg px-3 py-1.5 text-[13px] font-medium hover:bg-[#0F6E56] transition-colors';
  const successBtn = 'bg-[#E1F5EE] text-[#0F6E56] rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors';
  const errorBtn = 'bg-[#FFFBEB] text-[#D97706] rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors';

  const headerActions = (
    <>
      {employeeIds && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => prevId && goTo(prevId)}
            disabled={!prevId}
            className="text-[12px] px-2 py-1 border border-[#E8E6E1] rounded-md text-slate-500 hover:bg-[#F7F6F3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            ← Prev
          </button>
          {positionLabel && (
            <span className="text-[12px] text-slate-400 tabular-nums">{positionLabel}</span>
          )}
          <button
            onClick={() => nextId && goTo(nextId)}
            disabled={!nextId}
            className="text-[12px] px-2 py-1 border border-[#E8E6E1] rounded-md text-slate-500 hover:bg-[#F7F6F3] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next →
          </button>
        </div>
      )}
      <button
        onClick={handleExportPdf}
        disabled={exportStatus === 'exporting'}
        className={
          exportStatus === 'done' ? successBtn
            : exportStatus === 'error' ? errorBtn
              : ghostBtn
        }
      >
        {exportStatus === 'idle' && 'Export PDF'}
        {exportStatus === 'exporting' && 'Exporting…'}
        {exportStatus === 'done' && 'Downloaded!'}
        {exportStatus === 'error' && 'Failed'}
      </button>
      <button
        onClick={handleShare}
        disabled={shareStatus === 'sharing'}
        className={
          shareStatus === 'copied' ? successBtn
            : shareStatus === 'error' ? errorBtn
              : primaryBtn
        }
      >
        {shareStatus === 'idle' && 'Share'}
        {shareStatus === 'sharing' && 'Creating…'}
        {shareStatus === 'copied' && 'Copied!'}
        {shareStatus === 'error' && 'Failed'}
      </button>
    </>
  );

  return (
    <AppLayout
      title={`Your team → ${employee.full_name}`}
      actions={headerActions}
    >
      <div className="flex items-center gap-3 mb-6">
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

      <section>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-4">This Week So Far</p>
        {metricsError && (
          <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#D97706] p-4 rounded-xl mb-4 text-[13px]">
            {metricsError}
          </div>
        )}
        {metricsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
            {Array.from({ length: 6 }, (_, i) => (
              <KpiTileSkeleton key={i} />
            ))}
          </div>
        ) : currentWeekMetrics.length === 0 && metrics.every(m => m.currentValue === null) ? (
          <div className="bg-white rounded-xl border border-[#E8E6E1] p-6 text-center">
            <p className="text-[13px] text-slate-700 mb-1">No metrics synced for this week yet.</p>
            <p className="text-[13px] text-slate-400">
              Data refreshes every 4 hours — check back soon.
            </p>
          </div>
        ) : (
          <>
            {allCurrentNull && (
              <p className="text-[11px] text-slate-400 mb-3">This week's data refreshes every 4 hours.</p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
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

      <div className="border-t border-[#F0EEE9] my-8" />

      <section>
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-4">Last Week (Completed)</p>
        {lastWeekMetrics.length === 0 ? (
          <div className="bg-white rounded-xl border border-[#E8E6E1] p-6 text-center">
            <p className="text-[13px] text-slate-700 mb-1">No completed snapshot for last week.</p>
            <p className="text-[13px] text-slate-400">
              Last week's snapshot will appear after the Sunday sync.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
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

      <div className="bg-white rounded-xl border border-[#E8E6E1] p-5 mt-4">
        <p className="text-[10px] font-semibold tracking-widest uppercase text-slate-400 mb-4">1:1 Notes</p>
        {notesError && (
          <div className="bg-[#FFFBEB] border border-[#D97706]/20 text-[#D97706] p-4 rounded-xl mb-4 text-[13px]">
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
    </AppLayout>
  );
}
