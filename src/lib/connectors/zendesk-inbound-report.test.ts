// @vitest-environment node
import { expect, it } from "vitest";
import { outboundObservationFixture } from "@/__tests__/fixtures/outbound-observation";
import {
  calculateInboundReport,
  inboundReportKeys,
  type InboundReportScope,
} from "./zendesk-inbound-report";
import {
  buildInboundReportRecord,
  normalizeInboundReportRecord,
  parseInboundReportPolicy,
} from "./zendesk-inbound-report-record";

function fixture() {
  const f = outboundObservationFixture();
  for (const c of f.snapshot.calls) {
    c.direction = "inbound";
    c.call_group_id = 7;
    c.phone_number = "synthetic-line";
  }
  const scope: InboundReportScope = {
    periodStart: f.periodStart,
    periodEnd: f.periodEnd,
    timeZone: "America/Chicago",
    agentId: 42,
    groupIds: [7],
    phoneNumbers: ["synthetic-line"],
    dateBasis: "call-created",
    offeredDefinition: "accepted-declined-missed-unreachable",
  };
  const policy = parseInboundReportPolicy({
    schemaVersion: 1,
    ...f.config,
    teamId: f.identity.teamId,
    accountReference: f.snapshot.accountReference,
    effectivePeriodStart: f.periodStart,
    timeZone: scope.timeZone,
    groupIds: scope.groupIds,
    phoneNumbers: scope.phoneNumbers,
    dateBasis: scope.dateBasis,
    offeredDefinition: scope.offeredDefinition,
    metricKeys: inboundReportKeys,
    observationLimits: f.policy.observationLimits,
  });
  return { ...f, scope, inboundPolicy: policy };
}
const calculate = (f = fixture()) =>
  calculateInboundReport(f.snapshot.calls, f.snapshot.legs, f.scope);
const build = (f = fixture()) =>
  buildInboundReportRecord(
    f.snapshot,
    f.inboundPolicy,
    f.config,
    f.identity,
    f.periodStart,
    f.periodEnd,
    f.now
  );
function normalize(payload: unknown) {
  const f = fixture();
  return normalizeInboundReportRecord(
    payload,
    f.identity.employeeId,
    f.identity.teamId,
    f.periodStart,
    f.periodEnd
  );
}

