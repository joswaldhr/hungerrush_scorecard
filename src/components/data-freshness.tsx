import { Clock, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRelativeTime(dateStr: string | null, now: number): string {
  if (!dateStr) return "Unknown";
  const diff = now - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DataFreshness({
  freshnessAt,
  now,
  syncError,
  className,
}: {
  freshnessAt: string | null;
  now: number;
  syncError?: string | null;
  className?: string;
}) {
  const timestamp = now;
  const isStale = freshnessAt
    ? timestamp - new Date(freshnessAt).getTime() > 24 * 60 * 60 * 1000
    : true;

  if (syncError) {
    return (
      <span
        className={cn("inline-flex items-center gap-1 text-xs text-status-attention", className)}
      >
        <AlertTriangle className="h-3 w-3" aria-hidden="true" />
        <span>Sync error</span>
        {freshnessAt && (
          <span className="text-muted-foreground">
            · Last success {formatRelativeTime(freshnessAt, timestamp)}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        isStale ? "text-status-watch" : "text-muted-foreground",
        className
      )}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      <span>Updated {formatRelativeTime(freshnessAt, timestamp)}</span>
    </span>
  );
}
