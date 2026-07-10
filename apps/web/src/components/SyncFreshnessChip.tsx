import { isStale } from '../lib/evidence';
import { timeAgo } from '../lib/timeAgo';

/**
 * "synced X ago" freshness chip (QoL): quiet gray while fresh, amber once the
 * newest stamp is past the 9h staleness bound (evidence.ts) — amber marks
 * system degradation, never a performance state. Renders nothing until a
 * stamp exists (nothing synced yet ≠ degraded, the isStale rule).
 */
export function SyncFreshnessChip({
  latestSyncedAt,
  now = new Date(),
  minimal = false,
}: {
  latestSyncedAt: string | null;
  /** Injectable for tests — staleness needs a fixed clock. */
  now?: Date;
  minimal?: boolean;
}) {
  if (!latestSyncedAt) return null;
  const label = `${minimal ? 'Synced' : 'synced'} ${timeAgo(latestSyncedAt)}`;
  
  if (minimal) {
    return <>{label}</>;
  }

  if (isStale(latestSyncedAt, now)) {
    return (
      <span className="font-mono text-xs text-hr-amber-deep bg-hr-amber-tint rounded-full px-2 py-0.5 whitespace-nowrap">
        {label}
      </span>
    );
  }
  return <span className="font-mono text-xs text-hr-gray-mid whitespace-nowrap">{label}</span>;
}
