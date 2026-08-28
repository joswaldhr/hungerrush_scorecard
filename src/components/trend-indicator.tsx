import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Direction = "improved" | "declined" | "stable" | "new";

export function TrendIndicator({
  direction,
  value,
  className,
}: {
  direction: Direction;
  value?: string | null;
  className?: string;
}) {
  const Icon =
    direction === "improved" ? TrendingUp : direction === "declined" ? TrendingDown : Minus;

  const colorClass =
    direction === "improved"
      ? "text-status-on-track"
      : direction === "declined"
        ? "text-status-attention"
        : "text-muted-foreground";

  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", colorClass, className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {value && <span>{value}</span>}
      <span className="sr-only">{direction}</span>
    </span>
  );
}
