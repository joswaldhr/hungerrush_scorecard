import type { LucideIcon } from "lucide-react";
import {
  Ticket,
  Star,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  CalendarCheck,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// One icon + color per metric category (metric_definitions.category), reusing the
// design system's existing chart-1..5 palette rather than inventing new hues.
// Keyed to the taxonomy category-labels.ts actually uses (ticket_case_work,
// inbound_call, etc) -- a previous version of this map used a different,
// unrelated set of category names (productivity/workload/attendance) that
// never matched real data, so every ticket/call row silently fell back to
// the same generic icon regardless of category.
const CATEGORY_STYLE: Record<string, { icon: LucideIcon; className: string }> = {
  ticket_case_work: { icon: Ticket, className: "bg-chart-1/15 text-chart-1" },
  quality: { icon: Star, className: "bg-chart-2/15 text-chart-2" },
  efficiency: { icon: Clock, className: "bg-chart-3/15 text-chart-3" },
  inbound_call: { icon: PhoneIncoming, className: "bg-chart-4/15 text-chart-4" },
  outbound_call: { icon: PhoneOutgoing, className: "bg-chart-4/15 text-chart-4" },
  status_time: { icon: CalendarCheck, className: "bg-chart-5/15 text-chart-5" },
};

const DEFAULT_STYLE = { icon: BarChart3, className: "bg-muted text-muted-foreground" };

// Renders one icon per metric category, used at the section-header level
// (e.g. "TICKET / CASE WORK METRICS"). Previously also rendered beside every
// row, which -- combined with the category mismatch above -- meant nearly
// every row showed the same generic icon; removed in favor of one
// meaningful icon per section instead of decorative repetition per row.
export function MetricIcon({
  category,
  className,
}: {
  category: string | null;
  className?: string;
}) {
  const style = (category && CATEGORY_STYLE[category]) || DEFAULT_STYLE;
  const Icon = style.icon;

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
