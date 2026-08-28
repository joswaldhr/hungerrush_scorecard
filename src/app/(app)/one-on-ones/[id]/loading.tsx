import { Skeleton } from "@/components/ui/skeleton";

export default function OneOnOneLoading() {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Top nav: links + back */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>

      {/* Meeting header: avatar + name + date card */}
      <header className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-14 w-40 rounded-md" />
      </header>

      <Skeleton className="h-px w-full" />

      {/* Takeaway card */}
      <Skeleton className="h-28 rounded-lg" />

      {/* Sections: talking points, metrics, context */}
      <div className="space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-40 rounded-lg" />

        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-32 rounded-lg" />

        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-32 rounded-lg" />
      </div>

      {/* Meeting prep checklist */}
      <Skeleton className="h-48 rounded-lg" />
    </div>
  );
}
