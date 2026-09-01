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

const statusConfig: Record<Status, { label: string; className: string; dotClass: string }> = {
  on_target: {
    label: "On Track",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
    dotClass: "bg-emerald-500",
  },
  on_track: {
    label: "On Track",
    className:
      "bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60",
    dotClass: "bg-emerald-500",
  },
  warning: {
    label: "Watch",
    className:
      "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
    dotClass: "bg-amber-500",
  },
  mixed: {
    label: "Watch",
    className:
      "bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60",
    dotClass: "bg-amber-500",
  },
  off_target: {
    label: "Needs Attention",
    className:
      "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60",
    dotClass: "bg-rose-500",
  },
  needs_attention: {
    label: "Needs Attention",
    className:
      "bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800/60",
    dotClass: "bg-rose-500",
  },
  no_target: {
    label: "No Target",
    className:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
  no_data: {
    label: "No Data",
    className:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700",
    dotClass: "bg-slate-400",
  },
};

export function StatusBadge({
  status,
  showDot = false,
  className,
}: {
  status: Status;
  showDot?: boolean;
  className?: string;
}) {
  const config = statusConfig[status] ?? statusConfig.no_data;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-tight whitespace-nowrap",
        config.className,
        className
      )}
    >
      {showDot && <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotClass)} />}
      {config.label}
    </span>
  );
}
