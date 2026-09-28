// @vitest-environment node
import { expect, it } from "vitest";
import { outboundObservationFixture } from "@/__tests__/fixtures/outbound-observation";
import { buildOutboundRecord, normalizeOutboundRecord } from "./zendesk-outbound-record";

const build = (f = outboundObservationFixture()) =>
  buildOutboundRecord(
    f.snapshot,
    f.tickets,
    f.policy,
    f.config,
    f.identity,
    f.periodStart,
    f.periodEnd,
    f.now
  );
const normalize = (payload: unknown) =>
  normalizeOutboundRecord(
    payload,
    "synthetic-employee",
    "00000000-0000-4000-8000-000000000003",
    "2026-09-20",
    "2026-09-26"
  );

it("replays exact employee values with native seconds, reported zeros and measured denominators", () => {
  const record = build(),
    facts = normalize(JSON.parse(JSON.stringify(record.payload)));
  expect(facts.map((f) => [f.factType, f.numericValue, f.unit])).toEqual([
    ["outbound_calls", 2, "count"],
    ["outbound_calls_completed", 1, "count"],
    ["outbound_calls_non_answered", 1, "count"],
    ["avg_talk_time_outbound", 2 / 3, "s"],
    ["avg_hold_time_outbound", null, "s"],
  ]);
  expect(facts[3]!.dimensionsJson).toMatchObject({
    sampleCount: 3,
    cohortCount: 3,
    sumSeconds: 2,
    selectedLegIds: [1, 2, 3],
    measuredLegIds: [1, 2, 3],
    zeroLegIds: [3],
  });
  expect(JSON.stringify(record.payload)).not.toContain("unnecessary source line");
});
it("honors selected team keys and does not broaden the cutover or source binding", () => {
  const f = outboundObservationFixture();
  f.policy.teams[0]!.outbound!.metricKeys = ["outbound_calls"];
  expect(normalize(build(f).payload)).toHaveLength(1);
  f.policy.effectivePeriodStart = "2026-09-27";
  expect(() => build(f)).toThrow("prospective");
  f.policy.effectivePeriodStart = "2026-09-20";
  f.config.organizationId = "other";
  expect(() => build(f)).toThrow("organization");
});
it("revalidates identity and raw evidence at normalization rather than accepting stored totals", () => {
  const record = build();
  expect(() =>
    normalizeOutboundRecord(record.payload, "other", "team", "2026-09-20", "2026-09-26")
  ).toThrow("changed");
  const payload = structuredClone(record.payload);
  const evidence = payload.sourceEvidence as {
    legs: Array<{ agent_id: number }>;
    numericValue?: number;
  };
  evidence.numericValue = 999;
  expect(normalize(payload)[0]!.numericValue).toBe(2);
  evidence.legs[0]!.agent_id = 99;
  expect(() => normalize(payload)).toThrow("employee evidence");
});
it("rejects incomplete observations before building and retains uncertain outcomes as null", () => {
  const f = outboundObservationFixture();
  f.snapshot.callsState.cursor.status = "pending";
  expect(() => build(f)).toThrow("exhausted");
  f.snapshot.callsState.cursor.status = "exhausted";
  const record = build(f),
    payload = structuredClone(record.payload);
  const evidence = payload.sourceEvidence as { calls: Array<{ talk_time: number | null }> };
  evidence.calls[0]!.talk_time = null;
  const facts = normalize(payload);
  expect(facts[0]!.numericValue).toBe(2);
  expect(facts[1]!.numericValue).toBeNull();
  expect(facts[2]!.numericValue).toBeNull();
});
