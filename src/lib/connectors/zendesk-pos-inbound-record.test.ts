// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  buildPosInboundRecord,
  normalizePosInboundRecord,
  replayPosInboundRecord,
  type PosInboundPolicy,
} from "./zendesk-pos-inbound-record";
import { posInboundReportKeys } from "./zendesk-pos-inbound-report";
import { initialTalkCursor } from "./zendesk-talk-cursor";

const organizationId = "10000000-0000-4000-8000-000000000001";
const dataSourceId = "10000000-0000-4000-8000-000000000002";
const teamId = "10000000-0000-4000-8000-000000000003";
const employeeId = "10000000-0000-4000-8000-000000000004";
const accountReference = "zendesk-account:synthetic";
const bootstrapStart = Date.parse("2026-09-12T00:00:00Z") / 1000;
const now = new Date("2026-09-20T05:10:00Z");
const policy: PosInboundPolicy = {
  schemaVersion: 1,
  organizationId,
  dataSourceId,
  teamId,
  accountReference,
  effectivePeriodStart: "2026-09-13",
  timeZone: "America/Chicago",
  groupIds: [20],
  phoneNumbers: null,
  dateBasis: "leg-created",
  metricKeys: [...posInboundReportKeys],
  observationLimits: { maxAgeMs: 900000, maxSpanMs: 600000 },
};
const identity = { employeeId, teamId, externalId: "synthetic@example.test", agentId: 10 };
const start = "2026-09-13",
  end = "2026-09-19";
const state = (resource: "calls" | "legs") => ({
  accountReference,
  bootstrapStart,
  cycle: 2,
  observationStartedAt: "2026-09-20T05:00:00Z",
  lastPageAt: "2026-09-20T05:05:00Z",
  cursor: {
    ...initialTalkCursor("https://synthetic.zendesk.com", resource, bootstrapStart),
    pages: 1,
    visited: ["a".repeat(64)],
    status: "exhausted" as const,
  },
});
const call = (id: number) => ({
  id,
  created_at: "2026-09-14T12:00:00Z",
  updated_at: "2026-09-14T12:05:00Z",
  direction: "inbound" as const,
  completion_status: "completed" as const,
  call_group_id: 20,
  phone_number: null,
  hold_time: 30,
  talk_time: 60,
  ticket_id: null,
  voicemail: false,
});
const leg = (id: number, agent_id = 10) => ({
  id,
  call_id: 1,
  agent_id,
  type: "agent" as const,
  completion_status: "completed" as const,
  created_at: "2026-09-14T12:00:00Z",
  updated_at: "2026-09-14T12:05:00Z",
  talk_time: 60,
  hold_time: 2,
  duration: 90,
  consultation_time: null,
});
const snapshot = () => ({
  accountReference,
  bootstrapStart,
  callsState: state("calls"),
  legsState: state("legs"),
  missingParentCallIds: [],
  calls: [call(1), call(2)],
  legs: [leg(1), leg(2, 11)],
});
const build = (s = snapshot(), p = policy, at = now, from = start, to = end) =>
  buildPosInboundRecord(s, p, { organizationId, dataSourceId }, identity, from, to, at);
const facts = (payload: unknown) =>
  normalizePosInboundRecord(payload, employeeId, teamId, start, end);

