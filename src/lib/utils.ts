import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function weekDates(weeksAgo = 0) {
  const now = new Date();
  const dayOfWeek = now.getUTCDay();
  const currentMonday = new Date(now);
  currentMonday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7));

  const monday = new Date(currentMonday);
  monday.setUTCDate(currentMonday.getUTCDate() - weeksAgo * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const prevMonday = new Date(monday);
  prevMonday.setUTCDate(monday.getUTCDate() - 7);

  return {
    periodStart: monday.toISOString().split("T")[0]!,
    periodEnd: sunday.toISOString().split("T")[0]!,
    previousPeriodStart: prevMonday.toISOString().split("T")[0]!,
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
