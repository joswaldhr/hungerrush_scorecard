// The ONE week definition for the whole app (Phase 1C commit 6, fixes L2).
// The sync has always written metric_snapshots.period_start from the UTC Monday; the
// frontend used to compute a LOCAL Monday via date-fns startOfWeek, which disagrees
// near week edges (US timezones: Sunday evening local is already Monday UTC, so pages
// showed "no data this week" until local midnight). Every reader and writer now derives
// the week from these functions. All math is pure UTC milliseconds — no local-calendar
// arithmetic, so DST transitions can never shift a week boundary.

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Monday 00:00:00 UTC of the week containing `now` (default: current time). */
export function currentWeekStartUtc(now: Date = new Date()): Date {
  const day = now.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + mondayOffset,
  ));
}

/** The Monday `n` whole weeks before a UTC week-start Date. */
export function weeksBeforeUtc(weekStart: Date, n: number): Date {
  return new Date(weekStart.getTime() - n * WEEK_MS);
}

/** YYYY-MM-DD of a UTC week-start Date — the metric_snapshots.period_start format. */
export function weekStartStr(weekStart: Date): string {
  return weekStart.toISOString().substring(0, 10);
}