describe("POS replay records", () => {
  it("minimizes employee evidence and retains whole-call weighting, denominator and unavailable samples", () => {
    const record = build();
    const replay = replayPosInboundRecord(record.payload, start, end);
    expect(replay.sourceEvidence.calls.map((c) => c.id)).toEqual([1]);
    expect(replay.sourceEvidence.legs.map((l) => l.id)).toEqual([1]);
    expect(replay.coverageMode).toBe("closed-week-observation");
    const rows = facts(record.payload);
    expect(rows).toHaveLength(7);
    expect(rows.find((f) => f.factType === "avg_hold_time_inbound")).toMatchObject({
      numericValue: 30,
      unit: "s",
      dimensionsJson: {
        sumSeconds: 30,
        sampleCount: 1,
        cohortCount: 1,
        durationBasis: "whole-call-hold-weighted-per-selected-leg",
        publicationEligible: false,
      },
    });
    expect(rows.find((f) => f.factType === "avg_consultation_time_inbound")).toMatchObject({
      numericValue: null,
      dimensionsJson: { sampleCount: 0, cohortCount: 1, missingLegIds: [1] },
    });
    expect(rows.find((f) => f.factType === "missed_calls")?.numericValue).toBe(0);
  });
  it("rejects a closed-week capture begun before local midnight even if terminal pages finished later", () => {
    for (const resource of ["callsState", "legsState"] as const) {
      const source = snapshot();
      source[resource].observationStartedAt = "2026-09-20T04:59:59Z";
      expect(() => build(source)).toThrow("after period end");
    }
  });
  it("keeps current-week progress distinct and rejects future weeks and stale observations", () => {
    const source = snapshot();
    for (const state of [source.callsState, source.legsState]) {
      state.observationStartedAt = "2026-09-19T05:00:00Z";
      state.lastPageAt = "2026-09-19T05:05:00Z";
    }
    const record = build(source, policy, new Date("2026-09-19T05:10:00Z"));
    expect(replayPosInboundRecord(record.payload, start, end).coverageMode).toBe("in-progress");
    expect(() => build(source)).toThrow("stale");
    expect(() =>
      build(source, policy, new Date("2026-09-19T05:10:00Z"), "2026-09-20", "2026-09-26")
    ).toThrow("not been observed");
  });
  it("retains verified zero counts and null durations for an empty complete cohort", () => {
    const source = snapshot();
    source.calls = [];
    source.legs = [];
    const rows = facts(build(source).payload);
    expect(rows.slice(0, 3).map((r) => r.numericValue)).toEqual([0, 0, 0]);
    expect(rows.slice(3).map((r) => r.numericValue)).toEqual([null, null, null, null]);
  });
  it("replays coverage at the saved observation and rejects scope, identity, dates and foreign evidence", () => {
    const payload = build().payload;
    expect(() => normalizePosInboundRecord(payload, organizationId, teamId, start, end)).toThrow(
      "changed"
    );
    expect(() => facts({ ...payload, numericValue: 123 })).toThrow();
    const edits = [
      (p: ReturnType<typeof replayPosInboundRecord>) => {
        p.sourceEvidence.scope.groupIds = [99];
      },
      (p: ReturnType<typeof replayPosInboundRecord>) => {
        p.sourceEvidence.calls.push(call(99));
      },
      (p: ReturnType<typeof replayPosInboundRecord>) => {
        p.sourceEvidence.callsObservation.startedAt = "2026-09-20T04:59:59Z";
      },
      (p: ReturnType<typeof replayPosInboundRecord>) => {
        p.sourceEvidence.legsObservation.endedAt = "2026-09-21T00:00:00Z";
      },
    ];
    for (const edit of edits) {
      const p = structuredClone(payload) as ReturnType<typeof replayPosInboundRecord>;
      edit(p);
      expect(() => facts(p)).toThrow();
    }
    expect(() => build(snapshot(), { ...policy, effectivePeriodStart: "2026-09-20" })).toThrow(
      "prospective"
    );
    expect(() => build(snapshot(), policy, now, start, "2026-09-20")).toThrow("week policy");
  });
  it("rejects pending streams, another account, missing parents and missing whole-call hold", () => {
    const pending = snapshot();
    Object.assign(pending.legsState.cursor, { status: "pending" });
    expect(() => build(pending)).toThrow("exhausted");
    const wrong = snapshot();
    wrong.accountReference = "zendesk-account:other";
    expect(() => build(wrong)).toThrow("account");
    const orphan = snapshot();
    orphan.calls = [];
    expect(() => build(orphan)).toThrow("parent-call");
    const noHold = snapshot();
    Object.assign(noHold.calls[0]!, { hold_time: undefined });
    expect(() => build(noHold)).toThrow("source evidence");
    expect(() => build(snapshot(), { ...policy, organizationId: employeeId })).toThrow("mismatch");
  });
  it("handles the autumn DST boundary without using a fixed UTC offset", () => {
    const source = snapshot();
    source.calls = [];
    source.legs = [];
    for (const state of [source.callsState, source.legsState]) {
      state.observationStartedAt = "2026-11-08T06:00:00Z";
      state.lastPageAt = "2026-11-08T06:05:00Z";
    }
    const at = new Date("2026-11-08T06:10:00Z");
    expect(() => build(source, policy, at, "2026-11-01", "2026-11-07")).not.toThrow();
    source.legsState.observationStartedAt = "2026-11-08T05:59:59Z";
    expect(() => build(source, policy, at, "2026-11-01", "2026-11-07")).toThrow("after period end");
  });
});
