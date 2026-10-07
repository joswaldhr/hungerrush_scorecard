import { describe, expect, it } from "vitest";
import {
  calculateTicketReportCredits,
  type TicketReportCreditScope,
} from "./zendesk-ticket-report-credits";

const scope: TicketReportCreditScope = {
  periodStart: "2026-09-20",
  periodEnd: "2026-09-26",
  timeZone: "America/Chicago",
  agentIds: [1, 2],
  groupIds: [10],
  brandIds: [20],
  dateBasis: "update-created",
  groupBasis: "current-ticket-group",
  attribution: "updater-account",
};
const time = "2026-09-23T12:00:00Z";
function event(id: number, ticket = 100, actor = 1, at = time) {
  return {
    id,
    ticket_id: ticket,
    updater_id: actor,
    created_at: at,
    child_events: [
      { id: id * 100, event_type: "Change", status: "solved", previous_value: "open" },
    ],
  };
}
function snapshot(events = [event(1)]) {
  return {
    events,
    tickets: [{ id: 100, group_id: 10, brand_id: 20, status: "closed", solved_at: time }],
    identities: [
      { id: 1, role: "agent" },
      { id: 2, role: "admin" },
    ],
    coverage: {
      start: "2026-09-20T05:00:00Z",
      endExclusive: "2026-09-27T05:00:00Z",
      complete: true,
    },
    observedAt: "2026-10-06T20:00:00Z",
  };
}

