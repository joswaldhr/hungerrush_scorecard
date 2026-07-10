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
import { SyncFreshnessChip } from '../../../components/SyncFreshnessChip';
import { getInitials } from '../../../lib/initials';
import { KPICard } from './KPICard';
import { EvidencePanel } from './EvidencePanel';

const AV = [
  'linear-gradient(135deg, #0E8476, #2BD9BC)',
  'linear-gradient(135deg, #35508C, #7DA2F5)',
  'linear-gradient(135deg, #6C5CE7, #A29BFE)',
  'linear-gradient(135deg, #B8763A, #E9B454)',
  'linear-gradient(135deg, #0E8476, #35508C)',
  'linear-gradient(135deg, #2BB3D9, #7DE8F5)',
  'linear-gradient(135deg, #8C5A35, #E8845F)',
  'linear-gradient(135deg, #2E9E5B, #7FDCA4)',
];

function getGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return AV[Math.abs(hash) % AV.length];
}

function HeaderSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-5 mt-3.5">
      <div className="w-16 h-16 rounded-[20px] bg-white/10" />
      <div className="space-y-2">
        <div className="h-6 bg-white/10 rounded w-48" />
        <div className="h-4 bg-white/10 rounded w-32" />
      </div>
    </div>
  );
}

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
  const [drawer, setDrawer] = useState<'none' | 'evidence' | 'notes'>('none');

  const anchorWeek = weekStartStr(currentWeekStartUtc());
  const evidence = useMemo(() => buildEvidenceMetrics(metrics, anchorWeek), [metrics, anchorWeek]);
  const groups = useMemo(() => groupEvidenceBySource(evidence), [evidence]);

  const withHistory = evidence.filter(m => m.weeksOfHistory > 0);
  const noData = !metricsLoading && withHistory.length === 0;

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

  if (!session) return null;
  const managerId = session.user.id;

  if (empLoading) return <HeaderSkeleton />;

  if (empError || !employee) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="bg-white/5 border border-white/10 rounded-[18px] p-8 text-center max-w-md">
          <p className="text-base text-white mb-2">
            {empError ? 'Unable to load this person.' : 'This person could not be found.'}
          </p>
          <p className="text-base text-[#98A2B8]">
            {empError ?? 'They may not be on your team, or the link may be incorrect. Pick someone from the roster above.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-fade-up">
      {/* Header */}
      <div className="mt-3.5 flex items-center gap-5 flex-wrap">
        <div 
          className="w-16 h-16 rounded-[20px] flex items-center justify-center font-heading text-[20px] font-extrabold text-white"
          style={{ background: getGradient(employee.id), boxShadow: '0 12px 30px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25)' }}
        >
          {getInitials(employee.full_name)}
        </div>
        <div className="flex-1 min-w-[240px]">
          <div className="flex items-center gap-3.5 flex-wrap">
            <h2 className="font-heading font-extrabold text-[28px] tracking-tight">{employee.full_name}</h2>
            <div className="flex items-center gap-2 h-7 px-3 rounded-full bg-[#2BD9BC]/10 border border-[#2BD9BC]/35 text-[#2BD9BC] text-[12px] font-semibold" style={{ boxShadow: '0 0 18px rgba(43,217,188,0.18)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#2BD9BC] hr-pulse" />
              Synced
            </div>
          </div>
          <div className="mt-1.5 text-[14px] text-[#98A2B8]">
            {employee.title || 'Team Member'} 
            {lastSessionDate ? ` · last 1:1 ${timeAgo(lastSessionDate)}` : ''}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={() => setDrawer('evidence')}
            className="h-10 px-[18px] rounded-[10px] border border-white/10 bg-white/5 text-[#F2F5FA] font-medium text-[13.5px] flex items-center gap-2 hover:border-[#7DA2F5]/50 hover:bg-[#7DA2F5]/10 transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#7DA2F5]"
          >
            <span className="material-symbols-rounded text-[18px]">table_rows</span>
            Evidence
          </button>
          <button 
            onClick={() => setDrawer('notes')}
            className="h-10 px-[18px] rounded-[10px] bg-gradient-to-br from-[#14A88F] to-[#0E8476] text-[#F7FFFC] font-medium text-[13.5px] flex items-center gap-2 hover:translate-y-[-1px] transition-all outline-none focus-visible:ring-2 focus-visible:ring-[#2BD9BC]"
            style={{ boxShadow: '0 10px 26px rgba(14,132,118,0.4)' }}
          >
            <span className="material-symbols-rounded text-[18px]">edit_note</span>
            1:1 Notes
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {metricsError && <WarnBanner className="mt-6 mb-2">{metricsError}</WarnBanner>}
      {metricsLoading ? (
        <div className="mt-7 grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-40 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : noData ? (
        <div className="mt-7 bg-white/5 border border-white/10 rounded-[18px] p-8 text-center">
          <p className="text-base text-white mb-1">No metrics available.</p>
          <p className="text-[#98A2B8]">Wait for the sync to complete to see history.</p>
        </div>
      ) : (
        <div className="mt-7 grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
          {evidence.map(m => <KPICard key={m.definition.key} metric={m} />)}
        </div>
      )}

      {/* Talking Points */}
      {!metricsLoading && !noData && points.length > 0 && (
        <div 
          className="mt-7 rounded-[18px] p-[26px] border border-[#2BD9BC]/20"
          style={{
            background: 'linear-gradient(150deg, rgba(14,132,118,0.14), rgba(53,80,140,0.1) 55%, rgba(255,255,255,0.03))',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 18px 44px rgba(0,0,0,0.3)'
          }}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-[38px] h-[38px] rounded-xl bg-[#2BD9BC]/10 border border-[#2BD9BC]/35 flex items-center justify-center">
                <span className="material-symbols-rounded text-[20px] text-[#2BD9BC]">forum</span>
              </div>
              <div>
                <div className="font-heading font-bold text-[17px] tracking-tight text-white">Talking points for this week</div>
                <div className="text-[12.5px] text-[#98A2B8]">Auto-generated from the last 8 weeks · supportive by design</div>
              </div>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-3.5">
            {points.map((p, i) => {
              const isWin = p.kind === 'celebrate';
              const title = p.kind === 'discuss' ? 'Focus area' : p.kind === 'celebrate' ? 'Win' : 'Note';
              const color = isWin ? '#2BD9BC' : '#E9B454';
              
              return (
                <div 
                  key={i} 
                  className="rounded-[14px] p-[18px] bg-[#070B14]/45 border border-white/10 hover:-translate-y-0.5 hover:border-[#2BD9BC]/50 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold tracking-[0.8px] uppercase" style={{ color }}>
                      {title}
                    </span>
                  </div>
                  <div className="mt-2.5 text-[14px] font-semibold leading-tight text-white">{p.text}</div>
                  {p.ask && <div className="mt-[7px] text-[13px] leading-relaxed text-[#98A2B8] italic">{p.ask}</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawers Scrim */}
      <div 
        onClick={() => setDrawer('none')}
        className={`fixed inset-0 z-50 bg-[#04070D]/50 backdrop-blur-sm transition-opacity duration-300 ${
          drawer !== 'none' ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`} 
      />

      {/* Evidence Drawer */}
      <div 
        className="fixed top-0 right-0 bottom-0 z-50 w-[800px] max-w-[92vw] bg-[#0D121E]/95 backdrop-blur-[30px] border-l border-white/10 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{ transform: drawer === 'evidence' ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-30px 0 80px rgba(0,0,0,0.5)' }}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-heading font-bold text-[17px] text-white">Evidence · {employee?.full_name}</div>
            <div className="mt-1 text-[12px] text-[#6B7690]">Historical performance data</div>
          </div>
          <button 
            onClick={() => setDrawer('none')}
            className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-[#98A2B8] flex items-center justify-center hover:text-white hover:border-white/20 transition-all outline-none"
          >
            <span className="material-symbols-rounded text-[18px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <EvidencePanel groups={groups} loading={metricsLoading} />
        </div>
      </div>

      {/* Notes Drawer */}
      <div 
        className="fixed top-0 right-0 bottom-0 z-50 w-[500px] max-w-[92vw] bg-[#0D121E]/95 backdrop-blur-[30px] border-l border-white/10 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)]"
        style={{ transform: drawer === 'notes' ? 'translateX(0)' : 'translateX(100%)', boxShadow: '-30px 0 80px rgba(0,0,0,0.5)' }}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-heading font-bold text-[17px] text-white">1:1 Notes · {employee?.full_name}</div>
            <div className="mt-1 text-[12px] text-[#6B7690]">Private to you</div>
          </div>
          <button 
            onClick={() => setDrawer('none')}
            className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 text-[#98A2B8] flex items-center justify-center hover:text-white hover:border-white/20 transition-all outline-none"
          >
            <span className="material-symbols-rounded text-[18px]">close</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          {notesError && <WarnBanner className="mb-4">{notesError}</WarnBanner>}
          <NotesPanel
            sessions={sessions}
            loading={notesLoading}
            managerId={managerId}
            onSave={createSession}
            onToggleActionItem={toggleActionItem}
          />
        </div>
      </div>
    </div>
  );
}
