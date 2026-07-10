import type { EvidenceGroup } from '../../../lib/evidence';
import { timeAgo } from '../../../lib/timeAgo';
import { WarnBanner } from '../../../components/WarnBanner';
import { Eyebrow } from './Eyebrow';
import { MetricRow } from './MetricRow';

function PanelSkeleton() {
  return (
    <div className="animate-pulse space-y-3.5" aria-hidden="true">
      <div className="h-3.5 bg-white/10 rounded w-24" />
      <div className="h-12 bg-white/10 rounded" />
      <div className="h-12 bg-white/10 rounded" />
      <div className="h-12 bg-white/10 rounded" />
      <div className="h-3.5 bg-white/10 rounded w-24 mt-6" />
      <div className="h-12 bg-white/10 rounded" />
    </div>
  );
}

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
    <section className="w-full self-start">
      {loading ? (
        <PanelSkeleton />
      ) : groups.length === 0 ? (
        <div className="py-8 text-center bg-white/5 border border-white/10 rounded-[16px]">
          <p className="text-[14px] text-[#F2F5FA] mb-1 font-semibold">No active metrics to show.</p>
          <p className="text-[13px] text-[#98A2B8]">
            Ask your admin to enable metrics under Admin → Metrics.
          </p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.source} className="mb-8 last:mb-0">
            <div className="flex justify-between items-baseline gap-2 mb-3">
              <Eyebrow>{group.label}</Eyebrow>
              <p className="font-mono text-[11px] text-[#5E6980]">
                {group.weeksOfHistory} wk
                {!group.stale && group.latestSyncedAt && (
                  <> · synced {timeAgo(group.latestSyncedAt)}</>
                )}
              </p>
            </div>
            {group.stale && group.latestSyncedAt && (
              <WarnBanner className="mb-3">
                No fresh {group.label} data for this person — showing last sync (
                {timeAgo(group.latestSyncedAt)}).
              </WarnBanner>
            )}
            <div className={`border-t border-white/10 ${group.stale ? 'opacity-75' : ''}`}>
              {group.metrics.map((m, index) => (
                <MetricRow key={m.definition.key} metric={m} showSyncedAt={showRowSyncedAt} index={index} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
