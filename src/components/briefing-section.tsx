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
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}
