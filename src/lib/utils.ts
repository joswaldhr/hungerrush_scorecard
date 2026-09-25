import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Work week is Sunday-Saturday (confirmed with Barb for Menufy 2026-09-22; applied
// company-wide for now since POS's actual work week is unconfirmed -- see FOLLOWUPS.md).
export function weekDates(weeksAgo = 0) {
  const now = new Date();
  const currentWeekStart = new Date(now);
  currentWeekStart.setUTCDate(now.getUTCDate() - now.getUTCDay());

  const weekStart = new Date(currentWeekStart);
  weekStart.setUTCDate(currentWeekStart.getUTCDate() - weeksAgo * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  const prevWeekStart = new Date(weekStart);
  prevWeekStart.setUTCDate(weekStart.getUTCDate() - 7);

  return {
    periodStart: weekStart.toISOString().split("T")[0]!,
    periodEnd: weekEnd.toISOString().split("T")[0]!,
    previousPeriodStart: prevWeekStart.toISOString().split("T")[0]!,
    now: now.getTime(),
    hour: now.getHours(),
    isCurrentWeek: weeksAgo === 0,
  };
}

// Given any date, returns the Sunday-Saturday week (UTC) that contains it --
// same anchor as weekDates(), generalized to an arbitrary reference date
// instead of always "now". Used for arrow/calendar week navigation.
export function weekBoundsForDate(dateStr: string) {
  const ref = new Date(`${dateStr}T00:00:00Z`);
  const weekStart = new Date(ref);
  weekStart.setUTCDate(ref.getUTCDate() - ref.getUTCDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
  return {
    periodStart: weekStart.toISOString().split("T")[0]!,
    periodEnd: weekEnd.toISOString().split("T")[0]!,
  };
}

/** Normalize untrusted URL/calendar input; impossible and future dates use the current week. */
export function resolveReportingWeek(value: string | null | undefined): string {
  const current = weekDates(0).periodStart;
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return current;
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return current;
  const normalized = weekBoundsForDate(value).periodStart;
  return normalized > current ? current : normalized;
}

// Shifts a periodStart (always a Sunday, per weekDates()'s convention) by N
// weeks -- negative goes back, positive goes forward.
export function shiftWeekStart(periodStart: string, deltaWeeks: number): string {
  const d = new Date(`${periodStart}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaWeeks * 7);
  return d.toISOString().split("T")[0]!;
}

// How many whole weeks before the real current week a given periodStart is
// (0 = current week, 1 = last week, etc). Drives the "N weeks ago" label and
// the current-week disabled state on the navigator's next arrow.
export function weeksAgoFor(periodStart: string): number {
  const current = weekDates(0).periodStart;
  const diffMs =
    new Date(`${current}T00:00:00Z`).getTime() - new Date(`${periodStart}T00:00:00Z`).getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

// Compact date-range label for table headers, e.g. "Sep 20-26", or "Aug
// 30-Sep 5" when the range crosses a month boundary.
export function formatWeekRangeShort(periodStart: string, periodEnd: string): string {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  const startMonth = start.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const endMonth = end.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  return startMonth === endMonth
    ? `${startMonth} ${startDay}–${endDay}`
    : `${startMonth} ${startDay}–${endMonth} ${endDay}`;
}

// Long-form date-range label for headers/subtitles, e.g. "Sep 20 - Sep 26, 2026".
export function formatWeekRangeLong(periodStart: string, periodEnd: string): string {
  const start = new Date(`${periodStart}T00:00:00Z`);
  const end = new Date(`${periodEnd}T00:00:00Z`);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${startLabel} – ${endLabel}`;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

// Runs `fn` over `items` with at most `concurrency` in flight at once,
// batch by batch (not a sliding window) -- simple and sufficient for
// bounded-fanout API calls where per-item latency is roughly uniform.
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (const batch of chunk(items, concurrency)) {
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}
