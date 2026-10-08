import { expect, it } from "vitest";
import { parseSyncPeriod } from "@/lib/connectors/sync-period";

it.each([
  ["2026-09-27", "2026-10-03", "2026-10-03T23:59:59Z"],
  ["2026-09-27", "2026-10-03", "2026-10-04T00:00:01Z"],
  ["2026-12-27", "2027-01-02", "2027-01-03T00:00:01Z"],
  ["2024-02-25", "2024-03-02", "2024-03-03T00:00:01Z"],
  ["2026-11-01", "2026-11-07", "2026-11-08T00:00:01Z"],
])("preserves fixed dates %s–%s across calendar/DST boundaries", (periodStart, periodEnd, now) => {
  expect(parseSyncPeriod({ periodStart, periodEnd }, new Date(now))).toEqual({
    periodStart,
    periodEnd,
  });
});

it.each([
  ["2026-10-05", "2026-10-11"],
  ["2026-10-04", "2026-10-09"],
  ["2026-02-30", "2026-03-06"],
  ["2026-10-11", "2026-10-17"],
])("rejects malformed, non-week or future intervals %s–%s", (periodStart, periodEnd) => {
  expect(() =>
    parseSyncPeriod({ periodStart, periodEnd }, new Date("2026-10-07T12:00:00Z"))
  ).toThrow();
});
