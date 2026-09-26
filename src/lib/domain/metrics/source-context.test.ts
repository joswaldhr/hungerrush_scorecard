import { expect, it } from "vitest";
import {
  readMetricSourceContext,
  sharedMetricSourceContext,
  compatibleMetricSourceContexts,
  SOLVED_CSAT_CONTRACT,
  OUTBOUND_PARTICIPATION_CONTRACT,
  completeSnapshotVersion,
} from "./source-context";
const current = { sourceContract: SOLVED_CSAT_CONTRACT, reportingTimeZone: "America/Chicago" };
it("retains explicit source context while leaving legacy observations unclassified", () => {
  expect(readMetricSourceContext({ factIds: ["synthetic"] })).toBeNull();
  expect(sharedMetricSourceContext([current])).toEqual(current);
  expect(sharedMetricSourceContext([null, {}])).toBeNull();
});

it("retains outbound leg denominators and refuses duplicate or mixed snapshot contracts", () => {
  const outbound = {
    sourceContract: OUTBOUND_PARTICIPATION_CONTRACT,
    reportingTimeZone: "America/Chicago",
    sampleCount: 2,
    cohortCount: 3,
  };
  expect(readMetricSourceContext(outbound)).toEqual(outbound);
  expect(completeSnapshotVersion(outbound.sourceContract)).toBe(2);
  expect(() => readMetricSourceContext({ ...outbound, sampleCount: 4 })).toThrow("sample coverage");
  expect(() => sharedMetricSourceContext([outbound, outbound])).toThrow("one complete");
  expect(() => sharedMetricSourceContext([outbound, null])).toThrow("incompatible");
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
