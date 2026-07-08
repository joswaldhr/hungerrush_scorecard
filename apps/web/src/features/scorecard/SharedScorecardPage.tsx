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
    <div className="min-h-screen bg-hr-bg">
      <nav className="bg-hr-navy px-5 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <LogoMark />
          <div className="min-w-0">
            <span className="font-heading font-extrabold text-lg text-white leading-none block">
              Hunger<span className="text-hr-teal">Rush</span>
            </span>
            <span className="text-xs text-[#AEB3CE] leading-none">Cadence</span>
          </div>
        </div>
        <span className="text-sm text-white/60">Your weekly snapshot</span>
      </nav>
      <main className="max-w-3xl mx-auto px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

function MessageCard({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <div className="bg-hr-card rounded-xl border border-hr-line shadow-card p-8 text-center max-w-md mx-auto">
      <p className="font-heading text-[16px] font-bold text-hr-navy mb-2">{title}</p>
      <p className="text-base text-hr-gray leading-relaxed">{message}</p>
      {action}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden="true">
      <div className="bg-hr-card rounded-xl shadow-card overflow-hidden">
        <div className="h-[5px] bg-hr-teal" />
        <div className="px-5 py-4 space-y-2">
          <div className="h-6 bg-hr-line/60 rounded w-1/3" />
          <div className="h-3 bg-hr-line/60 rounded w-1/4" />
        </div>
      </div>
      <div className="bg-hr-card rounded-xl shadow-card p-5 space-y-3.5">
        <div className="h-3.5 bg-hr-line/60 rounded w-24" />
        <div className="h-12 bg-hr-line/60 rounded" />
        <div className="h-12 bg-hr-line/60 rounded" />
        <div className="h-12 bg-hr-line/60 rounded" />
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
                className="mt-4 bg-hr-teal text-white rounded-lg px-4 py-1.5 text-base font-medium hover:bg-hr-teal/90 transition-colors"
              >
                Try again
              </button>
            ) : (
              <p className="text-sm text-hr-gray-mid mt-3">
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

  // Same view-model as the manager's briefing — the public page can never
  // contradict it. Rows show both labeled windows; per-row synced stamps are
  // this page's rule.
  const anchorWeek = weekStartStr(currentWeekStartUtc());
  const groups = groupEvidenceBySource(
    buildEvidenceMetrics(buildEmployeeMetrics(definitions, snapshots), anchorWeek),
  );

  return (
    <PublicShell>
      <div className="bg-hr-card rounded-xl shadow-card overflow-hidden mb-5">
        <div className="h-[5px] bg-hr-teal" />
        <div className="px-5 py-4 flex items-center gap-4">
          <div className="h-11 w-11 bg-hr-teal-tint rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-hr-teal-deep font-semibold text-lg">
              {getInitials(employee.full_name)}
            </span>
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-[22px] font-extrabold text-hr-navy leading-tight truncate">
              {employee.full_name}
            </h1>
            <p className="text-sm text-hr-gray truncate">{employee.email}</p>
          </div>
        </div>
      </div>

      <div className="bg-hr-teal-tint border border-hr-teal/20 rounded-xl p-4 mb-5">
        <p className="text-base text-hr-navy leading-relaxed">
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
        <EvidencePanel groups={groups} loading={false} showRowSyncedAt />
      )}

      <p className="text-xs text-hr-gray-mid text-center pt-6">
        Read-only view shared by your manager
      </p>
    </PublicShell>
  );
}
