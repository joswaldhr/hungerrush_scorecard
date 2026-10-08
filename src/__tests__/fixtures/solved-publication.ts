import { weekDates } from "@/lib/utils";
import type { SolvedRelease } from "@/lib/connectors/zendesk-solved-publication-record";

export function solvedPublicationFixture(
  config = {
    organizationId: "10000000-0000-4000-8000-000000000001",
    dataSourceId: "10000000-0000-4000-8000-000000000002",
  },
  employeeId = "10000000-0000-4000-8000-000000000003",
  teamId = "10000000-0000-4000-8000-000000000004"
) {
  const { periodStart, periodEnd } = weekDates(1);
  const observationStartedAt = new Date(Date.now() - 60000).toISOString();
  const observedAt = new Date(Date.now() - 1000).toISOString();
  const time = `${periodStart}T12:00:00Z`;
  const policy: SolvedRelease = {
    ...config,
    teamId,
    kind: "updater",
    subdomain: "synthetic",
    accountReference: "zendesk-account:synthetic",
    effectivePeriodStart: periodStart,
    timeZone: "UTC",
    groupIds: [10],
    brandIds: [20],
    maxObservationAgeSeconds: 900,
    releaseEvidenceSha256: "a".repeat(64),
  };
  return {
    config,
    policy: policy as SolvedRelease,
    periodStart,
    periodEnd,
    identity: { employeeId, teamId, agentId: 42, externalId: "agent", observationStartedAt },
    snapshot: {
      observedAt,
      coverage: {
        start: `${periodStart}T00:00:00Z`,
        endExclusive: new Date(Date.parse(`${periodEnd}T00:00:00Z`) + 86400000).toISOString(),
        complete: true,
      },
      events: [
        {
          id: 1,
          ticket_id: 100,
          updater_id: 42,
          created_at: time,
          child_events: [{ id: 2, event_type: "Change", status: "solved", previous_value: "open" }],
        },
      ],
      tickets: [
        { id: 100, assignee_id: 42, group_id: 10, brand_id: 20, status: "solved", solved_at: time },
      ],
      identities: [{ id: 42, role: "agent" }],
    },
  };
}
