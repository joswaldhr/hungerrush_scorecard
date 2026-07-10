import { useMemo, useState } from 'react';
import { currentWeekStartUtc, weekStartStr } from '@scorecard/shared';
import { useAuth } from '../../auth/AuthProvider';
import { useEmployee } from '../../../hooks/useEmployee';
import { useEmployeeMetrics } from '../../../hooks/useEmployeeMetrics';
import { useScorecardNotes } from '../../../hooks/useScorecardNotes';
import { buildEvidenceMetrics, groupEvidenceBySource } from '../../../lib/evidence';
import { buildTalkingPoints } from '../../../lib/coaching';
import { supabase } from '../../../lib/supabase';
import { generateScorecardPdf } from '../../../lib/pdfExport';
import { NotesPanel } from '../../notes/NotesPanel';
import { WarnBanner } from '../../../components/WarnBanner';
import { timeAgo } from '../../../lib/timeAgo';
import { Eyebrow } from './Eyebrow';
import { TalkingPoints } from './TalkingPoints';
import { EvidencePanel } from './EvidencePanel';
import { ActionItemsList } from './ActionItemsList';

const ghostBtn =
  'border border-hr-line rounded-lg px-3 py-1.5 text-base text-hr-gray hover:bg-hr-bg transition-colors';
const primaryBtn =
  'bg-hr-teal text-white rounded-lg px-3 py-1.5 text-base font-medium hover:bg-hr-teal/90 transition-colors';
const successBtn =
  'bg-hr-teal-tint text-hr-teal-deep rounded-lg px-3 py-1.5 text-base font-medium transition-colors';
const errorBtn =
  'bg-hr-amber-tint text-hr-amber-deep rounded-lg px-3 py-1.5 text-base font-medium transition-colors';

function HeaderSkeleton() {
  return (
    <div className="bg-hr-card rounded-xl shadow-card overflow-hidden mb-5 animate-pulse" aria-hidden="true">
      <div className="h-[5px] bg-hr-teal" />
      <div className="px-5 py-4 space-y-2">
        <div className="h-3 bg-hr-line/60 rounded w-32" />
        <div className="h-7 bg-hr-line/60 rounded w-56" />
        <div className="h-3 bg-hr-line/60 rounded w-40" />
      </div>
    </div>
  );
}

/**
 * The Cadence inversion: the 1:1 briefing (talking points → actions → notes)
 * is the primary pane; metrics sit beside it as supporting evidence.
 */
