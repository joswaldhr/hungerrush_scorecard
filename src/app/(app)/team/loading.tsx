import { Skeleton } from "@/components/ui/skeleton";

export default function TeamLoading() {
  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <header className="space-y-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-32" />
      </header>

      {/* Team selector pills */}
      <Skeleton className="h-8 w-64 rounded-md" />

      {/* Summary stat cards: 4 across */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>

      {/* Roster table */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full rounded-md" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    </div>
  );
}
