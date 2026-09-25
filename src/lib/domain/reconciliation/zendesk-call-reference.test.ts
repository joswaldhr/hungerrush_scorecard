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
      participatingCallIds: [1],
      acceptedLegIds: [1, 2],
    });
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
