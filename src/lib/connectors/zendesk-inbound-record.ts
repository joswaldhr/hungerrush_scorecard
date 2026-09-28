import { createHash } from "node:crypto";
import { z } from "zod";
import { INBOUND_PARTICIPATION_CONTRACT } from "@/lib/domain/metrics/source-context";
import { sevenDayPeriodEnd } from "@/lib/domain/metrics/effective-dates";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import {
  calculateTalkParticipation,
  talkParticipationCallSchema,
  talkParticipationLegSchema,
  talkParticipationScopeSchema,
} from "./zendesk-talk-participation";
import {
  prepareTalkParticipationObservation,
  type TalkCollectionSnapshot,
} from "./zendesk-talk-observation";
import {
  inboundTalkKeys,
  talkPolicyForPeriod,
  type ZendeskTalkPolicy,
} from "./zendesk-talk-policy";
import type { ConnectorConfig, IngestedRecord, NormalizedFactInput } from "./types";

const scopeSchema = talkParticipationScopeSchema.extend({
  offeredDefinition: z.enum(["accepted-declined-missed", "accepted-declined-missed-unreachable"]),
  legCompletionStatuses: z
    .array(talkParticipationLegSchema.shape.completion_status)
    .min(1)
    .nullable(),
});
const schema = z.object({
  sourceContract: z.literal(INBOUND_PARTICIPATION_CONTRACT),
  employeeContext: z.object({ employeeId: z.string().min(1), teamId: z.string().min(1) }),
  sourceEvidence: z.object({
    accountReference: z.string().refine(isZendeskAccountReference),
    scope: scopeSchema,
    scopeMeaning: z.literal("current-parent-call-group-and-number"),
    metricKeys: z
      .array(z.enum(inboundTalkKeys))
      .min(1)
      .max(inboundTalkKeys.length)
      .refine((keys) => new Set(keys).size === keys.length),
    observationStartedAt: z.iso.datetime({ offset: true }),
    observationEndedAt: z.iso.datetime({ offset: true }),
    sourceIsAtomicSnapshot: z.literal(false),
    calls: z.array(talkParticipationCallSchema),
    legs: z.array(talkParticipationLegSchema),
  }),
});

function parse(payload: unknown, start: string, end: string) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw Error("Invalid inbound publication evidence");
  const { sourceEvidence: evidence, employeeContext } = parsed.data;
  if (
    evidence.scope.periodStart !== start ||
    evidence.scope.periodEnd !== end ||
    end !== sevenDayPeriodEnd(start) ||
    new Date(`${start}T00:00:00Z`).getUTCDay() !== 0 ||
    Date.parse(evidence.observationStartedAt) > Date.parse(evidence.observationEndedAt)
  )
    throw Error("Invalid inbound publication interval");
  const result = calculateTalkParticipation(evidence.calls, evidence.legs, evidence.scope).inbound;
  const callIds = new Set(result.participatingCallIds),
    legIds = new Set(result.selectedLegIds);
  if (
    evidence.calls.some((c) => !callIds.has(c.id)) ||
    evidence.legs.some((l) => !legIds.has(l.id)) ||
    [...evidence.calls, ...evidence.legs].some(
      (r) => Date.parse(r.updated_at) > Date.parse(evidence.observationEndedAt)
    )
  )
    throw Error("Foreign or inconsistent inbound employee evidence");
  const sourceScopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        accountReference: evidence.accountReference,
        agentId: evidence.scope.agentId,
        dateBasis: evidence.scope.dateBasis,
        offeredDefinition: evidence.scope.offeredDefinition,
        groupIds: [...evidence.scope.groupIds].sort((a, b) => a - b),
        phoneNumbers: evidence.scope.phoneNumbers ? [...evidence.scope.phoneNumbers].sort() : null,
        legCompletionStatuses: evidence.scope.legCompletionStatuses
          ? [...evidence.scope.legCompletionStatuses].sort()
          : null,
        scopeMeaning: evidence.scopeMeaning,
      })
    )
    .digest("hex");
  return { evidence, employeeContext, result, sourceScopeFingerprint };
}

