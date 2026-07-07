import { formatDistanceToNow, parseISO } from 'date-fns';
import type { EvidenceGroup } from '../../../lib/evidence';
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
 * stamp is older than the staleness bound degrades to the amber
 * "showing last sync" banner instead of pretending to be live.
 */
export function EvidencePanel({ groups, loading }: { groups: EvidenceGroup[]; loading: boolean }) {
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
                  <> · synced {formatDistanceToNow(parseISO(group.latestSyncedAt), { addSuffix: true })}</>
                )}
              </p>
            </div>
            {group.stale && group.latestSyncedAt && (
              <div
                role="status"
                className="bg-hr-amber-tint border border-hr-amber/30 rounded-lg px-3 py-2 mb-2 text-[12px] leading-snug text-[#8A5A0B]"
              >
                {group.label} unreachable — showing last sync (
                {formatDistanceToNow(parseISO(group.latestSyncedAt), { addSuffix: true })}).
              </div>
            )}
            <div className={`border-t border-hr-line ${group.stale ? 'opacity-75' : ''}`}>
              {group.metrics.map(m => (
                <MetricRow key={m.definition.key} metric={m} />
              ))}
            </div>
          </div>
        ))
      )}
    </section>
  );
}
