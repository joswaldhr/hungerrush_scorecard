import { clearViewAs } from "@/app/(app)/admin/actions";

export function ViewAsBanner({ displayName }: { displayName: string }) {
  return (
    <div className="flex items-center justify-between border-b border-accent/30 bg-accent/10 px-8 py-2 text-sm">
      <span className="text-foreground">
        Viewing as <span className="font-medium">{displayName}</span>
      </span>
      <form action={clearViewAs}>
        <button type="submit" className="text-accent hover:underline">
          Exit
        </button>
      </form>
    </div>
  );
}
