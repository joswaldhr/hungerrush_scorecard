import { initialTalkCursor } from "@/lib/connectors/zendesk-talk-cursor";
import { outboundTicketCohort } from "@/lib/connectors/zendesk-outbound-tickets";
import type { TalkCollectionSnapshot } from "@/lib/connectors/zendesk-talk-observation";
import { parseZendeskTalkPolicy, outboundTalkKeys } from "@/lib/connectors/zendesk-talk-policy";

export function outboundObservationFixture(
  config = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    dataSourceId: "00000000-0000-4000-8000-000000000002",
  },
  employeeId = "synthetic-employee",
  teamId = "00000000-0000-4000-8000-000000000003"
) {
  const accountReference = "zendesk-account:synthetic";
  const bootstrapStart = Date.parse("2026-09-19T00:00:00Z") / 1000;
  const periodStart = "2026-09-20",
    periodEnd = "2026-09-26",
    timeZone = "America/Chicago";
  const now = new Date("2026-09-25T12:10:00Z");
  const state = (resource: "calls" | "legs") => ({
    accountReference,
    bootstrapStart,
    cycle: 1,
    observationStartedAt: "2026-09-25T12:00:00Z",
    lastPageAt: "2026-09-25T12:05:00Z",
    cursor: {
      ...initialTalkCursor("https://synthetic.zendesk.com", resource, bootstrapStart),
      status: "exhausted" as const,
      pages: 1,
      visited: ["a".repeat(64)],
    },
  });
  const snapshot: TalkCollectionSnapshot = {
    accountReference,
    bootstrapStart,
    callsState: state("calls"),
    legsState: state("legs"),
    missingParentCallIds: [],
    calls: [1, 2].map((id) => ({
      id,
      ticket_id: id + 10,
      created_at: "2026-09-21T12:00:00Z",
      updated_at: "2026-09-21T13:00:00Z",
      direction: "outbound",
      completion_status: "completed",
      call_group_id: 99,
      phone_number: "unnecessary source line",
      talk_time: id === 1 ? 2 : 0,
      voicemail: false,
    })),
    legs: [1, 2, 3, 4].map((id) => ({
      id,
      call_id: id === 3 ? 2 : 1,
      agent_id: id === 4 ? 99 : 42,
      type: "agent",
      completion_status: "completed",
      created_at: "2026-09-21T12:00:00Z",
      updated_at: "2026-09-21T13:00:00Z",
      talk_time: id === 3 ? 0 : 1,
      hold_time: null,
      duration: 10,
      consultation_time: null,
    })),
  };
  const cohort = outboundTicketCohort(snapshot.calls, {
    accountReference,
    periodStart,
    periodEnd,
    timeZone,
  });
  const tickets = {
    tickets: [11, 12].map((id) => ({ id, group_id: 7, updated_at: "2026-09-25T11:00:00Z" })),
    coverage: {
      complete: true as const,
      accountReference,
      periodStart,
      periodEnd,
      timeZone,
      observationStartedAt: "2026-09-25T12:06:00Z",
      observationEndedAt: "2026-09-25T12:06:00Z",
      requestedTickets: 2,
      returnedTickets: 2,
      requests: 1,
      unlinkedCalls: cohort.unlinkedCalls,
      callPopulationDigest: cohort.callPopulationDigest,
      scopeMeaning: "current-linked-ticket-group" as const,
    },
  };
  const policy = parseZendeskTalkPolicy(
    JSON.stringify({
      schemaVersion: 1,
      ...config,
      accountReference,
      reportingTimeZone: timeZone,
      effectivePeriodStart: periodStart,
      observationLimits: { maxAgeMs: 900000, maxSpanMs: 600000 },
      teams: [
        {
          teamId,
          inbound: null,
          outbound: {
            dateBasis: "call-created",
            scopeMeaning: "current-linked-ticket-group",
            ticketGroupIds: [7],
            metricKeys: outboundTalkKeys,
          },
        },
      ],
    }),
    "synthetic"
  )!;
  const identity = { employeeId, teamId, agentId: 42, externalId: "agent" };
  return { snapshot, tickets, policy, config, identity, periodStart, periodEnd, now };
}
