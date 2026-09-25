import { expect, it } from "vitest";
import {
  readMetricSourceContext,
  sharedMetricSourceContext,
  compatibleMetricSourceContexts,
  SOLVED_CSAT_CONTRACT,
} from "./source-context";
const current = { sourceContract: SOLVED_CSAT_CONTRACT, reportingTimeZone: "America/Chicago" };
it("retains explicit source context while leaving legacy observations unclassified", () => {
  expect(readMetricSourceContext({ factIds: ["synthetic"] })).toBeNull();
  expect(sharedMetricSourceContext([current])).toEqual(current);
  expect(sharedMetricSourceContext([null, {}])).toBeNull();
});
it("rejects mixed cohorts and duplicate complete CSAT snapshots", () => {
  expect(() => sharedMetricSourceContext([current, null])).toThrow(/incompatible/);
  expect(() =>
    sharedMetricSourceContext([current, { ...current, reportingTimeZone: "UTC" }])
  ).toThrow(/incompatible/);
  expect(() => sharedMetricSourceContext([current, current])).toThrow(/one complete/);
});
it("does not compare legacy periods to a replacement cohort or changed timezone", () => {
  expect(compatibleMetricSourceContexts(current, {})).toBe(false);
  expect(compatibleMetricSourceContexts(current, current)).toBe(true);
  expect(compatibleMetricSourceContexts(current, { ...current, reportingTimeZone: "UTC" })).toBe(
    false
  );
  expect(compatibleMetricSourceContexts({}, null)).toBe(true);
  expect(
    compatibleMetricSourceContexts(
      { ...current, sourceScopeFingerprint: "a".repeat(64) },
      { ...current, sourceScopeFingerprint: "b".repeat(64) }
    )
  ).toBe(false);
  expect(() =>
    sharedMetricSourceContext([{ ...current, sourceScopeFingerprint: "a".repeat(64) }, current])
  ).toThrow(/incompatible/);
});
it("rejects incomplete or invalid context", () => {
  expect(() => readMetricSourceContext({ sourceContract: SOLVED_CSAT_CONTRACT })).toThrow();
  expect(() =>
    readMetricSourceContext({ ...current, reportingTimeZone: "invalid-zone" })
  ).toThrow();
});
