import { Clock } from "lucide-react";
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
  className,
}: {
  freshnessAt: string | null;
  now?: number;
  className?: string;
}) {
  const timestamp = now ?? 0;
  const isStale = freshnessAt
    ? timestamp - new Date(freshnessAt).getTime() > 24 * 60 * 60 * 1000
    : true;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        isStale ? "text-[oklch(var(--status-watch))]" : "text-muted-foreground",
        className
      )}
    >
      <Clock className="h-3 w-3" aria-hidden="true" />
      <span>Updated {formatRelativeTime(freshnessAt, timestamp)}</span>
    </span>
  );
}
