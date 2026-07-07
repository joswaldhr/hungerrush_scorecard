import type { EvidenceGroup } from '../../../lib/evidence';
import { timeAgo } from '../../../lib/timeAgo';
import { WarnBanner } from '../../../components/WarnBanner';
import { Eyebrow } from './Eyebrow';
import { MetricRow } from './MetricRow';

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-3.5" aria-hidden="true">
      <div className="h-3.5 bg-hr-line/60 rounded w-24" />
      <div className="h-12 bg-hr-line/60 rounded" />
      <div className="h-12 bg-hr-line/60 rounded" />
      <div className="h-12 bg-hr-line/60 rounded" />
      <div className="h-3.5 bg-hr-line/60 rounded w-24 mt-6" />
      <div className="h-12 bg-hr-line/60 rounded" />
    </div>
  );
}

/**
 * Metrics as supporting evidence, grouped by source. Each group carries its
 * history-depth chip and a section-level synced stamp; a source whose newest
 * stamp for THIS person is older than the staleness bound degrades to the
 * amber "showing last sync" banner instead of pretending to be live. The
 * copy is per-person honest: a stale stamp can also mean this one person
 * stopped syncing (deactivated agent), so it never claims the source is down.
 * showRowSyncedAt stamps every row — the SharedScorecardPage per-tile rule.
 */
export function EvidencePanel({
  groups,
  loading,
  showRowSyncedAt = false,
}: {
  groups: EvidenceGroup[];
  loading: boolean;
  showRowSyncedAt?: boolean;
}) {
  return (
    <section className="bg-hr-card rounded-xl shadow-card p-5 self-start">
      {loading ? (
        <PanelSkeleton />
      ) : groups.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-[13px] text-hr-navy mb-1">No active metrics to show.</p>
          <p className="text-[13px] text-hr-gray">
            Ask your admin to enable metrics under Admin → Metrics.
          </p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.source} className="mb-6 last:mb-0">
            <div className="flex justify-between items-baseline gap-2">
              <Eyebrow className="mb-2">{group.label}</Eyebrow>
              <p className="font-mono text-[10px] text-hr-gray-light">
                {group.weeksOfHistory} wk
                {!group.stale && group.latestSyncedAt && (
                  <> · synced {timeAgo(group.latestSyncedAt)}</>
                )}
              </p>
            </div>
            {group.stale && group.latestSyncedAt && (
              <WarnBanner className="mb-2">
                No fresh {group.label} data for this person — showing last sync (
                {timeAgo(group.latestSyncedAt)}).
              </WarnBanner>
            )}
            <div className={`border-t border-hr-line ${group.stale ? 'opacity-75' : ''}`}>
              {group.metrics.map(m => (
                <MetricRow key={m.definition.key} metric={m} showSyncedAt={showRowSyncedAt} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
