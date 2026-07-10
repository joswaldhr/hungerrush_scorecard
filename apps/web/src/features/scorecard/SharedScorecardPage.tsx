// PUBLIC ROUTE — no authentication required.
// Do not add AppLayout or sidebar to this page.

import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { currentWeekStartUtc, weekStartStr } from '@scorecard/shared';
import { useSharedScorecard } from '../../hooks/useSharedScorecard';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { LogoMark } from '../../components/AppLayout';
import { getInitials } from '../../lib/initials';
import { buildEmployeeMetrics } from '../../lib/employeeMetrics';
import { buildEvidenceMetrics, groupEvidenceBySource } from '../../lib/evidence';
import { EvidencePanel } from './components/EvidencePanel';

function PublicShell({ children }: { children: ReactNode }) {
  useDocumentTitle('Your weekly snapshot');
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#070B14] text-[#F2F5FA]">
      <div className="fixed inset-0 -z-10 bg-[#070B14]">
        <div className="absolute inset-0" style={{ background: 'radial-gradient(1200px 500px at 75% -10%, rgba(53,80,140,0.22), transparent 60%), radial-gradient(900px 420px at 10% -5%, rgba(14,132,118,0.20), transparent 55%)' }} />
        <div className="absolute -inset-[20%] blur-[90px] opacity-55">
          <div className="absolute left-[12%] top-[18%] w-[560px] h-[560px] rounded-full hr-mesh-a" style={{ background: 'radial-gradient(circle at 40% 40%, rgba(14,132,118,0.85), transparent 65%)' }} />
          <div className="absolute right-[8%] top-[6%] w-[520px] h-[520px] rounded-full hr-mesh-b" style={{ background: 'radial-gradient(circle at 60% 40%, rgba(53,80,140,0.8), transparent 65%)' }} />
          <div className="absolute left-[38%] -bottom-[10%] w-[640px] h-[640px] rounded-full hr-mesh-c" style={{ background: 'radial-gradient(circle at 50% 50%, rgba(43,217,188,0.35), transparent 60%)' }} />
        </div>
        <div className="absolute inset-0 hr-grain" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 75%)' }} />
      </div>

      <nav className="sticky top-0 z-40 h-16 flex items-center justify-between px-7 bg-[#090D17]/70 backdrop-blur-[20px] border-b border-white/10">
        <div className="flex items-center gap-[11px]">
          <div className="w-[26px] h-[26px] rounded-md bg-gradient-to-br from-[#0E8476]/30 to-[#0E8476]/5 border border-[#2BD9BC]/35 flex items-center justify-center shadow-[0_0_20px_rgba(43,217,188,0.15)]">
            <LogoMark size={16} />
          </div>
          <div className="font-heading font-bold text-[15px] tracking-tight">Scorecard</div>
        </div>
        <span className="text-[13px] text-[#98A2B8] font-medium">Your weekly snapshot</span>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:px-6 relative z-10 hr-fade-up">{children}</main>
    </div>
  );
}

function MessageCard({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 backdrop-blur-[20px] rounded-[20px] p-8 text-center max-w-md mx-auto" style={{ boxShadow: '0 24px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)' }}>
      <p className="font-heading text-[18px] font-extrabold text-[#F2F5FA] mb-2">{title}</p>
      <p className="text-[14px] text-[#98A2B8] leading-[1.55]">{message}</p>
      {action}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden="true">
      <div className="bg-white/5 border border-white/10 rounded-[20px] overflow-hidden">
        <div className="px-5 py-4 space-y-2">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-3 bg-white/10 rounded w-1/4" />
        </div>
      </div>
      <div className="bg-white/5 border border-white/10 rounded-[20px] p-5 space-y-3.5">
        <div className="h-3.5 bg-white/10 rounded w-24" />
        <div className="h-12 bg-white/10 rounded" />
        <div className="h-12 bg-white/10 rounded" />
        <div className="h-12 bg-white/10 rounded" />
      </div>
    </div>
  );
}

export function SharedScorecardPage() {
  const { token } = useParams<{ token: string }>();

  if (!token) {
    return (
      <PublicShell>
        <MessageCard
          title="Invalid share link"
          message="This link is missing its token. Ask your manager to share a fresh link."
        />
      </PublicShell>
    );
  }

  return <SharedScorecardContent token={token} />;
}

const ERROR_TITLES = {
  expired: 'Link expired',
  not_found: 'Link not found',
  network: 'Connection error',
} as const;

function SharedScorecardContent({ token }: { token: string }) {
  const { data, loading, error, errorType, refetch } = useSharedScorecard(token);

  if (loading) {
    return (
      <PublicShell>
        <PageSkeleton />
      </PublicShell>
    );
  }

  if (error) {
    return (
      <PublicShell>
        <MessageCard
          title={ERROR_TITLES[errorType ?? 'network']}
          message={error}
          action={
            errorType === 'network' ? (
              <button
                onClick={refetch}
                className="mt-6 bg-gradient-to-br from-[#14A88F] to-[#0E8476] text-[#F7FFFC] rounded-[10px] px-5 py-2 text-[14px] font-semibold hover:-translate-y-px transition-all shadow-[0_8px_22px_rgba(14,132,118,0.4)]"
              >
                Try again
              </button>
            ) : (
              <p className="text-[12px] text-[#5E6980] mt-4 pt-4 border-t border-white/5">
                Share links stay valid for 72 hours — ask your manager for a fresh one.
              </p>
            )
          }
        />
      </PublicShell>
    );
  }

  if (!data) return null;

  const { employee, definitions, snapshots } = data;

  const anchorWeek = weekStartStr(currentWeekStartUtc());
  const groups = groupEvidenceBySource(
    buildEvidenceMetrics(buildEmployeeMetrics(definitions, snapshots), anchorWeek),
  );

  return (
    <PublicShell>
      <div className="flex items-center gap-5 flex-wrap mb-7 mt-2">
        <div className="w-[56px] h-[56px] rounded-[18px] bg-gradient-to-br from-[#35508C] to-[#0E8476] flex items-center justify-center font-heading text-[18px] font-extrabold text-white border border-white/20 shadow-[0_12px_30px_rgba(0,0,0,0.4)]">
          {getInitials(employee.full_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[26px] font-extrabold text-white tracking-tight leading-none mb-1.5">
            {employee.full_name}
          </h1>
          <p className="text-[13.5px] text-[#98A2B8]">{employee.email}</p>
        </div>
      </div>

      <div className="bg-[#14A88F]/10 border border-[#2BD9BC]/20 rounded-[16px] p-5 mb-8 backdrop-blur-[10px]" style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.15)' }}>
        <p className="text-[14px] text-[#DCE2EE] leading-relaxed">
          Your manager shared this snapshot of your recent metrics as a conversation starter for
          your 1:1. These numbers show momentum and growth opportunities — not a performance
          review.
        </p>
      </div>

      {definitions.length === 0 ? (
        <MessageCard
          title="No metrics yet"
          message="Nothing is being measured yet. Data refreshes every 4 hours — check back soon."
        />
      ) : (
        <div className="bg-[#0D121E]/95 backdrop-blur-[30px] border border-white/10 rounded-[20px] p-6 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          <EvidencePanel groups={groups} loading={false} showRowSyncedAt />
        </div>
      )}

      <p className="text-[12px] text-[#5E6980] text-center pt-8 font-medium">
        Read-only view shared by your manager
      </p>
    </PublicShell>
  );
}
