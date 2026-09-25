// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  calculateTalkParticipation,
  type ParticipationCall,
  type ParticipationLeg,
  type TalkParticipationScope,
} from "./zendesk-talk-participation";

const call = (id: number, overrides: Partial<ParticipationCall> = {}): ParticipationCall => ({
  id,
  created_at: "2026-09-14T12:00:00Z",
  updated_at: "2026-09-14T13:00:00Z",
  call_group_id: 10,
  phone_number: "synthetic-line",
  direction: "inbound",
  completion_status: "completed",
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
const scope: TalkParticipationScope = {
  periodStart: "2026-09-13",
  periodEnd: "2026-09-19",
  timeZone: "America/Chicago",
  dateBasis: "call-created",
  agentId: 42,
  groupIds: [10],
  phoneNumbers: ["synthetic-line"],
};

describe("Talk participation qualification candidate", () => {
  it("credits both transfer participants and retains repeated agent legs without double-counting calls", () => {
    const calls = [call(1)];
    const legs = [leg(1), leg(2, { agent_id: 43, talk_time: 30 }), leg(3, { talk_time: 20 })];
    const first = calculateTalkParticipation(calls, legs, scope).inbound;
    const second = calculateTalkParticipation(calls, legs, { ...scope, agentId: 43 }).inbound;
    expect(first.acceptedLegIds).toEqual([1, 3]);
    expect(first.participatingCallIds).toEqual([1]);
    expect(first.durations.talk).toMatchObject({ sumSeconds: 30, sampleCount: 2, meanSeconds: 15 });
    expect(second.acceptedLegIds).toEqual([2]);
    expect(second.durations.talk.meanSeconds).toBe(30);
  });

  it("keeps report offered subtotal separate from unreachable and zero-talk completed legs", () => {
    const result = calculateTalkParticipation(
      [call(1)],
      [
        leg(1),
        leg(2, { completion_status: "agent_missed", talk_time: 0 }),
        leg(3, { completion_status: "agent_transfer_declined", talk_time: 0 }),
        leg(4, { completion_status: "agent_unreachable", talk_time: 0 }),
        leg(5, { talk_time: 0 }),
        leg(6, { type: "supervisor" }),
      ],
      scope
    ).inbound;
    expect(result.reportOfferedLegIds).toEqual([1, 2, 3]);
    expect(result.otherAgentLegIds).toEqual([4, 5]);
    expect(result.unreachableLegIds).toEqual([4]);
    expect(result.supervisorLegIds).toEqual([6]);
    expect(result.durations.talk.cohortLegIds).toEqual([1, 2, 3, 5, 6]);
    expect(result.durations.talk.zeroLegIds).toEqual([2, 3, 5]);
  });

  it("preserves zero, missing and fractional means independently for each duration", () => {
    const result = calculateTalkParticipation(
      [call(1)],
      [
        leg(1, { hold_time: 0, consultation_time: null }),
        leg(2, { hold_time: 2, consultation_time: 0 }),
        leg(3, { hold_time: 0, consultation_time: 3 }),
        leg(4, { hold_time: null, consultation_time: null }),
      ],
      scope
    ).inbound;
    expect(result.durations.hold).toMatchObject({
      sumSeconds: 2,
      sampleCount: 3,
      meanSeconds: 2 / 3,
      missingLegIds: [4],
    });
    expect(result.durations.consultation).toMatchObject({
      sumSeconds: 3,
      sampleCount: 2,
      meanSeconds: 1.5,
      missingLegIds: [1, 4],
    });
    expect(calculateTalkParticipation([], [], scope).inbound.durations.talk.meanSeconds).toBeNull();
  });

  it("keeps Central call-date and leg-date cohorts distinct at the week boundary", () => {
    const calls = [call(1, { created_at: "2026-09-13T04:59:59Z" })];
    const legs = [leg(1, { created_at: "2026-09-13T05:00:00Z" })];
    expect(calculateTalkParticipation(calls, legs, scope).inbound.selectedLegIds).toEqual([]);
    expect(
      calculateTalkParticipation(calls, legs, { ...scope, dateBasis: "leg-created" }).inbound
        .selectedLegIds
    ).toEqual([1]);
    const fall = { ...scope, periodStart: "2026-11-01", periodEnd: "2026-11-07" };
    const fallCalls = [
      call(1, { created_at: "2026-11-01T05:00:00Z", updated_at: "2026-11-08T06:00:00Z" }),
    ];
    const fallLegs = [
      leg(1, { created_at: "2026-11-08T05:59:59Z", updated_at: "2026-11-08T06:00:00Z" }),
    ];
    expect(
      calculateTalkParticipation(fallCalls, fallLegs, { ...fall, dateBasis: "leg-created" }).inbound
        .selectedLegIds
    ).toEqual([1]);
  });

  it("does not mistake customer abandonment or outbound completed status for agent fault or customer answer", () => {
    const result = calculateTalkParticipation(
      [
        call(1, { completion_status: "abandoned_in_queue" }),
        call(2, { completion_status: "abandoned_on_hold" }),
        call(3, { direction: "outbound" }),
      ],
      [leg(1), leg(2, { call_id: 2 }), leg(3, { call_id: 3, talk_time: 0 })],
      scope
    );
    expect(result.inbound.abandonedOnHoldParticipatingCallIds).toEqual([2]);
    expect(result.outbound.completedParticipatingCallIds).toEqual([3]);
    expect(result.outbound.acceptedLegIds).toEqual([]);
    expect(result.outbound).not.toHaveProperty("nonAnswered");
  });

  it("rejects partial joins, duplicates and invalid duration evidence rather than fabricating values", () => {
    expect(() => calculateTalkParticipation([], [leg(1)], scope)).toThrow("parent-call coverage");
    expect(() => calculateTalkParticipation([call(1)], [leg(1), leg(1)], scope)).toThrow(
      "Duplicate"
    );
    expect(() => calculateTalkParticipation([call(1), call(1)], [], scope)).toThrow("Duplicate");
    expect(() => calculateTalkParticipation([call(1)], [leg(1, { hold_time: -1 })], scope)).toThrow(
      "Invalid"
    );
  });
});
