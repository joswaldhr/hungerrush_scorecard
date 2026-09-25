import { createHash } from "node:crypto";
import { sevenDayPeriodEnd } from "@/lib/domain/metrics/effective-dates";
import { csatPolicyForPeriod, type ZendeskCsatPolicy } from "./zendesk-csat-policy";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
import { fetchSolvedCsatCandidate } from "./zendesk-solved-csat";
import { buildSolvedCsatRecord } from "./zendesk-solved-csat-record";
import type { IngestedRecord } from "./types";

/** Read-only fetch phase. The caller must use one bounded reader for the entire invocation. */
export async function collectCsatRecords(
  policy: ZendeskCsatPolicy,
  periodStart: string,
  periodEnd: string,
  activeEmployees: Array<{ employeeId: string; teamId: string; externalId: string }>,
  read: (path: string) => Promise<unknown>
) {
  if (
    !csatPolicyForPeriod(policy, policy, periodStart) ||
    periodEnd !== sevenDayPeriodEnd(periodStart)
  )
    throw new Error("CSAT collection interval is outside the prospective policy");
  const selected = activeEmployees.filter((e) => policy.teams.some((t) => t.teamId === e.teamId));
  if (!selected.length || new Set(selected.map((e) => e.employeeId)).size !== selected.length)
    throw new Error("CSAT requires unique active employee bindings");
  const staff = await resolveCsatStaffIdentities(
    selected.map((e) => e.externalId),
    read
  );
  const records: IngestedRecord[] = [],
    ticketIds = new Set<number>();
  let collections = 0;
  for (const team of policy.teams) {
    const members = selected.filter((e) => e.teamId === team.teamId);
    const batchSize = 60 - team.groupIds.length - (team.brandIds?.length ?? 0);
    if (batchSize < 1) throw new Error("CSAT team scope leaves no employee search capacity");
    for (let start = 0; start < members.length; start += batchSize) {
      const batch = members.slice(start, start + batchSize);
      const snapshot = await fetchSolvedCsatCandidate(
        {
          periodStart,
          periodEnd,
          timeZone: policy.reportingTimeZone,
          groupIds: team.groupIds,
          brandIds: team.brandIds,
          agentIds: batch.map((e) => staff.identities.get(e.externalId)!),
        },
        read
      );
      for (const ticket of snapshot.tickets) {
        if (ticketIds.has(ticket.id))
          throw new Error(
            "CSAT ticket moved between employee collections; repeat observation required"
          );
        ticketIds.add(ticket.id);
      }
      for (const member of batch)
        records.push(
          buildSolvedCsatRecord(snapshot, {
            accountReference: policy.accountReference,
            subdomain: policy.accountReference.slice("zendesk-account:".length),
            agentId: staff.identities.get(member.externalId)!,
            externalId: member.externalId,
            metricKeys: team.metricKeys,
            employeeContext: { employeeId: member.employeeId, teamId: member.teamId },
          })
        );
      collections++;
    }
  }
  return {
    records,
    diagnostics: {
      family: "solved_csat",
      periodStart,
      periodEnd,
      reportingTimeZone: policy.reportingTimeZone,
      policyFingerprint: createHash("sha256").update(JSON.stringify(policy)).digest("hex"),
      activeEmployees: selected.length,
      staffPages: staff.pages,
      staffRecords: staff.staffCount,
      collections,
      paddedTickets: ticketIds.size,
    },
  };
}
