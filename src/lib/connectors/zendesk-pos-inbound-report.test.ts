import { describe, expect, it } from "vitest";
import {
  calculatePosInboundReport,
  preparePosInboundReport,
  type PosInboundScope,
} from "./zendesk-pos-inbound-report";
import { referencePosInboundReport } from "@/lib/domain/reconciliation/zendesk-pos-call-reference";

const scope: PosInboundScope = {
  periodStart: "2026-09-13",
  periodEnd: "2026-09-19",
  timeZone: "America/Chicago",
  agentId: 10,
  groupIds: [20],
  phoneNumbers: null,
  dateBasis: "leg-created",
};
const call = (id: number, patch = {}) => ({
  id,
  created_at: "2026-09-12T12:00:00Z",
  updated_at: "2026-09-21T12:00:00Z",
  direction: "inbound",
  call_group_id: 20,
  phone_number: null,
  ticket_id: null,
  completion_status: "completed",
  hold_time: 30,
  talk_time: 60,
  voicemail: false,
  ...patch,
});
const leg = (id: number, patch = {}) => ({
  id,
  call_id: 1,
  agent_id: 10,
  type: "agent",
  completion_status: "completed",
  created_at: "2026-09-14T12:00:00Z",
  updated_at: "2026-09-21T12:00:00Z",
  talk_time: 60,
  hold_time: 2,
  duration: 90,
  consultation_time: null,
  ...patch,
});

