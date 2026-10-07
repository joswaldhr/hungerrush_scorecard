import { z } from "zod";

const instant = z.iso.datetime({ offset: true });
/** Locate local reporting midnights without assuming a fixed UTC offset across DST. */
export function ticketReportPeriodBounds(periodStart: string, periodEnd: string, timeZone: string) {
  z.iso.date().parse(periodStart);
  z.iso.date().parse(periodEnd);
  if (periodEnd < periodStart || Date.parse(periodEnd) - Date.parse(periodStart) > 31 * 86400000)
    throw Error("Invalid ticket report period");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayAt = (seconds: number) => {
    const parts = formatter.formatToParts(new Date(seconds * 1000));
    return ["year", "month", "day"]
      .map((type) => parts.find((p) => p.type === type)!.value)
      .join("-");
  };
  const boundary = (day: string) => {
    const utc = Date.parse(day) / 1000;
    let lo = utc - 36 * 3600,
      hi = utc + 36 * 3600;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (dayAt(mid) < day) lo = mid + 1;
      else hi = mid;
    }
    if (dayAt(lo) !== day || dayAt(lo - 1) >= day)
      throw Error("Reporting date has no supported local boundary");
    return new Date(lo * 1000);
  };
  const nextDay = new Date(Date.parse(periodEnd) + 86400000).toISOString().slice(0, 10);
  return { start: boundary(periodStart), endExclusive: boundary(nextDay) };
}
export const ticketReportCoverageSchema = z.object({
  start: instant,
  endExclusive: instant,
  complete: z.boolean(),
  // Explicit current-period coverage, not a claim that the full week has elapsed.
  asOf: instant.optional(),
});

export function ticketReportCoverage(
  coverage: z.infer<typeof ticketReportCoverageSchema>,
  observedAt: string,
  scope: { periodStart: string; periodEnd: string; timeZone: string }
) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayAt = (time: number) => {
    const parts = formatter.formatToParts(new Date(time));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const start = Date.parse(coverage.start),
    end = Date.parse(coverage.endExclusive);
  const observed = Date.parse(observedAt);
  if (start >= end || end > observed) throw Error("Invalid ticket report observation chronology");
  const beginsBeforePeriod =
    dayAt(start) <= scope.periodStart && dayAt(start - 1) < scope.periodStart;
  let cutoff: number | null = null;
  if (coverage.asOf !== undefined) {
    cutoff = Date.parse(coverage.asOf);
    if (
      cutoff !== end ||
      dayAt(cutoff) < scope.periodStart ||
      dayAt(cutoff) > scope.periodEnd ||
      dayAt(observed) < scope.periodStart ||
      dayAt(observed) > scope.periodEnd
    )
      throw Error("Invalid current-period ticket report cutoff");
  }
  return {
    start,
    end,
    dayAt,
    cutoff,
    covered:
      coverage.complete && beginsBeforePeriod && (cutoff !== null || dayAt(end) > scope.periodEnd),
  };
}