/** No runtime publisher invokes this candidate. An explicit qualified scope is required. */
export function buildInboundRecord(
  snapshot: TalkCollectionSnapshot,
  policy: ZendeskTalkPolicy,
  config: ConnectorConfig,
  identity: { employeeId: string; teamId: string; agentId: number; externalId: string },
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const owned = talkPolicyForPeriod(policy, config, periodStart);
  const team = owned?.teams.find((t) => t.teamId === identity.teamId);
  if (!team?.inbound || periodEnd !== sevenDayPeriodEnd(periodStart))
    throw Error("Inbound publication is outside the prospective team policy");
  if (
    !identity.externalId.trim() ||
    identity.externalId.trim() !== identity.externalId ||
    identity.externalId.length > 320
  )
    throw Error("Invalid inbound external identity");
  const scope = scopeSchema.parse({
    periodStart,
    periodEnd,
    timeZone: policy.reportingTimeZone,
    agentId: identity.agentId,
    ...team.inbound,
  });
  const qualified = prepareTalkParticipationObservation(
    snapshot,
    policy.accountReference,
    scope,
    policy.observationLimits,
    now
  );
  const callIds = new Set(qualified.result.inbound.participatingCallIds),
    legIds = new Set(qualified.result.inbound.selectedLegIds);
  const payload = {
    sourceContract: INBOUND_PARTICIPATION_CONTRACT,
    employeeContext: { employeeId: identity.employeeId, teamId: identity.teamId },
    sourceEvidence: {
      accountReference: policy.accountReference,
      scope,
      scopeMeaning: team.inbound.scopeMeaning,
      metricKeys: team.inbound.metricKeys,
      observationStartedAt: qualified.provenance.observationStartedAt,
      observationEndedAt: qualified.provenance.observationEndedAt,
      sourceIsAtomicSnapshot: false,
      calls: snapshot.calls
        .filter((c) => callIds.has(c.id))
        .map((c) => talkParticipationCallSchema.parse(c)),
      legs: snapshot.legs
        .filter((l) => legIds.has(l.id))
        .map((l) => talkParticipationLegSchema.parse(l)),
    },
  };
  parse(payload, periodStart, periodEnd);
  return {
    externalRecordType: "inbound_participation_summary",
    externalRecordId: `inbound-participation-${identity.externalId}-${periodStart}`,
    employeeExternalId: identity.externalId,
    occurredAt: new Date(qualified.provenance.observationStartedAt),
    sourceUpdatedAt: new Date(qualified.provenance.observationStartedAt),
    periodStart,
    periodEnd,
    payload,
  };
}

export function normalizeInboundRecord(
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
    throw Error("Inbound employee or team changed before publication");
  const values = {
    inbound_calls_offered: result.reportOfferedLegIds.length,
    inbound_calls_accepted: result.acceptedLegIds.length,
    inbound_calls_abandoned_on_hold: result.abandonedOnHoldParticipatingCallIds.length,
    missed_calls: result.missedLegIds.length,
    declined_calls: result.declinedLegIds.length,
    avg_talk_time_inbound: result.durations.talk.meanSeconds,
    avg_hold_time_inbound: result.durations.hold.meanSeconds,
    avg_call_duration_inbound: result.durations.duration.meanSeconds,
    avg_consultation_time_inbound: result.durations.consultation.meanSeconds,
  };
  return evidence.metricKeys.map((key) => {
    const duration =
      key === "avg_talk_time_inbound"
        ? result.durations.talk
        : key === "avg_hold_time_inbound"
          ? result.durations.hold
          : key === "avg_call_duration_inbound"
            ? result.durations.duration
            : key === "avg_consultation_time_inbound"
              ? result.durations.consultation
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
        sourceContract: INBOUND_PARTICIPATION_CONTRACT,
        reportingTimeZone: evidence.scope.timeZone,
        sourceScopeFingerprint,
        dateBasis: evidence.scope.dateBasis,
        offeredDefinition: evidence.scope.offeredDefinition,
        selectedLegIds: result.selectedLegIds,
        participatingCallIds: result.participatingCallIds,
        acceptedLegIds: result.acceptedLegIds,
        offeredLegIds: result.reportOfferedLegIds,
        missedLegIds: result.missedLegIds,
        declinedLegIds: result.declinedLegIds,
        unreachableLegIds: result.unreachableLegIds,
        abandonedOnHoldCallIds: result.abandonedOnHoldParticipatingCallIds,
        ...(duration
          ? {
              sampleCount: duration.sampleCount,
              cohortCount: duration.cohortLegIds.length,
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
