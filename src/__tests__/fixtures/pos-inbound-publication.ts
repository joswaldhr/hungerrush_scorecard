import { weekDates } from "@/lib/utils";
import { inboundPublicationFixture } from "./inbound-publication";
import { parsePosInboundRelease } from "@/lib/connectors/zendesk-pos-inbound-publication";
import { posInboundReportKeys } from "@/lib/connectors/zendesk-pos-inbound-report";

export function posInboundPublicationFixture(
  config = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    dataSourceId: "00000000-0000-4000-8000-000000000002",
  },
  employeeId = "00000000-0000-4000-8000-000000000004",
  teamId = "00000000-0000-4000-8000-000000000003"
) {
  const f = inboundPublicationFixture(config, employeeId, teamId);
  // Use a completed week to make this fixture stable even during the Sunday midnight boundary.
  const { periodStart, periodEnd } = weekDates(1);
  const bootstrapStart = (Date.parse(periodStart) - 86400000) / 1000;
  f.snapshot.bootstrapStart = bootstrapStart;
  for (const state of [f.snapshot.callsState, f.snapshot.legsState]) {
    state.bootstrapStart = bootstrapStart;
    state.cursor.watermark = bootstrapStart;
    state.observationStartedAt = new Date().toISOString();
    state.lastPageAt = state.observationStartedAt;
  }
  for (const row of [...f.snapshot.calls, ...f.snapshot.legs]) {
    row.created_at = `${periodStart}T12:00:00Z`;
    row.updated_at = row.created_at;
  }
  const snapshot = {
    ...f.snapshot,
    calls: f.snapshot.calls.map((c) => ({ ...c, hold_time: c.id === 1 ? 30 : 0 })),
  };
  const release = parsePosInboundRelease({
    policy: {
      schemaVersion: 1,
      ...config,
      teamId,
      accountReference: snapshot.accountReference,
      effectivePeriodStart: periodStart,
      timeZone: "UTC",
      groupIds: [7],
      phoneNumbers: ["synthetic-line"],
      dateBasis: "leg-created",
      metricKeys: [...posInboundReportKeys],
      observationLimits: { maxAgeMs: 900000, maxSpanMs: 600000 },
    },
    releaseEvidenceSha256: "a".repeat(64),
  });
  return { ...f, snapshot, periodStart, periodEnd, release };
}
