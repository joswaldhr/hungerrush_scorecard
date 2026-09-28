// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { initialTalkCursor } from "./zendesk-talk-cursor";
import { collectOutboundTicketGroups } from "./zendesk-outbound-tickets";
import { prepareOutboundObservation } from "./zendesk-outbound-observation";
import type { TalkCollectionSnapshot } from "./zendesk-talk-observation";

const accountReference = "zendesk-account:synthetic";
const bootstrapStart = Date.parse("2026-09-19T00:00:00Z") / 1000;
const now = new Date("2026-09-25T12:10:00Z");
const limits = { maxAgeMs: 900000, maxSpanMs: 600000 };
const scope = {
  periodStart: "2026-09-20",
  periodEnd: "2026-09-26",
  timeZone: "America/Chicago",
  agentId: 42,
  ticketGroupIds: [7],
};
const state = (resource: "calls" | "legs") => ({
  accountReference,
  bootstrapStart,
  cycle: 2,
  observationStartedAt: "2026-09-25T12:00:00Z",
  lastPageAt: "2026-09-25T12:05:00Z",
  cursor: {
    ...initialTalkCursor("https://synthetic.zendesk.com", resource, bootstrapStart),
    pages: 1,
    visited: ["a".repeat(64)],
    status: "exhausted" as const,
  },
});
async function fixture() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T12:06:00Z"));
  const snapshot: TalkCollectionSnapshot = {
    accountReference,
    bootstrapStart,
    callsState: state("calls"),
    legsState: state("legs"),
    missingParentCallIds: [],
    calls: [
      {
        id: 1,
        ticket_id: 9,
        created_at: "2026-09-21T12:00:00Z",
        updated_at: "2026-09-21T13:00:00Z",
        direction: "outbound",
        completion_status: "completed",
        call_group_id: 99,
        phone_number: null,
        talk_time: 0,
        voicemail: false,
      },
    ],
    legs: [
      {
        id: 2,
        call_id: 1,
        agent_id: 42,
        type: "agent",
        completion_status: "completed",
        created_at: "2026-09-21T12:00:00Z",
        updated_at: "2026-09-21T13:00:00Z",
        talk_time: 0,
        hold_time: null,
        duration: 10,
        consultation_time: null,
      },
    ],
  };
  const tickets = await collectOutboundTicketGroups(
    snapshot.calls,
    { ...scope, accountReference },
    async () => ({ tickets: [{ id: 9, group_id: 7, updated_at: "2026-09-25T11:00:00Z" }] })
  );
  return { snapshot, tickets };
}
afterEach(() => vi.useRealTimers());
it("joins a complete exact observation while retaining zeros, missing durations and qualification limits", async () => {
  const { snapshot, tickets } = await fixture();
  const result = prepareOutboundObservation(
    snapshot,
    tickets,
    accountReference,
    scope,
    limits,
    now
  );
  expect(result.result).toMatchObject({
    attempted: 1,
    completed: 0,
    nonAnswered: 1,
    attemptedCallIds: [1],
    selectedLegIds: [2],
    talk: { meanSeconds: 0, sampleCount: 1 },
    hold: { meanSeconds: null, sampleCount: 0 },
  });
  expect(result.provenance).toMatchObject({
    sourceIsAtomicSnapshot: false,
    independentMetricQualificationComplete: false,
    observationStartedAt: "2026-09-25T12:00:00.000Z",
    observationEndedAt: "2026-09-25T12:06:00.000Z",
    ticketCount: 1,
    ticketScopeMeaning: "current-linked-ticket-group",
  });
});
it("rejects a changed call even when the linked ticket ID is unchanged", async () => {
  const { snapshot, tickets } = await fixture();
  snapshot.calls[0]!.talk_time = 60;
  expect(() =>
    prepareOutboundObservation(snapshot, tickets, accountReference, scope, limits, now)
  ).toThrow("exact call snapshot");
});
it("rejects mismatched account, interval and timezone instead of accepting a complete flag", async () => {
  const { snapshot, tickets } = await fixture();
  for (const override of [
    { accountReference: "zendesk-account:other" },
    { periodEnd: "2026-09-25" },
    { timeZone: "UTC" },
  ]) {
    const wrong = structuredClone(tickets);
    Object.assign(wrong.coverage, override);
    expect(() =>
      prepareOutboundObservation(snapshot, wrong, accountReference, scope, limits, now)
    ).toThrow("scope mismatch");
  }
});
it("rechecks exact returned ticket IDs and coverage counters", async () => {
  const { snapshot, tickets } = await fixture();
  for (const mutation of [
    (t: typeof tickets) => {
      t.tickets = [];
    },
    (t: typeof tickets) => {
      t.tickets[0]!.id = 10;
    },
    (t: typeof tickets) => {
      t.tickets.push({ ...t.tickets[0]! });
    },
    (t: typeof tickets) => {
      t.coverage.unlinkedCalls = 1;
    },
    (t: typeof tickets) => {
      t.coverage.requests = 2;
    },
  ]) {
    const wrong = structuredClone(tickets);
    mutation(wrong);
    expect(() =>
      prepareOutboundObservation(snapshot, wrong, accountReference, scope, limits, now)
    ).toThrow("exact call snapshot");
  }
});
it("rejects stale, widely separated and future ticket evidence", async () => {
  const { snapshot, tickets } = await fixture();
  for (const [start, end, error] of [
    ["2026-09-25T11:00:00Z", "2026-09-25T11:01:00Z", "stale"],
    ["2026-09-25T11:55:00Z", "2026-09-25T12:06:00Z", "wide"],
    ["2026-09-25T12:06:00Z", "2026-09-25T12:11:00Z", "chronology"],
  ]) {
    const wrong = structuredClone(tickets);
    wrong.coverage.observationStartedAt = start!;
    wrong.coverage.observationEndedAt = end!;
    expect(() =>
      prepareOutboundObservation(snapshot, wrong, accountReference, scope, limits, now)
    ).toThrow(error!);
  }
  tickets.tickets[0]!.updated_at = "2026-09-25T12:07:00Z";
  expect(() =>
    prepareOutboundObservation(snapshot, tickets, accountReference, scope, limits, now)
  ).toThrow("chronology");
});
it("rejects incomplete streams and unresolved employee parents before producing numbers", async () => {
  const { snapshot, tickets } = await fixture();
  snapshot.legsState.cursor.status = "pending";
  expect(() =>
    prepareOutboundObservation(snapshot, tickets, accountReference, scope, limits, now)
  ).toThrow("exhausted");
  snapshot.legsState.cursor.status = "exhausted";
  snapshot.legs[0]!.call_id = 999;
  expect(() =>
    prepareOutboundObservation(snapshot, tickets, accountReference, scope, limits, now)
  ).toThrow("parent-call coverage");
});
