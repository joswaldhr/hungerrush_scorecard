import { describe, expect, it } from "vitest";
import {
  referenceFirstReply,
  referenceSolvedCsat,
  type ReferenceScope,
  type ReferenceTicket,
  type ReferenceTicketMetric,
} from "./zendesk-reference";

const scope: ReferenceScope = {
  startDay: "2026-09-13",
  endDay: "2026-09-19",
  timeZone: "America/Chicago",
  assigneeId: 10,
  groupIds: [20],
};
const ticket = (id: number, overrides: Partial<ReferenceTicket> = {}): ReferenceTicket => ({
  id,
  assignee_id: 10,
  group_id: 20,
  created_at: "2026-09-14T12:00:00Z",
  satisfaction_rating: null,
  ...overrides,
});
const metric = (
  ticket_id: number,
  overrides: Partial<ReferenceTicketMetric> = {}
): ReferenceTicketMetric => ({
  ticket_id,
  solved_at: "2026-09-15T12:00:00Z",
  reply_time_in_minutes: { business: 0, calendar: 600 },
  ...overrides,
});

describe("independent Zendesk snapshot reference", () => {
  it("uses Central day boundaries and does not truncate timestamps to UTC dates", () => {
    const rows = [
      ticket(1, { created_at: "2026-09-13T04:59:59Z" }),
      ticket(2, { created_at: "2026-09-13T05:00:00Z" }),
      ticket(3, { created_at: "2026-09-20T04:59:59Z" }),
      ticket(4, { created_at: "2026-09-20T05:00:00Z" }),
    ];
    expect(
      referenceFirstReply(
        rows,
        rows.map((t) => metric(t.id)),
        scope,
        "business"
      ).cohortIds
    ).toEqual([2, 3]);
  });

  it.each([
    ["2026-03-08", "2026-03-08T06:00:00Z", "2026-03-09T04:59:59Z", "2026-03-09T05:00:00Z"],
    ["2026-11-01", "2026-11-01T05:00:00Z", "2026-11-02T05:59:59Z", "2026-11-02T06:00:00Z"],
  ])("includes the entire DST transition day %s", (day, first, last, next) => {
    const rows = [first, last, next].map((created_at, i) => ticket(i + 1, { created_at }));
    const result = referenceFirstReply(
      rows,
      rows.map((t) => metric(t.id)),
      { ...scope, startDay: day, endDay: day },
      "business"
    );
    expect(result.cohortIds).toEqual([1, 2]);
  });

  it("retains business zero, excludes missing measurements and never substitutes calendar time", () => {
    const result = referenceFirstReply(
      [ticket(1), ticket(2), ticket(3)],
      [
        metric(1),
        metric(2, { reply_time_in_minutes: null }),
        metric(3, {
          reply_time_in_minutes: { business: 10, calendar: 100 },
        }),
      ],
      scope,
      "business"
    );
    expect(result).toMatchObject({
      numerator: 10,
      denominator: 2,
      meanMinutes: 5,
      medianMinutes: 5,
      zeroCount: 1,
      missingDurationCount: 1,
    });
  });

  it("does not round reference arithmetic or claim an empty sample is zero", () => {
    const rows = [ticket(1), ticket(2), ticket(3)];
    expect(
      referenceFirstReply(
        rows,
        [
          metric(1),
          metric(2),
          metric(3, {
            reply_time_in_minutes: { business: 1, calendar: 1 },
          }),
        ],
        scope,
        "business"
      ).meanMinutes
    ).toBe(1 / 3);
    expect(referenceFirstReply([], [], scope, "business").meanMinutes).toBeNull();
  });

  it("selects the specified current assignee and groups", () => {
    const rows = [ticket(1), ticket(2, { group_id: 21 }), ticket(3, { assignee_id: 11 })];
    const metrics = rows.map((t) => metric(t.id));
    expect(referenceFirstReply(rows, metrics, scope, "business").cohortIds).toEqual([1]);
    expect(
      referenceFirstReply(rows, metrics, { ...scope, groupIds: null }, "business").cohortIds
    ).toEqual([1, 2]);
    expect(
      referenceFirstReply(rows, metrics, { ...scope, groupIds: [] }, "business").cohortIds
    ).toEqual([]);
  });

  it("fails closed on missing coverage, duplicate source rows and invalid measurements", () => {
    expect(() => referenceFirstReply([ticket(1)], [], scope, "business")).toThrow("coverage");
    expect(() =>
      referenceFirstReply([ticket(1), ticket(1)], [metric(1)], scope, "business")
    ).toThrow("duplicate");
    expect(() =>
      referenceFirstReply([ticket(1)], [metric(1), metric(1)], scope, "business")
    ).toThrow("duplicate");
    for (const value of [-1, NaN, Infinity])
      expect(() =>
        referenceFirstReply(
          [ticket(1)],
          [
            metric(1, {
              reply_time_in_minutes: { business: value, calendar: 2 },
            }),
          ],
          scope,
          "business"
        )
      ).toThrow("duration");
  });

  it("rejects ambiguous timestamps, impossible dates and invalid timezones", () => {
    expect(() =>
      referenceFirstReply(
        [ticket(1, { created_at: "2026-09-14T12:00:00" })],
        [metric(1)],
        scope,
        "business"
      )
    ).toThrow("offset");
    expect(() =>
      referenceFirstReply([], [], { ...scope, startDay: "2026-02-30" }, "business")
    ).toThrow("day");
    expect(() =>
      referenceFirstReply([], [], { ...scope, timeZone: "invalid" }, "business")
    ).toThrow();
  });

  it("uses solved date and offered plus rated tickets for the CSAT denominator", () => {
    const rows = [
      ticket(1, { created_at: "2026-08-01T00:00:00Z", satisfaction_rating: { score: "good" } }),
      ticket(2, { satisfaction_rating: { score: "bad" } }),
      ticket(3, { satisfaction_rating: { score: "offered" } }),
      ticket(4, { satisfaction_rating: { score: "unoffered" } }),
      ticket(5, { satisfaction_rating: { score: "good" } }),
    ];
    const result = referenceSolvedCsat(
      rows,
      [
        metric(1),
        metric(2),
        metric(3),
        metric(4),
        metric(5, { solved_at: "2026-09-20T05:00:00Z" }),
      ],
      scope
    );
    expect(result).toMatchObject({
      cohortIds: [1, 2, 3, 4],
      good: 1,
      bad: 1,
      rated: 2,
      surveyed: 3,
      satisfactionPercent: 50,
      responsePercent: 200 / 3,
    });
  });

  it("distinguishes no survey from an offered survey without a rating", () => {
    expect(referenceSolvedCsat([ticket(1)], [metric(1)], scope)).toMatchObject({
      satisfactionPercent: null,
      responsePercent: null,
    });
    expect(
      referenceSolvedCsat(
        [ticket(1, { satisfaction_rating: { score: "offered" } })],
        [metric(1)],
        scope
      )
    ).toMatchObject({ satisfactionPercent: null, responsePercent: 0 });
    expect(() =>
      referenceSolvedCsat(
        [ticket(1, { satisfaction_rating: { score: "mystery" } })],
        [metric(1)],
        scope
      )
    ).toThrow("Unknown");
  });
});
