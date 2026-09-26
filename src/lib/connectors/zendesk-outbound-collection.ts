import { createHash } from "node:crypto";
import { sevenDayPeriodEnd } from "@/lib/domain/metrics/effective-dates";
import { resolveCsatStaffIdentities } from "./zendesk-csat-identity";
import { collectOutboundTicketGroups } from "./zendesk-outbound-tickets";
import { buildOutboundRecord } from "./zendesk-outbound-record";
import { talkPolicyForPeriod, type ZendeskTalkPolicy } from "./zendesk-talk-policy";
import { validateTalkObservation, type TalkCollectionSnapshot } from "./zendesk-talk-observation";
import type { ConnectorConfig } from "./types";

/** No Talk requests here: use one immutable durable snapshot plus bounded Support GETs. */
export async function collectOutboundRecords(
  snapshot: TalkCollectionSnapshot,
  policy: ZendeskTalkPolicy,
  config: ConnectorConfig,
  periodStart: string,
  periodEnd: string,
  employees: Array<{ employeeId: string; teamId: string; externalId: string }>,
  read: (path: string) => Promise<unknown>,
  now: () => Date = () => new Date()
) {
  if (
    !talkPolicyForPeriod(policy, config, periodStart) ||
    periodEnd !== sevenDayPeriodEnd(periodStart)
  )
    throw Error("Outbound collection is outside the prospective policy");
  const teamIds = new Set(policy.teams.filter((t) => t.outbound !== null).map((t) => t.teamId));
  if (
    !teamIds.size ||
    !employees.length ||
    employees.some((e) => !teamIds.has(e.teamId)) ||
    new Set(employees.map((e) => e.employeeId)).size !== employees.length
  )
    throw Error("Outbound requires unique, policy-bound employee identities");
  const scope = {
    accountReference: policy.accountReference,
    periodStart,
    periodEnd,
    timeZone: policy.reportingTimeZone,
  };
  // Reject an unusable durable snapshot before consuming any vendor budget.
  validateTalkObservation(
    snapshot,
    policy.accountReference,
    scope,
    policy.observationLimits,
    now()
  );
  const staff = await resolveCsatStaffIdentities(
    employees.map((e) => e.externalId),
    read
  );
  const tickets = await collectOutboundTicketGroups(snapshot.calls, scope, read);
  const records = employees.map((employee) =>
    buildOutboundRecord(
      snapshot,
      tickets,
      policy,
      config,
      { ...employee, agentId: staff.identities.get(employee.externalId)! },
      periodStart,
      periodEnd,
      now()
    )
  );
  return {
    records,
    diagnostics: {
      family: "outbound_call_participation",
      periodStart,
      periodEnd,
      reportingTimeZone: policy.reportingTimeZone,
      policyFingerprint: createHash("sha256").update(JSON.stringify(policy)).digest("hex"),
      activeEmployees: employees.length,
      staffPages: staff.pages,
      sourceCalls: snapshot.calls.length,
      sourceLegs: snapshot.legs.length,
      linkedTickets: tickets.tickets.length,
      ticketRequests: tickets.coverage.requests,
      sourceIsAtomicSnapshot: false,
    },
  };
}
