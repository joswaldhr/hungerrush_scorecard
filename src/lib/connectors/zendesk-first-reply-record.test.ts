// @vitest-environment node
import { expect, it } from "vitest";
import { buildFirstReplyRecord, normalizeFirstReplyRecord } from "./zendesk-first-reply-record";
import type { fetchFirstReplyCandidate } from "./zendesk-first-reply";
function snapshot(): Awaited<ReturnType<typeof fetchFirstReplyCandidate>> {
  return {
    tickets: [1, 2, 3, 4].map((id) => ({
      id,
      assignee_id: 7,
      group_id: 20,
      created_at: "2026-09-21T12:00:00Z",
    })),
    metrics: [0, 1, 1, null].map((business, i) => ({
      ticket_id: i + 1,
      reply_time_in_minutes: { business, calendar: business },
    })),
    coverage: {
      complete: true,
      population: "all-created-tickets",
      requests: 2,
      query: "synthetic",
      observationStartedAt: "2026-09-25T12:00:00Z",
      observationEndedAt: "2026-09-25T12:00:01Z",
      periodStart: "2026-09-20",
      periodEnd: "2026-09-26",
      timeZone: "America/Chicago",
      groupIds: [20],
      brandIds: null,
      agentIds: [7],
    },
  };
}
const identity = {
  agentId: 7,
  externalId: "synthetic@example.test",
  accountReference: "zendesk-account:synthetic",
  subdomain: "synthetic",
  employeeContext: { employeeId: "employee", teamId: "team" },
};
function normalize(payload: unknown) {
  return normalizeFirstReplyRecord(payload, "employee", "team", "2026-09-20", "2026-09-26");
}
it("retains exact arithmetic, sample coverage and safe minimal source evidence", () => {
  const input = snapshot();
  Object.assign(input.tickets[0]!, { subject: "PRIVATE BODY" });
  const record = buildFirstReplyRecord(input, identity);
  expect(JSON.stringify(record)).not.toContain("PRIVATE BODY");
  expect(record.externalRecordType).toBe("first_reply_summary");
  expect(record.sourceUpdatedAt?.toISOString()).toBe("2026-09-25T12:00:00.000Z");
  expect(normalize(record.payload)).toMatchObject([
    {
      numericValue: 2 / 3,
      unit: "min",
      dimensionsJson: {
        sampleCount: 3,
        cohortCount: 4,
        sumBusinessMinutes: 2,
        zeroTicketIds: [1],
        missingTicketIds: [4],
      },
    },
  ]);
});
it("publishes null with no observations, preserves true zero and refuses incomplete or foreign evidence", () => {
  const empty = snapshot();
  empty.tickets = [];
  empty.metrics = [];
  expect(normalize(buildFirstReplyRecord(empty, identity).payload)[0]!.numericValue).toBeNull();
  const zero = snapshot();
  zero.tickets = zero.tickets.slice(0, 1);
  zero.metrics = zero.metrics.slice(0, 1);
  expect(normalize(buildFirstReplyRecord(zero, identity).payload)[0]!.numericValue).toBe(0);
  const missing = snapshot();
  missing.metrics.pop();
  expect(() => buildFirstReplyRecord(missing, identity)).toThrow(/Incomplete/);
  expect(() =>
    buildFirstReplyRecord(snapshot(), { ...identity, accountReference: "zendesk-account:other" })
  ).toThrow();
  const changed = buildFirstReplyRecord(snapshot(), identity);
  expect(() =>
    normalizeFirstReplyRecord(changed.payload, "employee", "different", "2026-09-20", "2026-09-26")
  ).toThrow(/changed/);
  expect(() =>
    normalizeFirstReplyRecord(changed.payload, "different", "team", "2026-09-20", "2026-09-26")
  ).toThrow(/changed/);
  expect(() =>
    normalizeFirstReplyRecord(changed.payload, "employee", "team", "2026-09-13", "2026-09-19")
  ).toThrow(/interval/);
});
