import { describe, expect, it } from "vitest";
import { calculateTicketReportCredits } from "./zendesk-ticket-report-credits";
import {
  calculateAssigneeSolvedReport,
  type AssigneeSolvedReportScope,
} from "./zendesk-assignee-solved-report";
const scope: AssigneeSolvedReportScope = {
  periodStart: "2026-09-27",
  periodEnd: "2026-10-03",
  timeZone: "America/Chicago",
  agentIds: [1, 2],
  groupIds: null,
  brandIds: null,
  dateBasis: "latest-solved",
  attribution: "current-assignee",
};
const ticket = {
  id: 10,
  assignee_id: 1,
  group_id: 100,
  brand_id: 200,
  status: "solved",
  solved_at: "2026-10-04T04:59:59Z",
};
const source = () => ({
  tickets: [{ ...ticket }],
  coverage: { complete: true, start: "2026-09-26T00:00:00Z", endExclusive: "2026-10-05T00:00:00Z" },
  observedAt: "2026-10-06T22:00:00Z",
});
describe("report-matched assignee solved tickets", () => {
  it("preserves the Tickets dataset date rule when an update timestamp differs by one second", () => {
    const solved = "2026-09-28T12:00:00Z";
    const s = { ...source(), tickets: [{ ...ticket, solved_at: solved }] };
    expect(calculateAssigneeSolvedReport(s, scope).agents[0]!.assigneeSolvedTickets).toBe(1);
    const updater = calculateTicketReportCredits(
      {
        ...s,
        events: [
          {
            id: 1,
            ticket_id: ticket.id,
            updater_id: 1,
            created_at: "2026-09-28T12:00:01Z",
            child_events: [
              { id: 2, event_type: "Change", status: "solved", previous_value: "open" },
            ],
          },
        ],
        identities: [
          { id: 1, role: "agent" },
          { id: 2, role: "agent" },
        ],
      },
      {
        ...scope,
        groupIds: [100],
        dateBasis: "update-created",
        groupBasis: "current-ticket-group",
        attribution: "updater-account",
      }
    );
    expect(updater.agents[0]!.ticketsSolvedCredits).toBe(0);
  });
  it("counts a solved ticket by current assignee and latest solved date, regardless of later updates", () => {
    const s = source();
    const result = calculateAssigneeSolvedReport(
      { ...s, tickets: [{ ...ticket, updated_at: "2026-10-06T00:00:00Z", updater_id: 2 }] },
      scope
    );
    expect(result.agents.map((a) => a.assigneeSolvedTickets)).toEqual([1, 0]);
    expect(result.agents[0]!.ticketIds).toEqual([10]);
  });
  it("uses Central boundaries and ignores reopened or later-solved tickets", () => {
    const s = source();
    s.tickets.push(
      { ...ticket, id: 11, solved_at: "2026-10-04T05:00:00Z" },
      { ...ticket, id: 12, status: "open" },
      { ...ticket, id: 13, solved_at: "2026-09-27T04:59:59Z" }
    );
    expect(calculateAssigneeSolvedReport(s, scope).agents[0]!.assigneeSolvedTickets).toBe(1);
  });
  it("supports explicit group/brand filters without inventing them for unfiltered reports", () => {
    expect(
      calculateAssigneeSolvedReport(source(), { ...scope, groupIds: [101] }).agents[0]!
        .assigneeSolvedTickets
    ).toBe(0);
    expect(
      calculateAssigneeSolvedReport(source(), { ...scope, brandIds: [201] }).agents[0]!
        .assigneeSolvedTickets
    ).toBe(0);
  });
  it("distinguishes missing solved-time evidence from a known null date", () => {
    const s = source();
    const { solved_at: ignored, ...without } = ticket;
    void ignored;
    expect(
      calculateAssigneeSolvedReport({ ...s, tickets: [without] }, scope).agents[0]!
        .assigneeSolvedTickets
    ).toBeNull();
    expect(
      calculateAssigneeSolvedReport({ ...s, tickets: [{ ...ticket, solved_at: null }] }, scope)
        .agents[0]!.assigneeSolvedTickets
    ).toBe(0);
  });
  it("does not report zero from an incomplete census", () => {
    const s = source();
    s.tickets = [];
    s.coverage.complete = false;
    expect(
      calculateAssigneeSolvedReport(s, scope).agents.every((a) => a.assigneeSolvedTickets === null)
    ).toBe(true);
  });
  it("rejects duplicate parents and impossible source chronology", () => {
    const s = source();
    s.tickets.push({ ...ticket });
    expect(() => calculateAssigneeSolvedReport(s, scope)).toThrow("Duplicate");
    expect(() =>
      calculateAssigneeSolvedReport({ ...source(), observedAt: "2026-09-20T00:00:00Z" }, scope)
    ).toThrow("chronology");
    expect(() =>
      calculateAssigneeSolvedReport(
        { ...source(), tickets: [{ ...ticket, solved_at: "2026-10-07T00:00:00Z" }] },
        scope
      )
    ).toThrow("newer");
  });
});
