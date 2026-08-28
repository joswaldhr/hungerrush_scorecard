import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  iconClassName,
  value,
  label,
  detail,
  className,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  value: string | number;
  label: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 rounded-lg border bg-card p-5", className)}>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          iconClassName
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <p className="text-stat-value font-bold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-sm text-foreground">{label}</p>
        {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
      </div>
    </div>
  );
}
