// @vitest-environment node
import { expect, it } from "vitest";
import { isEffectiveOn } from "./effective-dates";
import { resolveTarget } from "./target-resolution";
it("uses inclusive starts and exclusive ends, including unbounded dates", () => {
  const interval = { effectiveFrom: "2026-09-13", effectiveTo: "2026-09-20" };
  expect(isEffectiveOn(interval, "2026-09-12")).toBe(false);
  expect(isEffectiveOn(interval, "2026-09-13")).toBe(true);
  expect(isEffectiveOn(interval, "2026-09-19")).toBe(true);
  expect(isEffectiveOn(interval, "2026-09-20")).toBe(false);
  expect(isEffectiveOn({ effectiveFrom: null, effectiveTo: null }, "2026-09-13")).toBe(true);
});
it("rejects conflicting equal-precedence targets regardless of row order", () => {
  const first = {
    targetType: "range",
    targetMin: 10,
    targetMax: 20,
    targetValue: null,
    warningValue: null,
    priority: 0,
    teamId: "team",
    employeeId: null,
    roleKey: null,
    line: null,
  };
  const second = { ...first, targetMax: 30 };
  expect(resolveTarget([first, second], "employee", null, "team", null)).toBeNull();
  expect(resolveTarget([second, first], "employee", null, "team", null)).toBeNull();
  expect(resolveTarget([first, { ...first }], "employee", null, "team", null)?.targetMax).toBe(20);
});
