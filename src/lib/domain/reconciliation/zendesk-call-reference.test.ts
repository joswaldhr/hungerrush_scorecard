import { describe, expect, it } from "vitest";
import {
  referenceInboundCalls,
  type ReferenceCall,
  type ReferenceLeg,
  type CallReferenceScope,
} from "./zendesk-call-reference";

const scope: CallReferenceScope = {
  startDay: "2026-09-13",
  endDay: "2026-09-19",
  timeZone: "America/Chicago",
  groupIds: [20],
  phoneNumbers: ["support-line"],
  agentId: 10,
};
const call = (id: number, overrides: Partial<ReferenceCall> = {}): ReferenceCall => ({
  id,
  created_at: "2026-09-14T12:00:00Z",
  direction: "inbound",
  call_group_id: 20,
  phone_number: "support-line",
  completion_status: "completed",
  ...overrides,
});
const leg = (id: number, overrides: Partial<ReferenceLeg> = {}): ReferenceLeg => ({
  id,
  call_id: 1,
  agent_id: 10,
  type: "agent",
  completion_status: "completed",
  talk_time: 60,
  hold_time: 0,
  ...overrides,
});

describe("independent inbound report reference", () => {
  it("keeps a named supervisor's participation separate from accepted agent legs", () => {
    expect(
      referenceInboundCalls([call(1)], [leg(1, { type: "supervisor", talk_time: 10 })], scope)
    ).toMatchObject({ accepted: 0, offered: 0, participatingCallIds: [1], talkSeconds: 10 });
  });
  it("keeps repeated offers and accepted legs distinct from whole calls", () => {
    const r = referenceInboundCalls(
      [call(1)],
      [
        leg(1),
        leg(2),
        leg(3, { completion_status: "agent_missed" }),
        leg(4, { completion_status: "agent_transfer_declined" }),
        leg(5, { completion_status: "agent_declined" }),
        leg(6, { completion_status: "agent_unreachable" }),
        leg(7, { talk_time: 0 }),
        leg(8, { agent_id: 11 }),
      ],
      scope
    );
    expect(r).toMatchObject({
      accepted: 2,
      declined: 2,
      missed: 1,
      offered: 5,
      offeredDefinition: "accepted-declined-missed",
      offeredLegIds: [1, 2, 3, 4, 5],
      unreachableLegIds: [6],
      participatingCallIds: [1],
      acceptedLegIds: [1, 2],
    });
  });
  it("includes unreachable agent attempts only for the explicit four-component report", () => {
    const calls = [
      call(1),
      call(2, { call_group_id: 21 }),
      call(3, { phone_number: "other-line" }),
      call(4, { created_at: "2026-09-20T05:00:00Z" }),
      call(5, { direction: "outbound" }),
    ];
    const legs = [
      leg(1, { talk_time: 30, hold_time: 8 }),
      leg(2, { completion_status: "agent_declined", talk_time: 0 }),
      leg(3, { completion_status: "agent_transfer_declined", talk_time: 0 }),
      leg(4, { completion_status: "agent_missed", talk_time: 0 }),
      leg(5, { completion_status: "agent_unreachable", talk_time: 0 }),
      leg(6, { completion_status: "agent_unreachable", talk_time: 0 }),
      leg(7, { type: "supervisor", completion_status: "agent_unreachable", talk_time: 0 }),
      leg(8, { agent_id: 11, completion_status: "agent_unreachable" }),
      ...[2, 3, 4, 5].map((id) =>
        leg(10 + id, { call_id: id, completion_status: "agent_unreachable" })
      ),
    ];
    const previous = referenceInboundCalls(calls, legs, scope);
    const current = referenceInboundCalls(calls, legs, {
      ...scope,
      offeredDefinition: "accepted-declined-missed-unreachable",
    });
    expect(previous.offeredLegIds).toEqual([1, 2, 3, 4]);
    expect(current).toMatchObject({
      offeredDefinition: "accepted-declined-missed-unreachable",
      accepted: 1,
      declined: 2,
      missed: 1,
      unreachable: 2,
      offered: 6,
      offeredLegIds: [1, 2, 3, 4, 5, 6],
      unreachableLegIds: [5, 6],
      participatingCallIds: [1],
      talkSeconds: 30,
      maxHoldSeconds: 8,
    });
    // Changing the count definition must not change the SUM/MAX report population.
    expect(current.selectedLegIds).toEqual(previous.selectedLegIds);
    expect(current.talkSeconds).toBe(previous.talkSeconds);
    expect(current.maxHoldSeconds).toBe(previous.maxHoldSeconds);
  });
  it("rejects unknown report definitions instead of silently using the older subtotal", () => {
    expect(() =>
      referenceInboundCalls([], [], {
        ...scope,
        offeredDefinition: "all-attempts" as CallReferenceScope["offeredDefinition"],
      })
    ).toThrow("Invalid call reference offered definition");
  });
  it("uses call creation in Central time, groups and lines", () => {
    const calls = [
      call(1, { created_at: "2026-09-13T04:59:59Z" }),
      call(2, { created_at: "2026-09-13T05:00:00Z" }),
      call(3, { created_at: "2026-09-20T04:59:59Z" }),
      call(4, { created_at: "2026-09-20T05:00:00Z" }),
      call(5, { direction: "outbound" }),
      call(6, { call_group_id: 21 }),
      call(7, { phone_number: "other-line" }),
    ];
    expect(
      referenceInboundCalls(
        calls,
        calls.map((c) => leg(c.id, { call_id: c.id })),
        scope
      ).acceptedLegIds
    ).toEqual([2, 3]);
  });
  it("applies a status selection to the entire report, including durations and participation", () => {
    const result = referenceInboundCalls(
      [call(1), call(2, { completion_status: "abandoned_on_hold" })],
      [
        leg(1, { talk_time: 10, hold_time: 2 }),
        leg(2, { type: "supervisor", talk_time: 20, hold_time: 5 }),
        leg(3, {
          call_id: 2,
          completion_status: "agent_unreachable",
          talk_time: 100,
          hold_time: 99,
        }),
        leg(4, { call_id: 2, completion_status: "agent_missed", talk_time: 40, hold_time: 8 }),
      ],
      {
        ...scope,
        offeredDefinition: "accepted-declined-missed-unreachable",
        legCompletionStatuses: ["completed"],
      }
    );
    expect(result).toMatchObject({
      legCompletionStatuses: ["completed"],
      selectedLegIds: [1, 2],
      offeredLegIds: [1],
      unreachableLegIds: [],
      missedLegIds: [],
      participatingCallIds: [1],
      abandonedParticipatingCallIds: [],
      talkSeconds: 30,
      maxHoldSeconds: 5,
    });
  });
  it("distinguishes an explicit empty status selection from unfiltered legacy input", () => {
    const calls = [call(1)],
      legs = [leg(1)];
    expect(referenceInboundCalls(calls, legs, scope).selectedLegIds).toEqual([1]);
    expect(referenceInboundCalls(calls, legs, { ...scope, legCompletionStatuses: null })).toEqual(
      referenceInboundCalls(calls, legs, scope)
    );
    expect(
      referenceInboundCalls(calls, legs, { ...scope, legCompletionStatuses: [] })
    ).toMatchObject({
      legCompletionStatuses: [],
      selectedLegIds: [],
      offered: 0,
      talkSeconds: null,
      maxHoldSeconds: null,
    });
  });
  it("rejects unknown or duplicate selected statuses before calculating a result", () => {
    for (const statuses of [["completed", "completed"], ["unknown"]])
      expect(() =>
        referenceInboundCalls([], [], { ...scope, legCompletionStatuses: statuses })
      ).toThrow("Invalid call reference leg status filter");
  });
  it("sums agent segment talk and takes maximum hold without charging the other agent", () => {
    expect(
      referenceInboundCalls(
        [call(1)],
        [
          leg(1, { talk_time: 0, hold_time: 0 }),
          leg(2, { talk_time: 40, hold_time: 5 }),
          leg(3, { talk_time: 20, hold_time: 3 }),
          leg(4, { agent_id: 11, talk_time: 999, hold_time: 999 }),
        ],
        scope
      )
    ).toMatchObject({ talkSeconds: 60, maxHoldSeconds: 5, missingTalk: 0, missingHold: 0 });
  });
  it("retains missing durations and keeps call abandonment separate from agent responsibility", () => {
    const r = referenceInboundCalls(
      [call(1, { completion_status: "abandoned_on_hold" })],
      [
        leg(1, { completion_status: "agent_missed", talk_time: null, hold_time: null }),
        leg(2, { talk_time: null, hold_time: null }),
      ],
      scope
    );
    expect(r).toMatchObject({
      talkSeconds: null,
      maxHoldSeconds: null,
      missingTalk: 2,
      missingHold: 2,
      abandonedParticipatingCallIds: [1],
    });
  });
  it("rejects duplicate records and missing joins instead of guessing", () => {
    expect(() => referenceInboundCalls([call(1), call(1)], [], scope)).toThrow("duplicate call");
    expect(() => referenceInboundCalls([call(1)], [leg(1), leg(1)], scope)).toThrow(
      "duplicate leg"
    );
    expect(() => referenceInboundCalls([], [leg(1)], scope)).toThrow("Incomplete call join");
  });
  it("rejects invalid durations and unknown relevant statuses", () => {
    expect(() => referenceInboundCalls([call(1)], [leg(1, { talk_time: -1 })], scope)).toThrow(
      "Invalid leg duration"
    );
    expect(() =>
      referenceInboundCalls([call(1)], [leg(1, { completion_status: "new_status" })], scope)
    ).toThrow("Unknown agent leg status");
  });
});