describe("POS inbound saved report candidate", () => {
  it("reuses a parsed capture without accepting later input mutation or sharing result arrays", () => {
    const calls = [call(1)];
    const legs = [leg(1), leg(2, { agent_id: 11 })];
    const calculate = preparePosInboundReport(calls, legs);
    calls[0]!.hold_time = 999;
    legs[0]!.talk_time = 999;
    const first = calculate(scope);
    expect(first.values.avg_hold_time_inbound).toBe(30);
    expect(first.values.avg_talk_time_inbound).toBe(60);
    first.selectedLegIds.push(999);
    expect(calculate(scope).selectedLegIds).toEqual([1]);
    expect(calculate({ ...scope, agentId: 11 }).selectedLegIds).toEqual([2]);
  });
  it("preserves repeated parent hold weighting, supervisor durations and null/zero samples", () => {
    const r = calculatePosInboundReport(
      [call(1, { hold_time: 90 }), call(2, { hold_time: 0 })],
      [
        leg(1),
        leg(2, { type: "supervisor", talk_time: 0, consultation_time: 0 }),
        leg(3, { call_id: 2, consultation_time: 7 }),
        leg(4, { completion_status: "agent_unreachable", talk_time: 900 }),
      ],
      scope
    );
    expect(r.selectedLegIds).toEqual([1, 2, 3]);
    expect(r.acceptedLegIds).toEqual([1, 3]);
    expect(r.values).toMatchObject({
      inbound_calls_accepted: 2,
      avg_talk_time_inbound: 40,
      avg_hold_time_inbound: 60,
      avg_consultation_time_inbound: 3.5,
    });
    expect(r.durations.callHoldWeightedByLeg).toMatchObject({
      sumSeconds: 180,
      sampleCount: 3,
      measuredLegIds: [1, 2, 3],
      zeroLegIds: [3],
    });
    expect(r.durations.consultation).toMatchObject({
      sampleCount: 2,
      cohortCount: 3,
      missingLegIds: [1],
      zeroLegIds: [2],
    });
  });
  it("uses Central leg dates including DST and parent calls outside the reporting period", () => {
    const r = calculatePosInboundReport(
      [call(1)],
      [
        leg(1, { created_at: "2026-09-13T04:59:59Z" }),
        leg(2, { created_at: "2026-09-13T05:00:00Z" }),
        leg(3, { created_at: "2026-09-20T04:59:59Z" }),
        leg(4, { created_at: "2026-09-20T05:00:00Z" }),
      ],
      scope
    );
    expect(r.selectedLegIds).toEqual([2, 3]);
    const dst = calculatePosInboundReport(
      [call(1)],
      [
        leg(1, { created_at: "2026-11-01T04:59:59Z", updated_at: "2026-11-10T00:00:00Z" }),
        leg(2, { created_at: "2026-11-01T05:00:00Z", updated_at: "2026-11-10T00:00:00Z" }),
        leg(3, { created_at: "2026-11-08T05:59:59Z", updated_at: "2026-11-10T00:00:00Z" }),
        leg(4, { created_at: "2026-11-08T06:00:00Z", updated_at: "2026-11-10T00:00:00Z" }),
      ],
      { ...scope, periodStart: "2026-11-01", periodEnd: "2026-11-07" }
    );
    expect(dst.selectedLegIds).toEqual([2, 3]);
  });
  it("keeps no eligible samples unavailable and refuses unknown acceptance", () => {
    const empty = calculatePosInboundReport([], [], scope);
    expect(empty.values.inbound_calls_accepted).toBe(0);
    expect(empty.values.avg_talk_time_inbound).toBeNull();
    const unknown = calculatePosInboundReport([call(1)], [leg(1, { talk_time: null })], scope);
    expect(unknown.values.inbound_calls_accepted).toBeNull();
    expect(unknown.uncertainAcceptedLegIds).toEqual([1]);
    expect(unknown.values.avg_consultation_time_inbound).toBeNull();
  });
  it("does not infer offered calls, answer rate, transfer measures or abandonment", () => {
    const r = calculatePosInboundReport(
      [call(1, { completion_status: "abandoned_in_queue" })],
      [
        leg(1, { completion_status: "agent_transfer_declined" }),
        leg(2, { completion_status: "agent_missed" }),
      ],
      scope
    );
    expect(r.values.declined_calls).toBe(1);
    expect(r.values.missed_calls).toBe(1);
    expect(Object.keys(r.values)).toHaveLength(7);
    expect(r.values).not.toHaveProperty("inbound_calls_offered");
    expect(r.values).not.toHaveProperty("inbound_calls_abandoned_on_hold");
  });
  it("respects parent group/line, direction, agent and leg type filters", () => {
    const r = calculatePosInboundReport(
      [
        call(1, { phone_number: "+15550000001" }),
        call(2, { direction: "outbound" }),
        call(3, { call_group_id: 21 }),
        call(4, { phone_number: "+15550000002" }),
      ],
      [
        leg(1),
        leg(2, { call_id: 2 }),
        leg(3, { call_id: 3 }),
        leg(4, { call_id: 4 }),
        leg(5, { agent_id: 11 }),
        leg(6, { type: "customer" }),
      ],
      { ...scope, phoneNumbers: ["+15550000001"] }
    );
    expect(r.selectedLegIds).toEqual([1]);
  });
  it("rejects missing parents, dropped hold projections, duplicates and invalid evidence", () => {
    expect(() => calculatePosInboundReport([], [leg(1)], scope)).toThrow(/parent-call/);
    expect(() =>
      calculatePosInboundReport([call(1, { hold_time: undefined })], [leg(1)], scope)
    ).toThrow();
    expect(() => calculatePosInboundReport([call(1)], [leg(1), leg(1)], scope)).toThrow(
      /Duplicate/
    );
    expect(() => calculatePosInboundReport([call(1), call(1)], [], scope)).toThrow(/Duplicate/);
    expect(() => calculatePosInboundReport([call(1)], [leg(1, { duration: -1 })], scope)).toThrow();
    expect(() =>
      calculatePosInboundReport([call(1)], [leg(1, { completion_status: "new" })], scope)
    ).toThrow();
    expect(() =>
      calculatePosInboundReport([call(1)], [leg(1, { updated_at: "2026-09-01T00:00:00Z" })], scope)
    ).toThrow(/chronology/);
    expect(() => calculatePosInboundReport([], [], { ...scope, groupIds: [20, 20] })).toThrow();
    expect(() =>
      calculatePosInboundReport([], [], {
        ...scope,
        dateBasis: "call-created",
      } as unknown as PosInboundScope)
    ).toThrow();
  });
  it("matches the independent report reference across mixed eligible outcomes", () => {
    const calls = [call(1), call(2, { hold_time: null })];
    const legs = [
      leg(1),
      leg(2, { type: "supervisor", talk_time: 0 }),
      leg(3, { call_id: 2, completion_status: "agent_declined" }),
      leg(4, { completion_status: "agent_missed", consultation_time: 8 }),
      leg(5, { completion_status: "agent_unreachable" }),
    ];
    const result = calculatePosInboundReport(calls, legs, scope);
    const reference = referencePosInboundReport(calls, legs, {
      startDay: scope.periodStart,
      endDay: scope.periodEnd,
      timeZone: scope.timeZone,
      agentId: scope.agentId,
      groupIds: scope.groupIds,
      phoneNumbers: scope.phoneNumbers,
    });
    for (const key of [
      "selectedLegIds",
      "participatingCallIds",
      "acceptedLegIds",
      "declinedLegIds",
      "missedLegIds",
    ] as const)
      expect(result[key]).toEqual(reference[key]);
    for (const key of ["talk", "callHoldWeightedByLeg", "duration", "consultation"] as const) {
      expect(result.durations[key]).toMatchObject({
        sumSeconds: reference[key].numerator,
        sampleCount: reference[key].denominator,
        meanSeconds: reference[key].meanSeconds,
      });
    }
  });
});
