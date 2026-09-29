// @vitest-environment node
import { expect, it } from "vitest";
import { inboundObservationFixture } from "@/__tests__/fixtures/inbound-observation";
import { buildInboundRecord, normalizeInboundRecord } from "./zendesk-inbound-record";
import { compatibleMetricSourceContexts } from "@/lib/domain/metrics/source-context";
import {
  metricSourceDescription,
  unsupportedMetricReason,
} from "@/lib/domain/metrics/source-description";
import { readMetricSourceContext } from "@/lib/domain/metrics/source-context";

const build = (f = inboundObservationFixture()) =>
  buildInboundRecord(f.snapshot, f.policy, f.config, f.identity, f.periodStart, f.periodEnd, f.now);
const normalize = (payload: unknown) =>
  normalizeInboundRecord(
    payload,
    "synthetic-employee",
    "00000000-0000-4000-8000-000000000003",
    "2026-09-20",
    "2026-09-26"
  );
it("replays distinct acceptance/offered/missed sets and measured duration denominators", () => {
  const record = build(),
    facts = normalize(JSON.parse(JSON.stringify(record.payload)));
  expect(facts.map((f) => [f.factType, f.numericValue, f.unit])).toEqual([
    ["inbound_calls_offered", 4, "count"],
    ["inbound_calls_accepted", 2, "count"],
    ["inbound_calls_abandoned_on_hold", 1, "count"],
    ["missed_calls", 1, "count"],
    ["declined_calls", 0, "count"],
    ["avg_talk_time_inbound", 2 / 3, "s"],
    ["avg_hold_time_inbound", null, "s"],
    ["avg_call_duration_inbound", 10, "s"],
    ["avg_consultation_time_inbound", null, "s"],
  ]);
  expect(facts[5]!.dimensionsJson).toMatchObject({
    sampleCount: 3,
    cohortCount: 3,
    sumSeconds: 2,
    measuredLegIds: [1, 2, 3],
    zeroLegIds: [3],
    unreachableLegIds: [5],
  });
  const context = readMetricSourceContext(facts[5]!.dimensionsJson);
  expect(metricSourceDescription(facts[5]!.factType, "zendesk", context)).toContain(
    "3 measured legs out of 3"
  );
  expect(unsupportedMetricReason("avg_hold_time_inbound", "zendesk", context)).toContain(
    "No reported"
  );
  expect(unsupportedMetricReason("missed_calls", "zendesk", context)).toBeNull();
  expect(JSON.stringify(record.payload)).not.toContain('"ticket_id"');
});
it("requires explicit filter and offered policies and separates changed comparison contexts", () => {
  const f = inboundObservationFixture(),
    first = normalize(build(f).payload);
  f.policy.teams[0]!.inbound!.offeredDefinition = "accepted-declined-missed";
  const second = normalize(build(f).payload);
  expect(second[0]!.numericValue).toBe(3);
  expect(compatibleMetricSourceContexts(first[0]!.dimensionsJson, second[0]!.dimensionsJson)).toBe(
    false
  );
  f.policy.teams[0]!.inbound!.legCompletionStatuses = ["completed"];
  expect(normalize(build(f).payload)[0]!.numericValue).toBe(2);
  const payload = structuredClone(build(f).payload);
  const e = payload.sourceEvidence as { scope: Record<string, unknown> };
  delete e.scope.offeredDefinition;
  expect(() => normalize(payload)).toThrow("publication evidence");
});
it("preserves true zero counts and unavailable averages for an empty observed cohort", () => {
  const f = inboundObservationFixture();
  f.policy.teams[0]!.inbound!.groupIds = [88];
  const facts = normalize(build(f).payload);
  expect(facts.slice(0, 5).every((f) => f.numericValue === 0)).toBe(true);
  expect(facts.slice(5).every((f) => f.numericValue === null)).toBe(true);
});
it("rejects missing parents, stale observations and publication outside prospective ownership", () => {
  const f = inboundObservationFixture();
  f.snapshot.calls.pop();
  expect(() => build(f)).toThrow("parent-call coverage");
  const stale = inboundObservationFixture();
  stale.now = new Date("2026-09-26T12:00:00Z");
  expect(() => build(stale)).toThrow("stale");
  const future = inboundObservationFixture();
  future.policy.effectivePeriodStart = "2026-09-27";
  expect(() => build(future)).toThrow("prospective");
});
it("rejects foreign identity, unrelated evidence and changed team at normalization", () => {
  const record = build(),
    payload = structuredClone(record.payload);
  expect(() =>
    normalizeInboundRecord(payload, "other", "team", "2026-09-20", "2026-09-26")
  ).toThrow("changed");
  const evidence = payload.sourceEvidence as {
    legs: Array<{ agent_id: number }>;
    numericValue?: number;
  };
  evidence.numericValue = 999;
  expect(normalize(payload)[0]!.numericValue).toBe(4);
  evidence.legs[0]!.agent_id = 99;
  expect(() => normalize(payload)).toThrow("employee evidence");
});
it("uses the explicit date basis at Central midnight without conflating supervisor acceptance", () => {
  const f = inboundObservationFixture();
  f.snapshot.calls.forEach((c) => {
    c.created_at = "2026-09-20T04:59:59Z";
  });
  expect(normalize(build(f).payload)[0]!.numericValue).toBe(0);
  f.policy.teams[0]!.inbound!.dateBasis = "leg-created";
  f.snapshot.legs[0]!.type = "supervisor";
  const facts = normalize(build(f).payload);
  expect(facts[1]!.numericValue).toBe(1);
  expect(facts[5]!.numericValue).toBe(2 / 3);
});
