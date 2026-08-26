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
    className: "bg-[oklch(var(--status-on-track-bg))] text-[oklch(var(--status-on-track))]",
  },
  on_track: {
    label: "On track",
    className: "bg-[oklch(var(--status-on-track-bg))] text-[oklch(var(--status-on-track))]",
  },
  warning: {
    label: "Watch",
    className: "bg-[oklch(var(--status-watch-bg))] text-[oklch(var(--status-watch))]",
  },
  mixed: {
    label: "Mixed",
    className: "bg-[oklch(var(--status-watch-bg))] text-[oklch(var(--status-watch))]",
  },
  off_target: {
    label: "Needs attention",
    className: "bg-[oklch(var(--status-attention-bg))] text-[oklch(var(--status-attention))]",
  },
  needs_attention: {
    label: "Needs attention",
    className: "bg-[oklch(var(--status-attention-bg))] text-[oklch(var(--status-attention))]",
  },
  no_target: {
    label: "No target",
    className: "bg-[oklch(var(--status-neutral-bg))] text-[oklch(var(--status-neutral))]",
  },
  no_data: {
    label: "No data yet",
    className: "bg-[oklch(var(--status-neutral-bg))] text-[oklch(var(--status-neutral))]",
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
