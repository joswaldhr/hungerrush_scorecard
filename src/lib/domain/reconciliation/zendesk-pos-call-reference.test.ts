import { describe, expect, it } from "vitest";
import {
  referencePosInboundReport,
  type PosReferenceCall,
  type PosReferenceLeg,
} from "./zendesk-pos-call-reference";
import type { CallReferenceScope } from "./zendesk-call-reference";

const scope: CallReferenceScope = {
  startDay: "2026-09-13",
  endDay: "2026-09-19",
  timeZone: "America/Chicago",
  groupIds: [20],
  phoneNumbers: null,
  agentId: 10,
};
const call = (id: number, patch: Partial<PosReferenceCall> = {}): PosReferenceCall => ({
  id,
  created_at: "2026-09-12T12:00:00Z",
  direction: "inbound",
  call_group_id: 20,
  phone_number: null,
  completion_status: "completed",
  hold_time: 30,
  ...patch,
});
const leg = (id: number, patch: Partial<PosReferenceLeg> = {}): PosReferenceLeg => ({
  id,
  call_id: 1,
  agent_id: 10,
  type: "agent",
  completion_status: "completed",
  created_at: "2026-09-14T12:00:00Z",
  talk_time: 60,
  hold_time: 2,
  duration: 90,
  consultation_time: null,
  ...patch,
});

describe("independent POS inbound report reference", () => {
  it("separates the mislabeled report formula from actual on-hold participation", () => {
    const r = referencePosInboundReport(
      [
        call(1, { completion_status: "abandoned_in_queue" }),
        call(2, { completion_status: "abandoned_on_hold" }),
      ],
      [leg(1), leg(2, { call_id: 2 })],
      scope
    );
    expect(r.reportIvrQueueVoicemailAbandonedCallIds).toEqual([1]);
    expect(r.actualOnHoldParticipatingCallIds).toEqual([2]);
  });
  it("retains repeated-call weighting while keeping employee leg hold separate", () => {
    const r = referencePosInboundReport(
      [call(1, { hold_time: 90 }), call(2, { hold_time: 0 })],
      [leg(1), leg(2), leg(3, { call_id: 2 })],
      scope
    );
    expect(r.callHoldWeightedByLeg).toEqual({
      numerator: 180,
      denominator: 3,
      missing: 0,
      meanSeconds: 60,
    });
    expect(r.legHold.meanSeconds).toBe(2);
    expect(r.participatingCallIds).toEqual([1, 2]);
    expect(r.acceptedLegIds).toEqual([1, 2, 3]);
  });
  it("includes supervisor duration but excludes it from built-in agent acceptance", () => {
    const r = referencePosInboundReport(
      [call(1)],
      [
        leg(1, { type: "supervisor", talk_time: 0 }),
        leg(2),
        leg(3, { completion_status: "agent_unreachable", talk_time: 900 }),
      ],
      scope
    );
    expect(r.acceptedLegIds).toEqual([2]);
    expect(r.selectedLegIds).toEqual([1, 2]);
    expect(r.talk).toMatchObject({ numerator: 60, denominator: 2, meanSeconds: 30 });
  });
  it("uses Central leg-date boundaries even when the parent call predates the week", () => {
    const r = referencePosInboundReport(
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
  });
  it("does not turn missing consultation into zero or include it in the mean", () => {
    const r = referencePosInboundReport(
      [call(1)],
      [leg(1), leg(2, { consultation_time: 0 }), leg(3, { consultation_time: 7 })],
      scope
    );
    expect(r.consultation).toEqual({ numerator: 7, denominator: 2, missing: 1, meanSeconds: 3.5 });
    expect(
      referencePosInboundReport([call(1)], [leg(1)], scope).consultation.meanSeconds
    ).toBeNull();
  });
  it("fails incomplete joins, duplicates, unknown statuses and invalid durations", () => {
    expect(() => referencePosInboundReport([], [leg(1)], scope)).toThrow(/join/);
    expect(() => referencePosInboundReport([call(1), call(1)], [], scope)).toThrow(/duplicate/);
    expect(() => referencePosInboundReport([call(1)], [leg(1), leg(1)], scope)).toThrow(
      /duplicate/
    );
    expect(() =>
      referencePosInboundReport([call(1)], [leg(1, { completion_status: "new_status" })], scope)
    ).toThrow(/status/);
    expect(() => referencePosInboundReport([call(1)], [leg(1, { talk_time: -1 })], scope)).toThrow(
      /duration/
    );
  });
  it("respects explicit scope exclusions and transfer declines", () => {
    const r = referencePosInboundReport(
      [call(1), call(2, { direction: "outbound" }), call(3, { call_group_id: 21 })],
      [
        leg(1, { completion_status: "agent_transfer_declined" }),
        leg(2, { call_id: 2 }),
        leg(3, { call_id: 3 }),
        leg(4, { agent_id: 11 }),
      ],
      scope
    );
    expect(r.declinedLegIds).toEqual([1]);
    expect(r.selectedLegIds).toEqual([1]);
    expect(
      referencePosInboundReport([call(1)], [leg(1)], { ...scope, groupIds: [] }).selectedLegIds
    ).toEqual([]);
  });
});
