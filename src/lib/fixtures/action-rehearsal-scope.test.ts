// @vitest-environment node
import { expect, it } from "vitest";
import { actionRehearsalScope } from "./action-rehearsal-scope";

const now = Date.parse("2026-09-24T12:00:00Z");
it("isolates weekly observations from the original daily namespace", () => {
  const day = actionRehearsalScope("2026-09-13", undefined, now);
  const week = actionRehearsalScope("2026-09-13", "2026-09-19", now);
  expect(week.days).toBe(7);
  expect(week.start.toISOString()).toBe("2026-09-13T00:00:00.000Z");
  expect(week.endExclusive.toISOString()).toBe("2026-09-20T00:00:00.000Z");
  expect(week.dataSourceId).not.toBe(day.dataSourceId);
  expect(week.organizationId).not.toBe(day.organizationId);
  expect(actionRehearsalScope("2026-09-13", "2026-09-19", now)).toEqual(week);
  expect(actionRehearsalScope("2026-09-13", "2026-09-13", now)).toEqual(day);
});

it.each([
  ["2026-09-13", "2026-09-12"],
  ["2026-09-13", "2026-09-20"],
  ["2026-09-24", "2026-09-24"],
  ["2026-02-30", "2026-03-01"],
  ["not-a-date", "2026-09-19"],
])("rejects invalid or open intervals %s through %s", (start, end) => {
  expect(() => actionRehearsalScope(start, end, now)).toThrow();
});

it("retains the two-minute source lag", () => {
  expect(() =>
    actionRehearsalScope("2026-09-23", undefined, Date.parse("2026-09-24T00:01:59Z"))
  ).toThrow();
});
