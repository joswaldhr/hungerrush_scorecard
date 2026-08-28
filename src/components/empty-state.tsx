import { Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("flex flex-col items-center justify-center py-12 text-center", className)}
    >
      <Icon className="h-10 w-10 text-muted-foreground/50 mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
