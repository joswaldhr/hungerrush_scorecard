import { createHash } from "node:crypto";
import { z } from "zod";
import { OUTBOUND_PARTICIPATION_CONTRACT } from "@/lib/domain/metrics/source-context";
import { sevenDayPeriodEnd } from "@/lib/domain/metrics/effective-dates";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import { calculateOutboundParticipation, outboundCallSchema } from "./zendesk-outbound";
import { prepareOutboundObservation } from "./zendesk-outbound-observation";
import { talkParticipationLegSchema } from "./zendesk-talk-participation";
import {
  outboundTicketMetadataSchema,
  type collectOutboundTicketGroups,
} from "./zendesk-outbound-tickets";
import {
  outboundTalkKeys,
  talkPolicyForPeriod,
  type ZendeskTalkPolicy,
} from "./zendesk-talk-policy";
import type { TalkCollectionSnapshot } from "./zendesk-talk-observation";
import type { ConnectorConfig, IngestedRecord, NormalizedFactInput } from "./types";

const id = z.number().int().positive().safe();
const schema = z.object({
  sourceContract: z.literal(OUTBOUND_PARTICIPATION_CONTRACT),
  employeeContext: z.object({ employeeId: z.string().min(1), teamId: z.string().min(1) }),
  sourceEvidence: z.object({
    accountReference: z.string().refine(isZendeskAccountReference),
    scope: z.object({
      periodStart: z.iso.date(),
      periodEnd: z.iso.date(),
      timeZone: z.string().min(1),
      agentId: id,
      ticketGroupIds: z.array(id).min(1),
    }),
    metricKeys: z
      .array(z.enum(outboundTalkKeys))
      .min(1)
      .max(outboundTalkKeys.length)
      .refine((keys) => new Set(keys).size === keys.length),
    observationStartedAt: z.iso.datetime({ offset: true }),
    observationEndedAt: z.iso.datetime({ offset: true }),
    callPopulationDigest: z.string().regex(/^[a-f0-9]{64}$/),
    sourceIsAtomicSnapshot: z.literal(false),
    ticketScopeMeaning: z.literal("current-linked-ticket-group"),
    calls: z.array(outboundCallSchema),
    legs: z.array(talkParticipationLegSchema),
    tickets: z.array(outboundTicketMetadataSchema),
  }),
});
function parse(payload: unknown, start: string, end: string) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw Error("Invalid outbound publication evidence");
  const { sourceEvidence: evidence, employeeContext } = parsed.data;
  if (
    evidence.scope.periodStart !== start ||
    evidence.scope.periodEnd !== end ||
    end !== sevenDayPeriodEnd(start) ||
    new Date(`${start}T00:00:00Z`).getUTCDay() !== 0 ||
    Date.parse(evidence.observationStartedAt) > Date.parse(evidence.observationEndedAt)
  )
    throw Error("Invalid outbound publication interval");
  const result = calculateOutboundParticipation(
    evidence.calls,
    evidence.tickets,
    evidence.legs,
    evidence.scope
  );
  const callIds = new Set(result.attemptedCallIds),
    legIds = new Set(result.selectedLegIds);
  const ticketIds = new Set(evidence.calls.map((c) => c.ticket_id));
  if (
    evidence.calls.some((c) => !callIds.has(c.id)) ||
    evidence.legs.some((l) => !legIds.has(l.id)) ||
    evidence.tickets.length !== ticketIds.size ||
    evidence.tickets.some((t) => !ticketIds.has(t.id)) ||
    [...evidence.calls, ...evidence.legs, ...evidence.tickets].some(
      (row) => Date.parse(row.updated_at) > Date.parse(evidence.observationEndedAt)
    )
  )
    throw Error("Foreign or inconsistent outbound employee evidence");
  const sourceScopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        accountReference: evidence.accountReference,
        agentId: evidence.scope.agentId,
        ticketGroupIds: [...evidence.scope.ticketGroupIds].sort((a, b) => a - b),
        dateBasis: "call-created",
        ticketScopeMeaning: evidence.ticketScopeMeaning,
      })
    )
    .digest("hex");
  return { evidence, employeeContext, result, sourceScopeFingerprint };
}

