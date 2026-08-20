import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something went wrong",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center justify-center py-12 text-center", className)}
    >
      <AlertTriangle className="h-10 w-10 text-destructive/50 mb-3" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
