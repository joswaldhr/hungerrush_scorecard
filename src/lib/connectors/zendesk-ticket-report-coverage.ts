import { z } from "zod";

const instant = z.iso.datetime({ offset: true });
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