describe("separate report-matched updater credits", () => {
  it("counts update IDs, not tickets or changed fields, including account-attributed integration events", () => {
    const source = snapshot([event(1), event(2, 100, 1, "2026-09-23T11:00:00Z")]);
    source.events[0]!.child_events.push({
      id: 999,
      event_type: "Change",
      status: "pending",
      previous_value: "open",
    });
    const result = calculateTicketReportCredits(source, scope);
    expect(result.qualification).toBe("candidate");
    expect(result.attribution).toBe("updater-account");
    expect(result.agents[0]).toMatchObject({
      agentUpdateEvents: 2,
      ticketsSolvedCredits: 1,
      updateEventIds: [1, 2],
      solvedEventIds: [1],
      ticketIds: [100],
    });
    expect(result.agents[1]).toMatchObject({ agentUpdateEvents: 0, ticketsSolvedCredits: 0 });
  });
  it("deduplicates repeated events and rejects conflicting repeated evidence", () => {
    expect(
      calculateTicketReportCredits(snapshot([event(1), event(1)]), scope).agents[0]!
        .agentUpdateEvents
    ).toBe(1);
    expect(() => calculateTicketReportCredits(snapshot([event(1), event(1, 200)]), scope)).toThrow(
      "Conflicting"
    );
  });
  it("attributes each event to its updater, regardless of a ticket's current assignee", () => {
    const source = {
      ...snapshot([event(1, 100, 2)]),
      tickets: [{ ...snapshot().tickets[0], assignee_id: 1 }],
    };
    const result = calculateTicketReportCredits(source, scope);
    expect(result.agents[0]!.ticketsSolvedCredits).toBe(0);
    expect(result.agents[1]!.ticketsSolvedCredits).toBe(1);
  });
  it("does not count an earlier resolution after a later solve", () => {
    const source = snapshot([event(1, 100, 1, "2026-09-22T12:00:00Z"), event(2, 100, 2)]);
    expect(
      calculateTicketReportCredits(source, scope).agents.map((a) => a.ticketsSolvedCredits)
    ).toEqual([0, 1]);
  });
  it("reopening removes solved credit but preserves update events", () => {
    const source = snapshot();
    source.tickets[0]!.status = "open";
    expect(calculateTicketReportCredits(source, scope).agents[0]).toMatchObject({
      agentUpdateEvents: 1,
      ticketsSolvedCredits: 0,
    });
  });
  it("excludes solved-to-closed maintenance and counts a direct open-to-closed credit", () => {
    const source = snapshot();
    source.events[0]!.child_events[0]!.status = "closed";
    expect(calculateTicketReportCredits(source, scope).agents[0]!.ticketsSolvedCredits).toBe(1);
    source.events[0]!.child_events[0]!.previous_value = "solved";
    expect(calculateTicketReportCredits(source, scope).agents[0]!.ticketsSolvedCredits).toBe(0);
  });
  it("counts a ticket created solved, while an unknown previous status on Change stays unavailable", () => {
    const source = snapshot();
    const child = {
      ...source.events[0]!.child_events[0]!,
      previous_value: null,
      event_type: "Create",
    };
    const result = calculateTicketReportCredits(
      { ...source, events: [{ ...source.events[0], child_events: [child] }] },
      scope
    );
    expect(result.agents[0]).toMatchObject({
      agentUpdateEvents: 1,
      ticketsSolvedCredits: 1,
      solvedIssues: [],
    });
    child.event_type = "Change";
    expect(
      calculateTicketReportCredits(
        { ...source, events: [{ ...source.events[0], child_events: [child] }] },
        scope
      ).agents[0]
    ).toMatchObject({ ticketsSolvedCredits: null, solvedIssues: ["unknown_previous_status"] });
  });
  it("uses the explicit current-ticket group and brand scope", () => {
    const source = snapshot();
    source.tickets[0]!.group_id = 11;
    expect(calculateTicketReportCredits(source, scope).agents[0]!.agentUpdateEvents).toBe(0);
    source.tickets[0]!.group_id = 10;
    source.tickets[0]!.brand_id = 21;
    expect(calculateTicketReportCredits(source, scope).agents[0]!.agentUpdateEvents).toBe(0);
    expect(
      calculateTicketReportCredits(source, { ...scope, brandIds: null }).agents[0]!
        .agentUpdateEvents
    ).toBe(1);
  });
  it("excludes end-user events only from Agent updates, as the two source formulas differ", () => {
    const source = snapshot();
    source.identities[0]!.role = "end-user";
    expect(calculateTicketReportCredits(source, scope).agents[0]).toMatchObject({
      agentUpdateEvents: 0,
      ticketsSolvedCredits: 1,
    });
  });
  it("does not treat missing role evidence as a confirmed zero", () => {
    const source = snapshot([]);
    source.identities = [];
    expect(calculateTicketReportCredits(source, scope).agents[0]).toMatchObject({
      agentUpdateEvents: null,
      updateIssues: ["unknown_updater_role"],
    });
  });
  it("withholds affected employees when a parent is missing", () => {
    const source = snapshot();
    source.tickets = [];
    const result = calculateTicketReportCredits(source, scope);
    expect(result.agents[0]).toMatchObject({ agentUpdateEvents: null, ticketsSolvedCredits: null });
    expect(result.agents[1]).toMatchObject({ agentUpdateEvents: 0, ticketsSolvedCredits: 0 });
  });
  it("excludes source-confirmed deletions from group-filtered credits, with explicit contradictory-evidence checks", () => {
    const source = snapshot();
    const deletion = { id: 100, deleted_at: "2026-09-24T12:00:00Z" };
    expect(
      calculateTicketReportCredits({ ...source, tickets: [], deletedTickets: [deletion] }, scope)
        .agents[0]
    ).toMatchObject({
      agentUpdateEvents: 0,
      ticketsSolvedCredits: 0,
      updateIssues: [],
      solvedIssues: [],
    });
    expect(() =>
      calculateTicketReportCredits({ ...source, deletedTickets: [deletion] }, scope)
    ).toThrow("Conflicting");
    expect(() =>
      calculateTicketReportCredits(
        { ...source, tickets: [], deletedTickets: [deletion, deletion] },
        scope
      )
    ).toThrow("Conflicting");
    expect(() =>
      calculateTicketReportCredits(
        {
          ...source,
          tickets: [],
          deletedTickets: [{ ...deletion, deleted_at: "2026-10-07T00:00:00Z" }],
        },
        scope
      )
    ).toThrow("newer");
  });
  it("requires latest solved timestamp for an otherwise qualifying solve", () => {
    const source = snapshot();
    const { solved_at: ignored, ...ticket } = source.tickets[0]!;
    void ignored;
    expect(
      calculateTicketReportCredits({ ...source, tickets: [ticket] }, scope).agents[0]
    ).toMatchObject({
      agentUpdateEvents: 1,
      ticketsSolvedCredits: null,
      solvedIssues: ["missing_solved_time"],
    });
  });
  it("never publishes zeros from a partial stream or a truncated Central-time boundary", () => {
    const source = snapshot([]);
    source.coverage.complete = false;
    expect(
      calculateTicketReportCredits(source, scope).agents.every(
        (a) => a.agentUpdateEvents === null && a.ticketsSolvedCredits === null
      )
    ).toBe(true);
    source.coverage.complete = true;
    source.coverage.endExclusive = "2026-09-27T00:00:00Z";
    expect(calculateTicketReportCredits(source, scope).agents[0]!.agentUpdateEvents).toBeNull();
    source.coverage.endExclusive = "2026-09-27T05:00:00Z";
    source.coverage.start = "2026-09-20T05:00:01Z";
    expect(calculateTicketReportCredits(source, scope).agents[0]!.agentUpdateEvents).toBeNull();
  });
  it("filters UTC-day padding by the selected reporting timezone", () => {
    const source = snapshot([
      event(1, 100, 1, "2026-09-20T04:59:59Z"),
      event(2, 100, 1, "2026-09-20T05:00:00Z"),
      event(3, 100, 1, "2026-09-27T04:59:59Z"),
      event(4, 100, 1, "2026-09-27T05:00:00Z"),
    ]);
    source.coverage.start = "2026-09-19T00:00:00Z";
    source.coverage.endExclusive = "2026-09-28T00:00:00Z";
    expect(calculateTicketReportCredits(source, scope).agents[0]!.updateEventIds).toEqual([2, 3]);
  });
  it("uses the longer Central-time week across the fall clock change", () => {
    const source = snapshot([event(1, 100, 1, "2026-11-08T05:59:59Z")]);
    source.observedAt = "2026-11-09T00:00:00Z";
    source.coverage.start = "2026-11-01T05:00:00Z";
    source.coverage.endExclusive = "2026-11-08T06:00:00Z";
    const fallScope = { ...scope, periodStart: "2026-11-01", periodEnd: "2026-11-07" };
    expect(calculateTicketReportCredits(source, fallScope).agents[0]!.agentUpdateEvents).toBe(1);
    source.coverage.endExclusive = "2026-11-08T05:00:00Z";
    source.events = [];
    expect(calculateTicketReportCredits(source, fallScope).agents[0]!.agentUpdateEvents).toBeNull();
  });
  it("rejects duplicate joins, invalid scope, chronology and events outside capture", () => {
    const source = snapshot();
    expect(() =>
      calculateTicketReportCredits(
        { ...source, tickets: [...source.tickets, ...source.tickets] },
        scope
      )
    ).toThrow("Duplicate");
    expect(() =>
      calculateTicketReportCredits(
        { ...source, identities: [...source.identities, ...source.identities] },
        scope
      )
    ).toThrow("Duplicate");
    expect(() => calculateTicketReportCredits(source, { ...scope, groupIds: [] })).toThrow();
    expect(() => calculateTicketReportCredits(source, { ...scope, timeZone: "invalid" })).toThrow();
    expect(() =>
      calculateTicketReportCredits({ ...source, observedAt: "2026-09-20T00:00:00Z" }, scope)
    ).toThrow("chronology");
    expect(() =>
      calculateTicketReportCredits(snapshot([event(1, 100, 1, "2026-09-27T05:00:00Z")]), scope)
    ).toThrow("outside captured");
  });
});