export function Briefing({ employeeId }: { employeeId: string }) {
  const { session } = useAuth();
  const { employee, loading: empLoading, error: empError } = useEmployee(employeeId);
  const { metrics, loading: metricsLoading, error: metricsError } = useEmployeeMetrics(employeeId);
  const {
    sessions,
    loading: notesLoading,
    error: notesError,
    createSession,
    toggleActionItem,
  } = useScorecardNotes(employeeId);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied' | 'error'>('idle');
  const [shareFallbackUrl, setShareFallbackUrl] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'done' | 'error'>('idle');

  const anchorWeek = weekStartStr(currentWeekStartUtc());
  const evidence = useMemo(() => buildEvidenceMetrics(metrics, anchorWeek), [metrics, anchorWeek]);
  const groups = useMemo(() => groupEvidenceBySource(evidence), [evidence]);

  const withHistory = evidence.filter(m => m.weeksOfHistory > 0);
  const noData = !metricsLoading && withHistory.length === 0;
  const allNew = withHistory.length > 0 && withHistory.every(m => m.assessment.tone === 'new');
  const wins = withHistory.filter(m => m.assessment.tone === 'win').length;
  const discuss = withHistory.filter(m => m.assessment.tone === 'discuss').length;

  const points = useMemo(
    () =>
      buildTalkingPoints(
        evidence.map(m => ({
          key: m.definition.key,
          label: m.definition.name,
          unit: m.definition.unit,
          timing: m.assessedTiming,
          assessment: m.assessment,
        })),
      ),
    [evidence],
  );

  const lastSessionDate = sessions[0]?.session_date ?? null;

  // AuthGuard owns access (S6) — this narrows types for the handlers below.
  if (!session) return null;
  const managerId = session.user.id;

  const handleShare = async () => {
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
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
      setShareFallbackUrl(null);
      setTimeout(() => setShareStatus('idle'), 3000);
    } catch {
      setShareFallbackUrl(url);
      setShareStatus('idle');
    }
  };

  const handleExportPdf = async () => {
    if (!employee) return;
    setExportStatus('exporting');
    try {
      await generateScorecardPdf(
        employee.full_name,
        employee.email,
        evidence.map(m => ({
          definition: m.definition,
          currentValue: m.currentValue,
          lastWeekValue: m.lastWeekValue,
          tone: m.weeksOfHistory > 0 ? m.assessment.tone : null,
          history: m.slots.map(s => (s ? s.value : null)),
          domain: m.domain,
        })),
        session.user.email ?? '',
      );
      setExportStatus('done');
      setTimeout(() => setExportStatus('idle'), 3000);

      try {
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
      } catch (auditErr) {
        console.error('Audit log failed:', auditErr);
      }
    } catch {
      setExportStatus('error');
      setTimeout(() => setExportStatus('idle'), 3000);
    }
  };

  if (empLoading) return <HeaderSkeleton />;

  if (empError || !employee) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="bg-hr-card border border-hr-line rounded-xl p-8 text-center max-w-md">
          <p className="text-base text-hr-navy mb-2">
            {empError ? 'Unable to load this person.' : 'This person could not be found.'}
          </p>
          <p className="text-base text-hr-gray">
            {empError ?? 'They may not be on your team, or the link may be incorrect. Pick someone from the roster above.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="bg-hr-card rounded-xl shadow-card overflow-hidden mb-5">
        <div className="h-[5px] bg-hr-teal" />
        <div className="px-5 py-4 flex justify-between items-end flex-wrap gap-3">
          <div className="min-w-0">
            <Eyebrow className="mb-1.5">
              1:1 briefing
              {lastSessionDate ? ` · last session ${timeAgo(lastSessionDate)}` : ''}
            </Eyebrow>
            <h2 className="font-heading text-[clamp(24px,4vw,32px)] font-extrabold text-hr-navy leading-tight truncate">
              {employee.full_name}
            </h2>
            <p className="text-base text-hr-gray mt-1 truncate">
              {employee.title ? `${employee.title} · ` : ''}
              {employee.email}
            </p>
            {!employee.is_active && (
              <p className="text-xs text-hr-gray-mid mt-1">
                No longer synced — absent from the last org sync; metrics are frozen at their
                last values.
              </p>
            )}
          </div>
          <div className="flex items-end gap-5 flex-wrap">
            {!metricsLoading && !noData && (
              <div className="flex gap-5">
                <div className="text-center">
                  <p className="font-heading font-extrabold text-[24px] leading-none text-hr-teal">{wins}</p>
                  <p className="text-xs text-hr-gray mt-0.5">wins</p>
                </div>
                <div className="text-center">
                  <p className={`font-heading font-extrabold text-[24px] leading-none ${discuss > 0 ? 'text-hr-coral' : 'text-hr-gray-mid'}`}>
                    {discuss}
                  </p>
                  <p className="text-xs text-hr-gray mt-0.5">to discuss</p>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleExportPdf}
                disabled={exportStatus === 'exporting'}
                className={
                  exportStatus === 'done' ? successBtn : exportStatus === 'error' ? errorBtn : ghostBtn
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
                  shareStatus === 'copied' ? successBtn : shareStatus === 'error' ? errorBtn : primaryBtn
                }
              >
                {shareStatus === 'idle' && 'Share'}
                {shareStatus === 'sharing' && 'Creating…'}
                {shareStatus === 'copied' && 'Copied!'}
                {shareStatus === 'error' && 'Failed'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {shareFallbackUrl && (
        <div className="bg-hr-card border border-hr-line rounded-xl p-4 mb-4 flex items-center gap-3">
          <input
            type="text"
            readOnly
            value={shareFallbackUrl}
            onFocus={e => e.target.select()}
            className="flex-1 text-sm text-hr-gray bg-hr-bg border border-hr-line rounded-lg px-3 py-1.5 outline-none"
          />
          <button
            onClick={() => setShareFallbackUrl(null)}
            className="text-sm text-hr-gray-mid hover:text-hr-gray transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Briefing pane — primary */}
        <section className="bg-hr-card rounded-xl shadow-card p-5">
          <Eyebrow className="mb-2.5">Talking points</Eyebrow>
          <TalkingPoints points={points} allNew={allNew} noData={noData} loading={metricsLoading} />

          <div className="mt-6">
            <Eyebrow className="mb-2">Action items</Eyebrow>
            {notesLoading ? (
              <div className="animate-pulse space-y-2" aria-hidden="true">
                <div className="h-4 bg-hr-line/60 rounded w-3/4" />
                <div className="h-4 bg-hr-line/60 rounded w-2/3" />
              </div>
            ) : (
              <ActionItemsList sessions={sessions} onToggle={toggleActionItem} />
            )}
          </div>

          <div className="mt-6">
            <Eyebrow className="mb-2">Notes</Eyebrow>
            {notesError && <WarnBanner className="mb-3">{notesError}</WarnBanner>}
            <NotesPanel
              sessions={sessions}
              loading={notesLoading}
              managerId={managerId}
              onSave={createSession}
              onToggleActionItem={toggleActionItem}
            />
          </div>
        </section>

        {/* Evidence panel — supporting */}
        <div>
          {metricsError && <WarnBanner className="mb-4">{metricsError}</WarnBanner>}
          <EvidencePanel groups={groups} loading={metricsLoading} />
        </div>
      </div>
    </div>
  );
}
