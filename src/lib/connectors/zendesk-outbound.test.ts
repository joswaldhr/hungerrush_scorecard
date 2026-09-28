// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  calculateOutboundParticipation,
  classifyOutboundCall,
  type OutboundCall,
  type OutboundScope,
} from "./zendesk-outbound";
import type { ParticipationLeg } from "./zendesk-talk-participation";
const call = (id: number, overrides: Partial<OutboundCall> = {}): OutboundCall => ({
  id,
  ticket_id: id,
  created_at: "2026-09-14T12:00:00Z",
  updated_at: "2026-09-14T13:00:00Z",
  direction: "outbound",
  completion_status: "completed",
  talk_time: 10,
  voicemail: false,
  call_group_id: 900,
  phone_number: null,
  ...overrides,
});
const leg = (id: number, overrides: Partial<ParticipationLeg> = {}): ParticipationLeg => ({
  id,
  call_id: 1,
  agent_id: 42,
  type: "agent",
  completion_status: "completed",
  created_at: "2026-09-14T12:00:00Z",
  updated_at: "2026-09-14T13:00:00Z",
  talk_time: 10,
  hold_time: 0,
  duration: 20,
  consultation_time: null,
  ...overrides,
});
const scope: OutboundScope = {
  periodStart: "2026-09-13",
  periodEnd: "2026-09-19",
  timeZone: "America/Chicago",
  agentId: 42,
  ticketGroupIds: [10],
};
describe("qualified outbound candidate", () => {
  it("withholds an employee result when a participating leg has no parent call", () => {
    expect(() => calculateOutboundParticipation([], [], [leg(1)], scope)).toThrow(
      "parent-call coverage"
    );
  });
  it("does not equate API-completed zero-talk calls with Explore completed outcomes", () => {
    expect(classifyOutboundCall(call(1, { talk_time: 0 }))).toBe("non-answered");
    expect(classifyOutboundCall(call(1, { completion_status: "failed", talk_time: null }))).toBe(
      "non-answered"
    );
    expect(classifyOutboundCall(call(1))).toBe("completed");
    expect(classifyOutboundCall(call(1, { completion_status: "abandoned_on_hold" }))).toBe(
      "abandoned-on-hold"
    );
  });
  it("does not guess when talk evidence is missing or contradicts the outcome", () => {
    for (const c of [
      call(1, { talk_time: null }),
      call(1, { talk_time: 0, voicemail: true }),
      call(1, { completion_status: "failed", talk_time: 10 }),
    ])
      expect(classifyOutboundCall(c)).toBe("unclassified");
    const result = calculateOutboundParticipation(
      [call(1, { talk_time: null })],
      [{ id: 1, group_id: 10 }],
      [leg(1)],
      scope
    );
    expect(result).toMatchObject({
      attempted: 1,
      completed: null,
      nonAnswered: null,
      unclassifiedCallIds: [1],
    });
  });
  it("scopes by linked ticket group and counts repeat participation once per employee-call", () => {
    const calls = [call(1), call(2, { call_group_id: 10 })],
      tickets = [
        { id: 1, group_id: 10 },
        { id: 2, group_id: 900 },
      ];
    const legs = [leg(1), leg(2), leg(3, { agent_id: 43 }), leg(4, { call_id: 2 })];
    const result = calculateOutboundParticipation(calls, tickets, legs, scope);
    expect(result.attemptedCallIds).toEqual([1]);
    expect(result.selectedLegIds).toEqual([1, 2]);
    expect(
      calculateOutboundParticipation(calls, tickets, legs, { ...scope, agentId: 43 })
        .attemptedCallIds
    ).toEqual([1]);
  });
  it("retains per-leg zero and missing duration denominators without rounding", () => {
    const result = calculateOutboundParticipation(
      [call(1)],
      [{ id: 1, group_id: 10 }],
      [leg(1, { hold_time: 2 }), leg(2), leg(3), leg(4, { hold_time: null })],
      scope
    );
    expect(result.hold).toMatchObject({
      sumSeconds: 2,
      sampleCount: 3,
      meanSeconds: 2 / 3,
      zeroLegIds: [2, 3],
      missingLegIds: [4],
    });
  });
  it("requires complete linked-ticket evidence and rejects duplicates", () => {
    expect(() => calculateOutboundParticipation([call(1)], [], [leg(1)], scope)).toThrow(
      "linked-ticket coverage"
    );
    expect(() =>
      calculateOutboundParticipation([call(1)], [{ id: 1, group_id: 10 }], [leg(1), leg(1)], scope)
    ).toThrow("Duplicate");
    expect(
      calculateOutboundParticipation([call(1, { ticket_id: null })], [], [leg(1)], scope).attempted
    ).toBe(0);
  });
  it("uses the Central call-creation cohort even when a leg starts in the next week", () => {
    const c = call(1, { created_at: "2026-09-20T04:59:59Z", updated_at: "2026-09-20T05:01:00Z" });
    const l = leg(1, { created_at: "2026-09-20T05:00:01Z", updated_at: "2026-09-20T05:01:00Z" });
    expect(
      calculateOutboundParticipation([c], [{ id: 1, group_id: 10 }], [l], scope).attempted
    ).toBe(1);
  });
});
