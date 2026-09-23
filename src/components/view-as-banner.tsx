import { clearViewAs } from "@/app/(app)/admin/actions";
import { Eye, LogOut } from "lucide-react";

export function ViewAsBanner({ displayName }: { displayName: string }) {
  return (
    <div className="flex items-center justify-between border-b border-accent/30 bg-accent/10 px-8 py-2 text-sm">
      <span className="flex items-center gap-2 text-foreground">
        <Eye className="h-3.5 w-3.5 text-accent shrink-0" aria-hidden="true" />
        Viewing as <span className="font-medium">{displayName}</span>
      </span>
      <form action={clearViewAs}>
        <button type="submit" className="flex items-center gap-1.5 text-accent hover:underline">
          Exit view
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
