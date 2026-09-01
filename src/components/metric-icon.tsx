import type { LucideIcon } from "lucide-react";
import { Ticket, Star, Smile, Clock, Inbox, CalendarCheck, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

// One icon + color per metric category (metric_definitions.category), reusing the
// design system's existing chart-1..5 palette rather than inventing new hues.
const CATEGORY_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  productivity: { icon: Ticket, className: "bg-chart-1/15 text-chart-1" },
  quality: { icon: Star, className: "bg-chart-2/15 text-chart-2" },
  efficiency: { icon: Clock, className: "bg-chart-3/15 text-chart-3" },
  workload: { icon: Inbox, className: "bg-chart-4/15 text-chart-4" },
  attendance: { icon: CalendarCheck, className: "bg-chart-5/15 text-chart-5" },
};

// A handful of well-known metric keys get a more specific icon than their category
// default. Anything not listed here still gets a sensible category-level icon.
const KEY_ICON_OVERRIDE: Record<string, LucideIcon> = {
  csat_score: Smile,
};

const DEFAULT_STYLE = { icon: BarChart3, className: "bg-muted text-muted-foreground" };

export function MetricIcon({
  metricKey,
  category,
  className,
}: {
  metricKey: string;
  category: string | null;
  className?: string;
}) {
  const style = (category && CATEGORY_STYLE[category]) || DEFAULT_STYLE;
  const Icon = KEY_ICON_OVERRIDE[metricKey] ?? style.icon;

  return (
    <span
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
        style.className,
        className
      )}
      aria-hidden="true"
    >
      <Icon className="h-3.5 w-3.5" />
    </span>
  );
}
