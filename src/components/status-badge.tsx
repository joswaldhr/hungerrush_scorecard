import { cn } from "@/lib/utils";

type Status =
  | "on_target"
  | "warning"
  | "off_target"
  | "no_target"
  | "no_data"
  | "on_track"
  | "mixed"
  | "needs_attention";

const statusConfig: Record<Status, { label: string; className: string }> = {
  on_target: {
    label: "On target",
    className: "bg-status-on-track-bg text-status-on-track",
  },
  on_track: {
    label: "On track",
    className: "bg-status-on-track-bg text-status-on-track",
  },
  warning: {
    label: "Watch",
    className: "bg-status-watch-bg text-status-watch",
  },
  mixed: {
    label: "Mixed",
    className: "bg-status-watch-bg text-status-watch",
  },
  off_target: {
    label: "Needs attention",
    className: "bg-status-attention-bg text-status-attention",
  },
  needs_attention: {
    label: "Needs attention",
    className: "bg-status-attention-bg text-status-attention",
  },
  no_target: {
    label: "No target",
    className: "bg-status-neutral-bg text-status-neutral",
  },
  no_data: {
    label: "No data yet",
    className: "bg-status-neutral-bg text-status-neutral",
  },
};

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
