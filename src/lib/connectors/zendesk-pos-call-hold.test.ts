import { describe, expect, it } from "vitest";
import { joinPosCallHoldEvidence } from "./zendesk-pos-call-hold";

const call = {
  id: 1,
  created_at: "2026-10-04T12:00:00Z",
  updated_at: "2026-10-04T12:30:00Z",
  direction: "inbound",
  call_group_id: 7,
  phone_number: "synthetic-line",
  completion_status: "completed",
  ticket_id: null,
  talk_time: 60,
  voicemail: false,
};
describe("inactive POS whole-call hold projection join", () => {
  it("preserves measured zero and explicit null without mutating participation records", () => {
    const input = [call, { ...call, id: 2 }];
    const before = structuredClone(input);
    const result = joinPosCallHoldEvidence(input, [
      { ...call, hold_time: 0 },
      { ...call, id: 2, hold_time: null, customer_phone: "must-be-stripped" },
    ]);
    expect(result.blocked).toEqual([]);
    expect(result.calls.map((c) => c.hold_time)).toEqual([0, null]);
    expect(result.calls[1]).not.toHaveProperty("customer_phone");
    expect(input).toEqual(before);
  });
  it("blocks absent, older and newer source versions instead of substituting measurements", () => {
    for (const updated_at of ["2026-10-04T12:29:00Z", "2026-10-04T12:31:00Z"])
      expect(joinPosCallHoldEvidence([call], [{ ...call, updated_at, hold_time: 10 }])).toEqual({
        calls: [],
        blocked: [{ callId: 1, reason: "version-mismatch" }],
      });
    expect(joinPosCallHoldEvidence([call], [])).toEqual({
      calls: [],
      blocked: [{ callId: 1, reason: "missing" }],
    });
  });
  it("rejects an omitted or invalid hold measurement", () => {
    for (const hold_time of [undefined, -1, NaN, Infinity, "0"])
      expect(() => joinPosCallHoldEvidence([call], [{ ...call, hold_time }])).toThrow();
  });
  it("rejects contradictory common fields at the same source version", () => {
    for (const change of [{ talk_time: 61 }, { call_group_id: 8 }, { direction: "outbound" }])
      expect(() =>
        joinPosCallHoldEvidence([call], [{ ...call, ...change, hold_time: 10 }])
      ).toThrow("Conflicting");
  });
  it("rejects duplicate IDs in either projection", () => {
    const hold = { ...call, hold_time: 10 };
    expect(() => joinPosCallHoldEvidence([call, call], [hold])).toThrow("Duplicate");
    expect(() => joinPosCallHoldEvidence([call], [hold, hold])).toThrow("Duplicate");
  });
});
