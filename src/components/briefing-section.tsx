import { cn } from "@/lib/utils";

export function BriefingSection({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400">
            {title}
          </h2>
          {count !== undefined && (
            <span className="text-xs font-semibold text-slate-400 tabular-nums">({count})</span>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}
