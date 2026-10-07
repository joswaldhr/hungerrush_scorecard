import { describe, expect, it } from "vitest";
import {
  calculateAssigneeSolvedReport,
  type AssigneeSolvedReportScope,
} from "./zendesk-assignee-solved-report";
import { calculateTicketReportCredits } from "./zendesk-ticket-report-credits";
import { ticketReportCoverage, ticketReportPeriodBounds } from "./zendesk-ticket-report-coverage";

const scope: AssigneeSolvedReportScope = {
  periodStart: "2026-10-04",
  periodEnd: "2026-10-10",
  timeZone: "America/Chicago",
  agentIds: [1],
  groupIds: [10],
  brandIds: [20],
  dateBasis: "latest-solved",
  attribution: "current-assignee",
};
const observedAt = "2026-10-07T16:00:00Z";
const cutoff = "2026-10-07T15:59:00Z";
const coverage = {
  start: "2026-10-04T05:00:00Z",
  endExclusive: cutoff,
  complete: true,
  asOf: cutoff,
};
describe("explicit current-week source cutoff", () => {
  it("locates exact local boundaries across spring/fall DST, half-hour offsets and year rollover", () => {
    for (const [first, last, zone, start, end] of [
      [
        "2026-03-08",
        "2026-03-14",
        "America/Chicago",
        "2026-03-08T06:00:00.000Z",
        "2026-03-15T05:00:00.000Z",
      ],
      [
        "2026-11-01",
        "2026-11-07",
        "America/Chicago",
        "2026-11-01T05:00:00.000Z",
        "2026-11-08T06:00:00.000Z",
      ],
      [
        "2026-12-27",
        "2027-01-02",
        "America/Chicago",
        "2026-12-27T06:00:00.000Z",
        "2027-01-03T06:00:00.000Z",
      ],
      [
        "2026-10-04",
        "2026-10-10",
        "Asia/Kolkata",
        "2026-10-03T18:30:00.000Z",
        "2026-10-10T18:30:00.000Z",
      ],
    ]) {
      const bounds = ticketReportPeriodBounds(first!, last!, zone!);
      expect(bounds.start.toISOString()).toBe(start);
      expect(bounds.endExclusive.toISOString()).toBe(end);
    }
    expect(() => ticketReportPeriodBounds("2026-02-30", "2026-03-02", "UTC")).toThrow();
    expect(() => ticketReportPeriodBounds("2026-10-04", "2026-10-03", "UTC")).toThrow();
  });
  it("requires an explicit as-of rather than treating an unfinished week as complete", () => {
    expect(ticketReportCoverage(coverage, observedAt, scope).covered).toBe(true);
    const { asOf: unused, ...unmarked } = coverage;
    void unused;
    expect(ticketReportCoverage(unmarked, observedAt, scope).covered).toBe(false);
    expect(ticketReportCoverage({ ...coverage, complete: false }, observedAt, scope).covered).toBe(
      false
    );
  });
  it("excludes solves at or after the cutoff despite their presence in padded search", () => {
    const tickets = [
      "2026-10-04T04:59:59Z",
      "2026-10-04T05:00:00Z",
      "2026-10-07T15:58:59Z",
      cutoff,
      observedAt,
    ].map((solved_at, index) => ({
      id: index + 1,
      assignee_id: 1,
      group_id: 10,
      brand_id: 20,
      status: "solved",
      solved_at,
    }));
    const result = calculateAssigneeSolvedReport({ tickets, coverage, observedAt }, scope);
    expect(result.agents[0]).toMatchObject({ assigneeSolvedTickets: 2, ticketIds: [2, 3] });
  });
  it("keeps verified no-activity zero distinct from a missing start of week", () => {
    expect(
      calculateAssigneeSolvedReport({ tickets: [], coverage, observedAt }, scope).agents[0]!
        .assigneeSolvedTickets
    ).toBe(0);
    const incomplete = { ...coverage, start: "2026-10-05T00:00:00Z" };
    expect(
      calculateAssigneeSolvedReport({ tickets: [], coverage: incomplete, observedAt }, scope)
        .agents[0]!.assigneeSolvedTickets
    ).toBeNull();
  });
  it("also supports updater evidence without publishing the unqualified update measure", () => {
    const result = calculateTicketReportCredits(
      {
        events: [
          {
            id: 1,
            ticket_id: 2,
            updater_id: 1,
            created_at: "2026-10-07T15:58:00Z",
            child_events: [
              { id: 3, event_type: "Change", status: "solved", previous_value: "open" },
            ],
          },
        ],
        tickets: [
          {
            id: 2,
            group_id: 10,
            brand_id: 20,
            status: "solved",
            solved_at: "2026-10-07T15:58:00Z",
          },
        ],
        identities: [{ id: 1, role: "agent" }],
        coverage,
        observedAt,
      },
      {
        ...scope,
        groupIds: [10],
        dateBasis: "update-created",
        attribution: "updater-account",
        groupBasis: "current-ticket-group",
      }
    );
    expect(result.agents[0]!.ticketsSolvedCredits).toBe(1);
    expect(result.qualification).toBe("candidate");
  });
  it("rejects future, mismatched or old-week progress cutoffs", () => {
    expect(() =>
      ticketReportCoverage({ ...coverage, asOf: observedAt }, observedAt, scope)
    ).toThrow("cutoff");
    expect(() => ticketReportCoverage(coverage, "2026-10-07T15:58:00Z", scope)).toThrow(
      "chronology"
    );
    expect(() => ticketReportCoverage(coverage, "2026-10-11T05:00:00Z", scope)).toThrow("cutoff");
    expect(() =>
      ticketReportCoverage(coverage, observedAt, {
        ...scope,
        periodStart: "2026-09-27",
        periodEnd: "2026-10-03",
      })
    ).toThrow("cutoff");
  });
  it("retains Central DST and year-boundary closed-period coverage", () => {
    for (const [periodStart, periodEnd, start, end] of [
      ["2026-11-01", "2026-11-07", "2026-11-01T05:00:00Z", "2026-11-08T06:00:00Z"],
      ["2026-12-27", "2027-01-02", "2026-12-27T06:00:00Z", "2027-01-03T06:00:00Z"],
    ]) {
      expect(
        ticketReportCoverage({ start: start!, endExclusive: end!, complete: true }, end!, {
          ...scope,
          periodStart: periodStart!,
          periodEnd: periodEnd!,
        }).covered
      ).toBe(true);
      expect(
        ticketReportCoverage(
          {
            start: start!,
            endExclusive: new Date(Date.parse(end!) - 1).toISOString(),
            complete: true,
          },
          end!,
          { ...scope, periodStart: periodStart!, periodEnd: periodEnd! }
        ).covered
      ).toBe(false);
    }
  });
});
