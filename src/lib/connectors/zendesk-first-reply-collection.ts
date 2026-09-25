import { createHash } from "node:crypto";
import { sevenDayPeriodEnd } from "@/lib/domain/metrics/effective-dates";
import {
  firstReplyPolicyForPeriod,
  type ZendeskFirstReplyPolicy,
} from "./zendesk-first-reply-policy";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
import { fetchFirstReplyCandidate } from "./zendesk-first-reply";
import { buildFirstReplyRecord } from "./zendesk-first-reply-record";
import type { IngestedRecord } from "./types";

/** Read-only fetch phase. The caller must use one bounded reader for the entire invocation. */
export async function collectFirstReplyRecords(
  policy: ZendeskFirstReplyPolicy,
  periodStart: string,
  periodEnd: string,
  activeEmployees: Array<{ employeeId: string; teamId: string; externalId: string }>,
  read: (path: string) => Promise<unknown>
) {
  if (
    !firstReplyPolicyForPeriod(policy, policy, periodStart) ||
    periodEnd !== sevenDayPeriodEnd(periodStart)
  )
    throw new Error("First-reply collection interval is outside the prospective policy");
  const selected = activeEmployees.filter((e) => policy.teams.some((t) => t.teamId === e.teamId));
  if (!selected.length || new Set(selected.map((e) => e.employeeId)).size !== selected.length)
    throw new Error("First-reply requires unique active employee bindings");
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
    if (batchSize < 1) throw new Error("First-reply team scope leaves no employee search capacity");
    for (let start = 0; start < members.length; start += batchSize) {
      const batch = members.slice(start, start + batchSize);
      const snapshot = await fetchFirstReplyCandidate(
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
            "First-reply ticket moved between employee collections; repeat observation required"
          );
        ticketIds.add(ticket.id);
      }
      for (const member of batch)
        records.push(
          buildFirstReplyRecord(snapshot, {
            accountReference: policy.accountReference,
            subdomain: policy.accountReference.slice("zendesk-account:".length),
            agentId: staff.identities.get(member.externalId)!,
            externalId: member.externalId,

            employeeContext: { employeeId: member.employeeId, teamId: member.teamId },
          })
        );
      collections++;
    }
  }
  return {
    records,
    diagnostics: {
      family: "created_first_reply",
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
