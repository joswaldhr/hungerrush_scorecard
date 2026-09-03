// Tests the canonical, exported weekDates() only (src/lib/utils.ts). Three other
// reimplementations of this same Monday-start-of-week arithmetic exist in the
// codebase — scripts/run-reconciliation.ts's private weekDates() and the inline
// arithmetic in zendesk-mock.ts/assembled-mock.ts — using LOCAL server time
// instead of UTC. They are not exported, so they cannot be unit-tested without
// a testability-only source edit; that gap is documented in
// docs/audits/2026-09-01-metric-integrity-report.md rather than silently
// worked around here.
import { describe, it, expect, afterEach, vi } from "vitest";
import { weekDates } from "@/lib/utils";

describe("weekDates", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a UTC Monday 00:00:01 to itself as periodStart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T00:00:01Z")); // Monday
    const { periodStart, periodEnd, isCurrentWeek } = weekDates(0);
    expect(periodStart).toBe("2026-08-17");
    expect(periodEnd).toBe("2026-08-23");
    expect(isCurrentWeek).toBe(true);
  });

  it("resolves a UTC Sunday 23:59:59 to the same week that started the prior Monday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T23:59:59Z")); // Sunday
    const { periodStart, periodEnd } = weekDates(0);
    expect(periodStart).toBe("2026-08-17");
    expect(periodEnd).toBe("2026-08-23");
  });

  it("resolves periodStart/periodEnd from getUTCDay/setUTCDate, per source at src/lib/utils.ts:8-29", () => {
    // 2026-08-17T02:00:00Z is Monday in UTC but still Sunday 2026-08-16 in any
    // timezone behind UTC-3. weekDates() uses only getUTCDay()/setUTCDate(), so
    // its result must depend solely on the UTC calendar date, never on the
    // process's local timezone. (Node's process.env.TZ is not reliably
    // re-read mid-process, so this is asserted directly against a fixed
    // instant rather than by mutating TZ at runtime — see the source
    // citation above for the actual UTC-only guarantee.)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-17T02:00:00Z"));
    const { periodStart } = weekDates(0);
    expect(periodStart).toBe("2026-08-17");
  });

  it("computes previousPeriodStart as exactly 7 days before periodStart", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00Z")); // Wednesday
    const { periodStart, previousPeriodStart } = weekDates(0);
    expect(periodStart).toBe("2026-08-17");
    expect(previousPeriodStart).toBe("2026-08-10");
  });

  it("walks back N weeks when weeksAgo is provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-19T12:00:00Z")); // Wednesday, week of Aug 17
    const oneWeekAgo = weekDates(1);
    expect(oneWeekAgo.periodStart).toBe("2026-08-10");
    expect(oneWeekAgo.periodEnd).toBe("2026-08-16");
    expect(oneWeekAgo.isCurrentWeek).toBe(false);

    const fourWeeksAgo = weekDates(4);
    expect(fourWeeksAgo.periodStart).toBe("2026-07-20");
  });

  it("handles a US DST transition instant without shifting the UTC week boundary", () => {
    // US DST ended 2026-11-01 — a purely UTC-based function should be
    // unaffected either way. Confirm the boundary lands on the correct
    // UTC Monday regardless.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-01T12:00:00Z")); // Sunday
    const { periodStart, periodEnd } = weekDates(0);
    expect(periodStart).toBe("2026-10-26");
    expect(periodEnd).toBe("2026-11-01");
  });
});
