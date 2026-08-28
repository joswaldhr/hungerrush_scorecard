import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeLoading() {
  return (
    <div className="max-w-5xl space-y-6">
      {/* Back nav */}
      <Skeleton className="h-4 w-24" />

      {/* Identity header: avatar + name + period selector + CTA */}
      <header className="flex flex-wrap items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-8 w-52 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-md" />
      </header>

      <Skeleton className="h-px w-full" />

      {/* Two-column layout: metrics left, context right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-4">
          {/* Metric cards */}
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
          {/* History chart */}
          <Skeleton className="h-56 rounded-lg" />
        </div>
        <div className="lg:col-span-2 space-y-4">
          {/* Context tabs */}
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-48 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
