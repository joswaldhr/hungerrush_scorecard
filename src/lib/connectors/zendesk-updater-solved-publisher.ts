import { z } from "zod";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
import { readReportEventSnapshot } from "./zendesk-report-event-store";
import { createReportJoinReader } from "./zendesk-report-join-reader";
import { createSolvedPublisher } from "./zendesk-solved-publisher";
import { parseSolvedRelease, type SolvedRelease } from "./zendesk-solved-publication-record";
import { ticketReportCoverage, ticketReportPeriodBounds } from "./zendesk-ticket-report-coverage";
import { joinUpdaterSolvedReport } from "./zendesk-updater-solved-join";

const rolesSchema = z.object({
  users: z.array(
    z.object({ id: z.number().int().positive().safe(), role: z.enum(["agent", "admin"]) })
  ),
});
/** Separate durable event collection must finish first. This loader never resets its cursor. */
export function createLiveUpdaterSolvedPublisher(
  input: SolvedRelease,
  credentials: { subdomain: string; email: string; apiKey: string }
) {
  const policy = parseSolvedRelease(input);
  if (policy.kind !== "updater") throw Error("Updater collector cannot publish assignee counts");
  assertZendeskAccountBinding(policy.accountReference, credentials.subdomain);
  return createSolvedPublisher(policy, async (_config, periodStart, periodEnd, externalIds) => {
    const started = Date.now(),
      read = createReportJoinReader(credentials, policy.accountReference),
      roles = new Map<number, "agent" | "admin">();
    const { identities } = await resolveCsatStaffIdentities(externalIds, async (path) => {
      const response = await read(path);
      for (const user of rolesSchema.parse(response).users) roles.set(user.id, user.role);
      return response;
    });
    const { start, endExclusive } = ticketReportPeriodBounds(
      periodStart,
      periodEnd,
      policy.timeZone
    );
    const retained = await readReportEventSnapshot(
      policy,
      start,
      endExclusive,
      [...identities.values()],
      { capAtWatermark: true }
    );
    if (!retained.snapshot)
      throw Error("Updater event collection is incomplete; preserve prior publication");
    const { state, events } = retained.snapshot;
    // The oldest dependency establishes freshness; reading old rows today must not
    // relabel them as newly observed. A long bootstrap must complete a fresh cycle.
    const observationStartedAt = new Date(
      Math.min(started, Date.parse(state.observationStartedAt), state.cursor.watermark * 1000)
    ).toISOString();
    if (Date.now() - Date.parse(observationStartedAt) > policy.maxObservationAgeSeconds * 1000)
      throw Error("Updater event collection is stale; refresh before publication");
    const coverage = {
      ...retained.snapshot.coverage,
      ...(Date.parse(retained.snapshot.coverage.endExclusive) < endExclusive.getTime()
        ? { asOf: retained.snapshot.coverage.endExclusive }
        : {}),
    };
    const scope = {
      periodStart,
      periodEnd,
      timeZone: policy.timeZone,
      agentIds: [...identities.values()],
      groupIds: policy.groupIds,
      brandIds: policy.brandIds,
      dateBasis: "update-created" as const,
      groupBasis: "current-ticket-group" as const,
      attribution: "updater-account" as const,
    };
    if (!ticketReportCoverage(coverage, new Date().toISOString(), scope).covered)
      throw Error("Updater report lacks requested period coverage");
    const snapshot = await joinUpdaterSolvedReport(
      {
        events,
        coverage,
        identities: [...identities.values()].map((id) => ({ id, role: roles.get(id) ?? null })),
      },
      scope,
      read
    );
    return { snapshot, identities, observationStartedAt };
  });
}