/** Inactive builder: validate the full joined observation before retaining employee-specific replay evidence. */
export function buildOutboundRecord(
  snapshot: TalkCollectionSnapshot,
  tickets: Awaited<ReturnType<typeof collectOutboundTicketGroups>>,
  policy: ZendeskTalkPolicy,
  config: ConnectorConfig,
  identity: { employeeId: string; teamId: string; agentId: number; externalId: string },
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const owned = talkPolicyForPeriod(policy, config, periodStart);
  const team = owned?.teams.find((t) => t.teamId === identity.teamId);
  if (!team?.outbound || periodEnd !== sevenDayPeriodEnd(periodStart))
    throw Error("Outbound publication is outside the prospective team policy");
  if (
    !identity.externalId.trim() ||
    identity.externalId.trim() !== identity.externalId ||
    identity.externalId.length > 320
  )
    throw Error("Invalid outbound external identity");
  const scope = {
    periodStart,
    periodEnd,
    timeZone: policy.reportingTimeZone,
    agentId: identity.agentId,
    ticketGroupIds: team.outbound.ticketGroupIds,
  };
  const qualified = prepareOutboundObservation(
    snapshot,
    tickets,
    policy.accountReference,
    scope,
    policy.observationLimits,
    now
  );
  const callIds = new Set(qualified.result.attemptedCallIds),
    legIds = new Set(qualified.result.selectedLegIds);
  const calls = snapshot.calls
    .filter((c) => callIds.has(c.id))
    .map((c) => outboundCallSchema.parse({ ...c, call_group_id: null, phone_number: null }));
  const ticketIds = new Set(calls.map((c) => c.ticket_id));
  const payload = {
    sourceContract: OUTBOUND_PARTICIPATION_CONTRACT,
    employeeContext: { employeeId: identity.employeeId, teamId: identity.teamId },
    sourceEvidence: {
      accountReference: policy.accountReference,
      scope,
      metricKeys: team.outbound.metricKeys,
      observationStartedAt: qualified.provenance.observationStartedAt,
      observationEndedAt: qualified.provenance.observationEndedAt,
      callPopulationDigest: qualified.provenance.callPopulationDigest,
      sourceIsAtomicSnapshot: false,
      ticketScopeMeaning: qualified.provenance.ticketScopeMeaning,
      calls,
      legs: snapshot.legs
        .filter((l) => legIds.has(l.id))
        .map((l) => talkParticipationLegSchema.parse(l)),
      tickets: tickets.tickets
        .filter((t) => ticketIds.has(t.id))
        .map((t) => outboundTicketMetadataSchema.parse(t)),
    },
  };
  parse(payload, periodStart, periodEnd);
  return {
    externalRecordType: "outbound_participation_summary",
    externalRecordId: `outbound-participation-${identity.externalId}-${periodStart}`,
    employeeExternalId: identity.externalId,
    occurredAt: new Date(qualified.provenance.observationStartedAt),
    sourceUpdatedAt: new Date(qualified.provenance.observationStartedAt),
    periodStart,
    periodEnd,
    payload,
  };
}

export function normalizeOutboundRecord(
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
    throw Error("Outbound employee or team changed before publication");
  const values = {
    outbound_calls: result.attempted,
    outbound_calls_completed: result.completed,
    outbound_calls_non_answered: result.nonAnswered,
    avg_talk_time_outbound: result.talk.meanSeconds,
    avg_hold_time_outbound: result.hold.meanSeconds,
  };
  return evidence.metricKeys.map((key) => {
    const duration =
      key === "avg_talk_time_outbound"
        ? result.talk
        : key === "avg_hold_time_outbound"
          ? result.hold
          : null;
    return {
      employeeId,
      teamId,
      periodStart,
      periodEnd,
      factType: key,
      numericValue: values[key],
      textValue: null,
      booleanValue: null,
      unit: duration ? "s" : "count",
      dimensionsJson: {
        sourceContract: OUTBOUND_PARTICIPATION_CONTRACT,
        reportingTimeZone: evidence.scope.timeZone,
        sourceScopeFingerprint,
        attemptedCallIds: result.attemptedCallIds,
        completedCallIds: result.completedCallIds,
        nonAnsweredCallIds: result.nonAnsweredCallIds,
        unclassifiedCallIds: result.unclassifiedCallIds,
        abandonedOnHoldCallIds: result.abandonedOnHoldCallIds,
        selectedLegIds: result.selectedLegIds,
        ...(duration
          ? {
              sampleCount: duration.sampleCount,
              cohortCount: result.selectedLegIds.length,
              sumSeconds: duration.sumSeconds,
              measuredLegIds: duration.measuredLegIds,
              missingLegIds: duration.missingLegIds,
              zeroLegIds: duration.zeroLegIds,
            }
          : {}),
        observationStartedAt: evidence.observationStartedAt,
        observationEndedAt: evidence.observationEndedAt,
      },
    };
  });
}
