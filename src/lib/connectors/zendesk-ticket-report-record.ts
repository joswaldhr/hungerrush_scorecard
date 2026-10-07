import { createHash } from "node:crypto";
import { z } from "zod";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import {
  calculateTicketReportCredits,
  ticketReportCreditSnapshotSchema,
  type TicketReportCreditScope,
} from "./zendesk-ticket-report-credits";
import {
  calculateAssigneeSolvedReport,
  assigneeSolvedReportSnapshotSchema,
  type AssigneeSolvedReportScope,
} from "./zendesk-assignee-solved-report";
import type { IngestedRecord } from "./types";

const identitySchema = z.object({
  accountReference: z.string(),
  subdomain: z.string(),
  agentId: z.number().int().positive().safe(),
  externalId: z
    .string()
    .min(1)
    .max(320)
    .refine((s) => s.trim() === s),
  employeeId: z.uuid(),
  teamId: z.uuid(),
  observationStartedAt: z.iso.datetime({ offset: true }),
});
export type TicketReportIdentity = z.infer<typeof identitySchema>;

type ReportSelection =
  | { kind: "updater"; scope: TicketReportCreditScope }
  | { kind: "assignee-solved"; scope: AssigneeSolvedReportScope };

/**
 * Inactive ingestion boundary. Recompute from minimized evidence rather than accepting
 * caller-provided totals. The ordinary sync engine explicitly rejects this record type
 * and both contracts until their release qualification is implemented.
 */
export function buildTicketReportCandidateRecord(
  input: unknown,
  selection: ReportSelection,
  identityInput: TicketReportIdentity
): IngestedRecord {
  const identity = identitySchema.parse(identityInput);
  const accountReference = assertZendeskAccountBinding(
    identity.accountReference,
    identity.subdomain
  );
  if (!selection.scope.agentIds.includes(identity.agentId))
    throw new Error("Ticket report employee is outside source scope");
  const scope = { ...selection.scope, agentIds: [identity.agentId] };
  let source: Record<string, unknown>;
  let result: Record<string, unknown>;
  let sourceContract: string;
  let observedAt: string;
  if (selection.kind === "updater") {
    const parsed = ticketReportCreditSnapshotSchema.parse(input);
    // Validate the complete supplied capture before minimizing it for this employee.
    calculateTicketReportCredits(parsed, selection.scope);
    const events = parsed.events.filter((e) => e.updater_id === identity.agentId);
    const parents = new Set(events.map((e) => e.ticket_id));
    const minimized = {
      ...parsed,
      events,
      tickets: parsed.tickets.filter((t) => parents.has(t.id)),
      deletedTickets: parsed.deletedTickets.filter((t) => parents.has(t.id)),
      identities: parsed.identities.filter((i) => i.id === identity.agentId),
    };
    const calculated = calculateTicketReportCredits(minimized, scope as TicketReportCreditScope);
    source = minimized;
    result = calculated.agents[0]!;
    sourceContract = calculated.contract;
    observedAt = calculated.observedAt;
  } else {
    const parsed = assigneeSolvedReportSnapshotSchema.parse(input);
    calculateAssigneeSolvedReport(parsed, selection.scope);
    const minimized = {
      ...parsed,
      tickets: parsed.tickets.filter((t) => t.assignee_id === identity.agentId),
    };
    const calculated = calculateAssigneeSolvedReport(minimized, scope as AssigneeSolvedReportScope);
    source = minimized;
    result = calculated.agents[0]!;
    sourceContract = calculated.contract;
    observedAt = calculated.observedAt;
  }
  if (Date.parse(identity.observationStartedAt) > Date.parse(observedAt))
    throw new Error("Invalid ticket report observation interval");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        accountReference,
        sourceContract,
        agentId: identity.agentId,
        employeeId: identity.employeeId,
        teamId: identity.teamId,
        timeZone: new Intl.DateTimeFormat("en", { timeZone: scope.timeZone }).resolvedOptions()
          .timeZone,
        groupIds: scope.groupIds === null ? null : [...scope.groupIds].sort((a, b) => a - b),
        brandIds: scope.brandIds === null ? null : [...scope.brandIds].sort((a, b) => a - b),
      })
    )
    .digest("hex");
  return {
    externalRecordType: "ticket_report_credit_candidate",
    externalRecordId: `${sourceContract}:${identity.agentId}:${scope.periodStart}:${scope.periodEnd}`,
    employeeExternalId: identity.externalId,
    occurredAt: new Date(identity.observationStartedAt),
    sourceUpdatedAt: new Date(identity.observationStartedAt),
    periodStart: scope.periodStart,
    periodEnd: scope.periodEnd,
    payload: {
      sourceContract,
      publicationEligible: false,
      qualification: "candidate",
      accountReference,
      employeeContext: { employeeId: identity.employeeId, teamId: identity.teamId },
      sourceScopeFingerprint: fingerprint,
      reportingTimeZone: scope.timeZone,
      observationStartedAt: identity.observationStartedAt,
      observationEndedAt: observedAt,
      scope,
      sourceEvidence: source,
      result,
    },
  };
}
