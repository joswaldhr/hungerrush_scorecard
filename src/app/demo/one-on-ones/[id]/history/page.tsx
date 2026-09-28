import Link from "next/link";
import { notFound } from "next/navigation";
import { requireDemoAccess } from "@/lib/demo/authorization";
import { demoEmployees } from "@/lib/demo/fixtures";
import {
  resolveReportingWeek,
  shiftWeekStart,
  weekBoundsForDate,
  formatWeekRangeLong,
} from "@/lib/utils";

export default async function DemoHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnWeek?: string | string[] }>;
}) {
  await requireDemoAccess();
  const { id } = await params;
  const employee = demoEmployees.find((item) => item.id === id);
  if (!employee) notFound();
  const { returnWeek } = await searchParams;
  const backWeek = resolveReportingWeek(typeof returnWeek === "string" ? returnWeek : undefined);
  const latest = resolveReportingWeek(undefined);
  return (
    <>
      <Link
        href={`/demo/one-on-ones/${id}?week=${backWeek}`}
        className="text-sm text-muted-foreground underline"
      >
        ← Back to {employee.displayName}
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Demo reporting weeks</h1>
        <p className="mt-2 text-muted-foreground">
          Six recent fictional weeks for {employee.displayName}. These are repeatable demonstration
          scenarios, not stored source records or revisions.
        </p>
      </header>
      <ul className="divide-y divide-border rounded-xl border bg-card">
        {Array.from({ length: 6 }, (_, index) => {
          const start = shiftWeekStart(latest, -index);
          return (
            <li key={start}>
              <Link
                className="flex items-center justify-between gap-4 p-5 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                href={`/demo/one-on-ones/${id}?week=${start}`}
              >
                <span>{formatWeekRangeLong(start, weekBoundsForDate(start).periodEnd)}</span>
                <span className="text-sm text-primary">Review week →</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
