import { createHash } from "node:crypto";
import { z } from "zod";
import { FIRST_REPLY_CONTRACT } from "@/lib/domain/metrics/source-context";
import { assertZendeskAccountBinding, isZendeskAccountReference } from "./zendesk-account-binding";
import { calculateFirstReply, type fetchFirstReplyCandidate } from "./zendesk-first-reply";
import type { IngestedRecord, NormalizedFactInput } from "./types";

type Snapshot = Awaited<ReturnType<typeof fetchFirstReplyCandidate>>;
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const schema = z.object({
  sourceContract: z.literal(FIRST_REPLY_CONTRACT),
  employeeContext: z.object({ employeeId: z.string().min(1), teamId: z.string().nullable() }),
  sourceEvidence: z.object({
    complete: z.literal(true),
    population: z.literal("all-created-tickets"),
    accountReference: z.string().refine(isZendeskAccountReference),
    observationStartedAt: z.iso.datetime({ offset: true }),
    observationEndedAt: z.iso.datetime({ offset: true }),
    scope: z.object({
      periodStart: z.iso.date(),
      periodEnd: z.iso.date(),
      timeZone: z.string(),
      agentId: id,
      groupIds: z.array(id),
      brandIds: z.array(id).nullable(),
    }),
    tickets: z.array(z.unknown()),
    metrics: z.array(z.unknown()),
  }),
});
function parse(payload: unknown, start: string, end: string) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new Error("Invalid first-reply source evidence");
  const { sourceEvidence: evidence, employeeContext } = parsed.data;
  if (
    evidence.scope.periodStart !== start ||
    evidence.scope.periodEnd !== end ||
    Date.parse(evidence.observationStartedAt) > Date.parse(evidence.observationEndedAt)
  )
    throw new Error("Invalid first-reply publication interval");
  const tickets = evidence.tickets as Snapshot["tickets"],
    metrics = evidence.metrics as Snapshot["metrics"];
  const result = calculateFirstReply(tickets, metrics, evidence.scope);
  const ticketIds = new Set(tickets.map((t) => t.id));
  if (
    tickets.some((t) => t.assignee_id !== evidence.scope.agentId) ||
    metrics.length !== tickets.length ||
    metrics.some((m) => !ticketIds.has(m.ticket_id))
  )
    throw new Error("First-reply employee snapshot has incomplete or foreign evidence");
  const sourceScopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        accountReference: evidence.accountReference,
        agentId: evidence.scope.agentId,
        groupIds: [...evidence.scope.groupIds].sort((a, b) => a - b),
        brandIds:
          evidence.scope.brandIds === null
            ? null
            : [...evidence.scope.brandIds].sort((a, b) => a - b),
      })
    )
    .digest("hex");
  return { evidence, employeeContext, result, sourceScopeFingerprint };
}
export function buildFirstReplyRecord(
  snapshot: Snapshot,
  identity: {
    accountReference: string;
    subdomain: string;
    agentId: number;
    externalId: string;
    employeeContext: { employeeId: string; teamId: string | null };
  }
): IngestedRecord {
  const accountReference = assertZendeskAccountBinding(
    identity.accountReference,
    identity.subdomain
  );
  const c = snapshot.coverage;
  if (
    !c.complete ||
    c.population !== "all-created-tickets" ||
    !c.agentIds.includes(identity.agentId)
  )
    throw new Error("First-reply identity is outside complete source coverage");
  if (
    !identity.externalId.trim() ||
    identity.externalId !== identity.externalId.trim() ||
    identity.externalId.length > 320
  )
    throw new Error("Invalid first-reply external identity");
  const tickets = snapshot.tickets
    .filter((t) => t.assignee_id === identity.agentId)
    .map((t) => ({
      id: t.id,
      assignee_id: t.assignee_id,
      group_id: t.group_id,
      brand_id: t.brand_id,
      created_at: t.created_at,
    }));
  const ids = new Set(tickets.map((t) => t.id));
  const payload = {
    sourceContract: FIRST_REPLY_CONTRACT,
    employeeContext: identity.employeeContext,
    sourceEvidence: {
      complete: true,
      population: c.population,
      accountReference,
      observationStartedAt: c.observationStartedAt,
      observationEndedAt: c.observationEndedAt,
      scope: {
        periodStart: c.periodStart,
        periodEnd: c.periodEnd,
        timeZone: c.timeZone,
        agentId: identity.agentId,
        groupIds: c.groupIds,
        brandIds: c.brandIds,
      },
      tickets,
      metrics: snapshot.metrics
        .filter((m) => ids.has(m.ticket_id))
        .map((m) => ({
          ticket_id: m.ticket_id,
          reply_time_in_minutes:
            m.reply_time_in_minutes === null
              ? null
              : {
                  business: m.reply_time_in_minutes.business,
                  calendar: m.reply_time_in_minutes.calendar,
                },
        })),
    },
  };
  parse(payload, c.periodStart, c.periodEnd);
  return {
    externalRecordType: "first_reply_summary",
    externalRecordId: `first-reply-${identity.externalId}-${c.periodStart}`,
    employeeExternalId: identity.externalId,
    occurredAt: new Date(c.observationStartedAt),
    sourceUpdatedAt: new Date(c.observationStartedAt),
    periodStart: c.periodStart,
    periodEnd: c.periodEnd,
    payload,
  };
}
export function normalizeFirstReplyRecord(
  payload: unknown,
  employeeId: string,
  teamId: string | null,
  periodStart: string,
  periodEnd: string
): NormalizedFactInput[] {
  const { evidence, employeeContext, result, sourceScopeFingerprint } = parse(
    payload,
    periodStart,
    periodEnd
  );
  if (employeeContext.employeeId !== employeeId || employeeContext.teamId !== teamId)
    throw new Error("First-reply employee or team changed before publication");
  return [
    {
      employeeId,
      teamId,
      periodStart,
      periodEnd,
      factType: "avg_response_time",
      numericValue: result.meanBusinessMinutes,
      textValue: null,
      booleanValue: null,
      unit: "min",
      dimensionsJson: {
        sourceContract: FIRST_REPLY_CONTRACT,
        reportingTimeZone: evidence.scope.timeZone,
        sourceScopeFingerprint,
        sampleCount: result.sampleCount,
        cohortCount: result.cohortIds.length,
        sumBusinessMinutes: result.sumBusinessMinutes,
        cohortTicketIds: result.cohortIds,
        measuredTicketIds: result.measuredIds,
        missingTicketIds: result.missingIds,
        zeroTicketIds: result.zeroIds,
        observationStartedAt: evidence.observationStartedAt,
        observationEndedAt: evidence.observationEndedAt,
      },
    },
  ];
}
