import { Skeleton } from "@/components/ui/skeleton";

export default function OneOnOneLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-4 w-24" />

      <header className="flex flex-wrap items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-9 w-64 rounded-lg" />
      </header>

      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
