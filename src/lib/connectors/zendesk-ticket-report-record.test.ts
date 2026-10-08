import { describe, expect, it } from "vitest";
import {
  buildTicketReportCandidateRecord,
  type TicketReportIdentity,
} from "./zendesk-ticket-report-record";
import { assertMetricPublicationEligible } from "@/lib/domain/metrics/publication-eligibility";
import type { TicketReportCreditScope } from "./zendesk-ticket-report-credits";

const identity: TicketReportIdentity = {
  accountReference: "zendesk-account:example",
  subdomain: "example",
  agentId: 1,
  externalId: "agent@example.invalid",
  employeeId: "10000000-0000-4000-8000-000000000001",
  teamId: "10000000-0000-4000-8000-000000000002",
  observationStartedAt: "2026-10-05T12:00:00Z",
};
const scope: TicketReportCreditScope = {
  periodStart: "2026-09-27",
  periodEnd: "2026-10-03",
  timeZone: "America/Chicago",
  agentIds: [1, 2],
  groupIds: [10],
  brandIds: [20],
  dateBasis: "update-created",
  groupBasis: "current-ticket-group",
  attribution: "updater-account",
};
const time = "2026-09-28T12:00:00Z";
const snapshot = () => ({
  events: [1, 2].map((agentId) => ({
    id: agentId,
    ticket_id: agentId * 100,
    updater_id: agentId,
    created_at: time,
    child_events: [
      {
        id: agentId * 1000,
        event_type: "Change",
        status: "solved",
        previous_value: "open",
        body: "PRIVATE",
      },
    ],
    metadata: { private: "PRIVATE" },
  })),
  tickets: [1, 2].map((agentId) => ({
    id: agentId * 100,
    assignee_id: agentId,
    group_id: 10,
    brand_id: 20,
    status: "solved",
    solved_at: time,
    subject: "PRIVATE",
  })),
  identities: [1, 2].map((id) => ({ id, role: "agent", name: "PRIVATE" })),
  coverage: { start: "2026-09-27T05:00:00Z", endExclusive: "2026-10-04T05:00:00Z", complete: true },
  observedAt: "2026-10-05T12:01:00Z",
  untrustedTotal: 999,
});
const selection = { kind: "updater" as const, scope };

describe("inactive ticket report ingestion boundary", () => {
  it("minimizes employee evidence and recalculates values without retaining content", () => {
    const record = buildTicketReportCandidateRecord(snapshot(), selection, identity);
    expect(record.payload.result).toMatchObject({
      agentId: 1,
      agentUpdateEvents: 1,
      ticketsSolvedCredits: 1,
    });
    expect(record.payload.sourceEvidence).toMatchObject({
      events: [{ id: 1 }],
      tickets: [{ id: 100 }],
      identities: [{ id: 1 }],
    });
    expect(JSON.stringify(record)).not.toContain("PRIVATE");
    expect(JSON.stringify(record)).not.toContain("untrustedTotal");
    expect(record.sourceUpdatedAt?.getTime()).toBe(Date.parse(identity.observationStartedAt));
    expect(record.payload.sourceScopeFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });
  it("keeps assignee solved records distinct from updater records", () => {
    const { groupBasis: unused, ...rest } = scope;
    void unused;
    const record = buildTicketReportCandidateRecord(
      snapshot(),
      {
        kind: "assignee-solved",
        scope: {
          ...rest,
          groupIds: null,
          brandIds: null,
          dateBasis: "latest-solved",
          attribution: "current-assignee",
        },
      },
      identity
    );
    expect(record.payload.result).toMatchObject({
      agentId: 1,
      assigneeSolvedTickets: 1,
      ticketIds: [100],
    });
    expect(record.externalRecordId).not.toBe(
      buildTicketReportCandidateRecord(snapshot(), selection, identity).externalRecordId
    );
    expect(record.payload.sourceEvidence).not.toHaveProperty("events");
  });
  it("retains unavailable coverage instead of converting it to zero", () => {
    const s = snapshot();
    s.coverage.complete = false;
    expect(buildTicketReportCandidateRecord(s, selection, identity).payload.result).toMatchObject({
      agentUpdateEvents: null,
      ticketsSolvedCredits: null,
      updateIssues: ["incomplete_stream"],
    });
  });
  it("rejects a foreign account, employee, or invalid observation interval", () => {
    expect(() =>
      buildTicketReportCandidateRecord(snapshot(), selection, { ...identity, subdomain: "foreign" })
    ).toThrow("binding");
    expect(() =>
      buildTicketReportCandidateRecord(snapshot(), selection, { ...identity, agentId: 3 })
    ).toThrow("outside");
    expect(() =>
      buildTicketReportCandidateRecord(snapshot(), selection, {
        ...identity,
        observationStartedAt: "2026-10-06T12:00:00Z",
      })
    ).toThrow("interval");
  });
  it("validates foreign employee evidence before reducing the snapshot", () => {
    const s = snapshot();
    s.tickets.push({ ...s.tickets[1]! });
    expect(() => buildTicketReportCandidateRecord(s, selection, identity)).toThrow("Duplicate");
  });
  it("binds comparison scope to account, team, employee and filters but not reporting date", () => {
    const record = buildTicketReportCandidateRecord(snapshot(), selection, identity);
    const different = buildTicketReportCandidateRecord(snapshot(), selection, {
      ...identity,
      teamId: "10000000-0000-4000-8000-000000000003",
    });
    expect(different.payload.sourceScopeFingerprint).not.toBe(
      record.payload.sourceScopeFingerprint
    );
  });
  it("cannot be accidentally published by removing or forging an eligibility marker", () => {
    const record = buildTicketReportCandidateRecord(snapshot(), selection, identity);
    expect(() =>
      assertMetricPublicationEligible(record.payload, record.externalRecordType)
    ).toThrow("not eligible");
    for (const publicationEligible of [undefined, true, false])
      expect(() =>
        assertMetricPublicationEligible({
          sourceContract: record.payload.sourceContract,
          publicationEligible,
        })
      ).toThrow("not eligible");
    expect(() => assertMetricPublicationEligible({}, record.externalRecordType)).toThrow(
      "not eligible"
    );
  });
});
