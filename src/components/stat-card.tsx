import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  iconClassName,
  value,
  label,
  detail,
  detailClassName,
  change,
  children,
  className,
}: {
  icon?: LucideIcon;
  iconClassName?: string;
  value: string | number;
  label: string;
  detail?: string;
  detailClassName?: string;
  change?: number | null;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-shadow hover:shadow-sm",
        className
      )}
    >
      {Icon && (
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full shadow-2xs",
            iconClassName ?? "bg-slate-100 text-slate-600"
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground leading-none">
            {value}
          </p>
          {change != null && change !== 0 && (
            <span
              className={cn(
                "text-xs font-semibold px-1.5 py-0.5 rounded",
                change > 0
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
              )}
            >
              {change > 0 ? "+" : ""}
              {change}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm font-semibold text-foreground/90 truncate">{label}</p>
        {detail && (
          <p
            className={cn(
              "mt-0.5 text-xs font-medium text-muted-foreground truncate",
              detailClassName
            )}
          >
            {detail}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}
