import { weekDates } from "@/lib/utils";
import { outboundObservationFixture } from "./outbound-observation";
import { parseInboundReleasePolicy } from "@/lib/connectors/zendesk-inbound-publication-record";

export function inboundPublicationFixture(
  config?: { organizationId: string; dataSourceId: string },
  employeeId?: string,
  teamId?: string
) {
  const f = outboundObservationFixture(config, employeeId, teamId);
  const { periodStart, periodEnd } = weekDates(0);
  const started = new Date(Date.now() - 60000).toISOString(),
    ended = new Date(Date.now() - 1000).toISOString();
  const bootstrapStart = (Date.parse(`${periodStart}T00:00:00Z`) - 86400000) / 1000;
  f.snapshot.bootstrapStart = bootstrapStart;
  for (const state of [f.snapshot.callsState, f.snapshot.legsState]) {
    state.bootstrapStart = bootstrapStart;
    state.observationStartedAt = started;
    state.lastPageAt = ended;
    state.cursor.watermark = bootstrapStart;
  }
  for (const row of [...f.snapshot.calls, ...f.snapshot.legs]) {
    row.created_at = `${periodStart}T00:00:00Z`;
    row.updated_at = started;
  }
  for (const call of f.snapshot.calls) {
    call.direction = "inbound";
    call.call_group_id = 7;
    call.phone_number = "synthetic-line";
  }
  const release = parseInboundReleasePolicy({
    policy: {
      schemaVersion: 1,
      ...f.config,
      teamId: f.identity.teamId,
      accountReference: f.snapshot.accountReference,
      effectivePeriodStart: periodStart,
      timeZone: "UTC",
      groupIds: [7],
      phoneNumbers: ["synthetic-line"],
      dateBasis: "call-created",
      offeredDefinition: "accepted-declined-missed-unreachable",
      metricKeys: ["inbound_calls_offered", "total_talk_time_inbound", "inbound_calls_answer_rate"],
      observationLimits: { maxAgeMs: 900000, maxSpanMs: 600000 },
    },
    releaseEvidenceSha256: "a".repeat(64),
  });
  return { ...f, periodStart, periodEnd, release };
}