it("counts offers by agent legs, including unreachable and transfer-declined, rather than distinct calls", () => {
  const f = fixture(),
    base = f.snapshot.legs[0]!;
  f.snapshot.legs = [
    base,
    { ...base, id: 2, completion_status: "agent_transfer_declined", talk_time: 0 },
    { ...base, id: 3, completion_status: "agent_missed", talk_time: 0 },
    { ...base, id: 4, completion_status: "agent_unreachable", talk_time: 0 },
    { ...base, id: 5, type: "supervisor", talk_time: 20 },
    { ...base, id: 6, agent_id: 99, talk_time: 999 },
  ];
  const r = calculate(f);
  expect(r.values).toMatchObject({
    inbound_calls_offered: 4,
    inbound_calls_accepted: 1,
    declined_calls: 1,
    missed_calls: 1,
    inbound_calls_unreachable: 1,
    inbound_calls_answer_rate: 25,
    total_talk_time_inbound: 21,
  });
  expect(r.offeredLegIds).toEqual([1, 2, 3, 4]);
});
it("keeps SUM talk and MAX hold separate, including measured zeros and unreachable duration evidence", () => {
  const f = fixture(),
    base = f.snapshot.legs[0]!;
  f.snapshot.legs = [
    { ...base, talk_time: 30, hold_time: 10 },
    { ...base, id: 2, talk_time: 20, hold_time: 5 },
    { ...base, id: 3, completion_status: "agent_unreachable", talk_time: 2, hold_time: 0 },
  ];
  const r = calculate(f);
  expect(r.values).toMatchObject({ total_talk_time_inbound: 52, max_hold_time_inbound: 10 });
  expect(r.talk.sampleCount).toBe(3);
  expect(r.values).not.toHaveProperty("avg_talk_time_inbound");
});
it("keeps no-offer ratios and unobserved durations unavailable while preserving count zeros", () => {
  const f = fixture();
  f.snapshot.legs = [];
  expect(calculate(f).values).toMatchObject({
    inbound_calls_offered: 0,
    inbound_calls_accepted: 0,
    inbound_calls_answer_rate: null,
    total_talk_time_inbound: null,
    max_hold_time_inbound: null,
  });
  f.snapshot.legs = [{ ...fixture().snapshot.legs[0]!, talk_time: 0, hold_time: 0 }];
  expect(calculate(f).values).toMatchObject({
    inbound_calls_answer_rate: null,
    total_talk_time_inbound: 0,
    max_hold_time_inbound: 0,
  });
});
it("withholds incomplete totals, maxima and uncertain accepted counts instead of manufacturing zeros", () => {
  const f = fixture();
  f.snapshot.legs = [
    { ...f.snapshot.legs[0]!, talk_time: null, hold_time: 1 },
    { ...f.snapshot.legs[1]!, hold_time: null },
  ];
  const r = calculate(f);
  expect(r.values).toMatchObject({
    inbound_calls_offered: null,
    inbound_calls_accepted: null,
    inbound_calls_answer_rate: null,
    total_talk_time_inbound: null,
    max_hold_time_inbound: null,
    missed_calls: 0,
  });
  expect(r.uncertainAcceptedLegIds).toEqual([1]);
  expect(r.talk.missingLegIds).toEqual([1]);
});
it("counts an abandoned call once despite multiple participating legs without assigning responsibility", () => {
  const f = fixture();
  f.snapshot.calls[0]!.completion_status = "abandoned_on_hold";
  expect(calculate(f).values.inbound_calls_abandoned_on_hold).toBe(1);
});
it("uses Central call creation at the week boundary even when the leg starts in the next week", () => {
  const f = fixture();
  f.snapshot.calls = [
    {
      ...f.snapshot.calls[0]!,
      created_at: "2026-09-27T04:59:59Z",
      updated_at: "2026-09-27T05:01:00Z",
    },
  ];
  f.snapshot.legs = [
    {
      ...f.snapshot.legs[0]!,
      created_at: "2026-09-27T05:00:00Z",
      updated_at: "2026-09-27T05:01:00Z",
    },
  ];
  expect(calculate(f).values.inbound_calls_accepted).toBe(1);
  f.snapshot.calls[0]!.created_at = "2026-09-27T05:00:00Z";
  expect(calculate(f).values.inbound_calls_accepted).toBe(0);
});
it("rejects gaps, duplicates and source drift while keeping group and line filters explicit", () => {
  const f = fixture();
  f.snapshot.calls = [];
  expect(() => calculate(f)).toThrow("parent-call");
  const duplicate = fixture();
  duplicate.snapshot.legs.push(duplicate.snapshot.legs[0]!);
  expect(() => calculate(duplicate)).toThrow("Duplicate");
  const wrong = fixture();
  wrong.scope.phoneNumbers = ["different-line"];
  expect(calculate(wrong).values.inbound_calls_offered).toBe(0);
  expect(() =>
    calculateInboundReport([], [], {
      ...wrong.scope,
      offeredDefinition: "accepted-declined-missed",
    } as unknown as InboundReportScope)
  ).toThrow();
  expect(() =>
    calculateInboundReport([], [], { ...wrong.scope, periodStart: "2026-09-21" })
  ).toThrow("Sunday");
});
it("retains minimized replay evidence, exact ratio provenance and a stable source fingerprint", () => {
  const f = fixture(),
    record = build(f),
    facts = normalize(JSON.parse(JSON.stringify(record.payload)));
  expect(facts).toHaveLength(9);
  expect(facts.find((r) => r.factType === "inbound_calls_answer_rate")).toMatchObject({
    numericValue: 100,
    unit: "%",
    dimensionsJson: { numerator: 2, denominator: 2, publicationEligible: false },
  });
  expect(JSON.stringify(record.payload)).not.toContain('"ticket_id"');
  expect(JSON.stringify(record.payload)).not.toContain('"agent_id":99');
  const reordered = fixture();
  reordered.inboundPolicy.groupIds = [8, 7];
  const reorderedAgain = fixture();
  reorderedAgain.inboundPolicy.groupIds = [7, 8];
  expect(normalize(build(reordered).payload)[0]!.dimensionsJson!.sourceScopeFingerprint).toBe(
    normalize(build(reorderedAgain).payload)[0]!.dimensionsJson!.sourceScopeFingerprint
  );
});
it("rejects injected totals, foreign employee evidence and changed identity on replay", () => {
  const record = build();
  const altered = structuredClone(record.payload);
  (altered.sourceEvidence as Record<string, unknown>).numericValue = 999;
  expect(() => normalize(altered)).toThrow();
  const foreign = structuredClone(record.payload);
  (foreign.sourceEvidence as { legs: Array<{ agent_id: number }> }).legs[0]!.agent_id = 99;
  expect(() => normalize(foreign)).toThrow("Foreign");
  const f = fixture();
  expect(() =>
    normalizeInboundReportRecord(
      record.payload,
      "different",
      f.identity.teamId,
      f.periodStart,
      f.periodEnd
    )
  ).toThrow("changed");
});
it("requires explicit allowed keys, a prospective cutover, ownership and complete fresh streams", () => {
  const f = fixture();
  f.inboundPolicy.effectivePeriodStart = "2026-09-27";
  expect(() => build(f)).toThrow("cutover");
  const wrong = fixture();
  wrong.config.organizationId = "00000000-0000-4000-8000-000000000099";
  expect(() => build(wrong)).toThrow("policy mismatch");
  const partial = fixture();
  partial.snapshot.legsState.cursor.status = "pending";
  expect(() => build(partial)).toThrow("exhausted");
  const stale = fixture();
  stale.now = new Date("2026-09-26T12:10:00Z");
  expect(() => build(stale)).toThrow("stale");
  expect(() =>
    parseInboundReportPolicy({ ...fixture().inboundPolicy, metricKeys: ["avg_talk_time_inbound"] })
  ).toThrow();
  const subset = fixture();
  subset.inboundPolicy.metricKeys = ["inbound_calls_offered"];
  expect(normalize(build(subset).payload).map((fact) => fact.factType)).toEqual([
    "inbound_calls_offered",
  ]);
});
