// @vitest-environment node
import { expect, it } from "vitest";
import { initialTalkCursor } from "./zendesk-talk-cursor";
import { prepareTalkParticipationObservation } from "./zendesk-talk-observation";
import type { TalkParticipationScope } from "./zendesk-talk-participation";
const accountReference = "zendesk-account:synthetic",
  origin = "https://synthetic.zendesk.com";
const bootstrapStart = Date.parse("2026-09-19T00:00:00Z") / 1000;
const now = new Date("2026-09-25T12:10:00Z"),
  limits = { maxAgeMs: 900000, maxSpanMs: 600000 };
const scope: TalkParticipationScope = {
  periodStart: "2026-09-20",
  periodEnd: "2026-09-26",
  timeZone: "America/Chicago",
  dateBasis: "call-created",
  agentId: 42,
  groupIds: [7],
  phoneNumbers: null,
};
const state = (resource: "calls" | "legs") => ({
  accountReference,
  bootstrapStart,
  cycle: 2,
  observationStartedAt: "2026-09-25T12:00:00Z",
  lastPageAt: "2026-09-25T12:05:00Z",
  cursor: {
    ...initialTalkCursor(origin, resource, bootstrapStart),
    pages: 1,
    visited: ["a".repeat(64)],
    status: "exhausted" as const,
  },
});
const snapshot = () => ({
  accountReference,
  bootstrapStart,
  callsState: state("calls"),
  legsState: state("legs"),
  missingParentCallIds: [],
  calls: [
    {
      id: 1,
      created_at: "2026-09-21T12:00:00Z",
      updated_at: "2026-09-21T13:00:00Z",
      direction: "inbound" as const,
      completion_status: "completed" as const,
      call_group_id: 7,
      phone_number: null,
      ticket_id: 1,
      talk_time: 30,
      voicemail: false,
    },
  ],
  legs: [
    {
      id: 2,
      call_id: 1,
      agent_id: 42,
      type: "agent" as const,
      completion_status: "completed" as const,
      created_at: "2026-09-21T12:00:00Z",
      updated_at: "2026-09-21T13:00:00Z",
      talk_time: 30,
      hold_time: 0,
      duration: 40,
      consultation_time: null,
    },
  ],
});
it("retains the observation window and source sets without claiming an atomic or independently certified result", () => {
  const result = prepareTalkParticipationObservation(
    snapshot(),
    accountReference,
    scope,
    limits,
    now
  );
  expect(result.result.inbound.acceptedLegIds).toEqual([2]);
  expect(result.result.inbound.durations.hold).toMatchObject({ meanSeconds: 0, sampleCount: 1 });
  expect(result.provenance).toMatchObject({
    sourceIsAtomicSnapshot: false,
    independentMetricQualificationComplete: false,
    callCycle: 2,
    legCycle: 2,
  });
});
it("withholds stale or widely separated stream observations", () => {
  const stale = snapshot();
  stale.callsState.lastPageAt = "2026-09-25T11:40:00Z";
  stale.callsState.observationStartedAt = "2026-09-25T11:35:00Z";
  expect(() =>
    prepareTalkParticipationObservation(stale, accountReference, scope, limits, now)
  ).toThrow("stale");
  const wide = snapshot();
  wide.callsState.observationStartedAt = "2026-09-25T11:54:00Z";
  expect(() =>
    prepareTalkParticipationObservation(wide, accountReference, scope, limits, now)
  ).toThrow("wide");
});
it("rejects a reporting week outside the initial source coverage and wrong accounts", () => {
  expect(() =>
    prepareTalkParticipationObservation(
      snapshot(),
      accountReference,
      { ...scope, periodStart: "2026-09-13", periodEnd: "2026-09-19" },
      limits,
      now
    )
  ).toThrow("bootstrap");
  expect(() =>
    prepareTalkParticipationObservation(snapshot(), "zendesk-account:other", scope, limits, now)
  ).toThrow("account");
});
it("does not hide an unresolved employee parent or a still-pending stream", () => {
  const orphan = snapshot();
  orphan.calls = [];
  expect(() =>
    prepareTalkParticipationObservation(orphan, accountReference, scope, limits, now)
  ).toThrow("parent-call coverage");
  const pending = snapshot();
  Object.assign(pending.legsState.cursor, { status: "pending" });
  expect(() =>
    prepareTalkParticipationObservation(pending, accountReference, scope, limits, now)
  ).toThrow("exhausted");
});
it("rejects future observations and unbounded freshness policies", () => {
  const future = snapshot();
  future.legsState.lastPageAt = "2026-09-25T12:11:00Z";
  expect(() =>
    prepareTalkParticipationObservation(future, accountReference, scope, limits, now)
  ).toThrow("chronology");
  expect(() =>
    prepareTalkParticipationObservation(
      snapshot(),
      accountReference,
      scope,
      { maxAgeMs: Infinity, maxSpanMs: 600000 },
      now
    )
  ).toThrow("limits");
});
