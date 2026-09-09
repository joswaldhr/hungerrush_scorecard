import { AlertTriangle } from "lucide-react";

const STALE_THRESHOLD_HOURS = 30;

function hoursSince(date: Date): number {
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

export function SyncStalenessBanner({
  lastSuccessfulSyncAt,
}: {
  lastSuccessfulSyncAt: Date | null;
}) {
  const hours = lastSuccessfulSyncAt ? hoursSince(lastSuccessfulSyncAt) : Infinity;
  if (hours <= STALE_THRESHOLD_HOURS) return null;

  const label = lastSuccessfulSyncAt
    ? hours < 48
      ? `${Math.floor(hours)} hours ago`
      : `${Math.floor(hours / 24)} days ago`
    : "never";

  return (
    <div className="flex items-center gap-2 border-b border-status-attention/30 bg-status-attention-bg px-8 py-2 text-sm text-status-attention">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Zendesk data hasn&apos;t synced in over {STALE_THRESHOLD_HOURS} hours (last successful sync:{" "}
        {label}). Metrics below may be out of date.
      </span>
    </div>
  );
}
