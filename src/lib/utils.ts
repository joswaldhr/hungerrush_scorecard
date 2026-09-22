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
