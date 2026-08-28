import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="max-w-6xl space-y-8">
      {/* Header: greeting + week nav */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-8 w-48 rounded-md" />
      </header>

      {/* Stat cards: 4 across */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-lg" />
        ))}
      </div>

      {/* 3-column grid: briefing sections + upcoming 1:1s */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-2">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>

      {/* Team performance table */}
      <Skeleton className="h-56 rounded-lg" />
    </div>
  );
}
