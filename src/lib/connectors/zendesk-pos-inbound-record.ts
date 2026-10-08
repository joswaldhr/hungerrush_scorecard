import { createHash } from "node:crypto";
import { z } from "zod";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import {
  calculatePosInboundReport,
  POS_INBOUND_REPORT_CONTRACT,
  posInboundCallSchema,
  posInboundReportKeys,
  posInboundScopeSchema,
} from "./zendesk-pos-inbound-report";
import { talkParticipationLegSchema } from "./zendesk-talk-participation";
import { validateTalkObservation, type TalkCollectionSnapshot } from "./zendesk-talk-observation";
import type { ConnectorConfig, IngestedRecord, NormalizedFactInput } from "./types";

const sunday = z.iso.date().refine((day) => new Date(`${day}T00:00:00Z`).getUTCDay() === 0);
const keys = z
  .array(z.enum(posInboundReportKeys))
  .min(1)
  .max(posInboundReportKeys.length)
  .refine((values) => new Set(values).size === values.length);
const limits = z
  .object({
    maxAgeMs: z
      .number()
      .int()
      .min(1)
      .max(26 * 3600000),
    maxSpanMs: z.number().int().min(1).max(3600000),
  })
  .strict();
export const posInboundPolicySchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: z.uuid(),
    dataSourceId: z.uuid(),
    teamId: z.uuid(),
    accountReference: z.string().refine(isZendeskAccountReference),
    effectivePeriodStart: sunday,
    timeZone: z.string().min(1),
    groupIds: posInboundScopeSchema.shape.groupIds,
    phoneNumbers: posInboundScopeSchema.shape.phoneNumbers,
    dateBasis: z.literal("leg-created"),
    metricKeys: keys,
    observationLimits: limits,
  })
  .strict();
export type PosInboundPolicy = z.infer<typeof posInboundPolicySchema>;
export function parsePosInboundPolicy(input: unknown): PosInboundPolicy {
  const policy = posInboundPolicySchema.parse(input);
  return {
    ...policy,
    timeZone: new Intl.DateTimeFormat("en", { timeZone: policy.timeZone }).resolvedOptions()
      .timeZone,
  };
}

const streamSchema = z
  .object({
    startedAt: z.iso.datetime({ offset: true }),
    endedAt: z.iso.datetime({ offset: true }),
    watermark: z.number().int().nonnegative().safe(),
    cycle: z.number().int().positive().safe(),
  })
  .strict();
export const posInboundPayloadSchema = z
  .object({
    sourceContract: z.literal(POS_INBOUND_REPORT_CONTRACT),
    policy: posInboundPolicySchema,
    employeeContext: z.object({ employeeId: z.uuid(), teamId: z.uuid() }).strict(),
    sourceEvidence: z
      .object({
        scope: posInboundScopeSchema,
        validatedAt: z.iso.datetime({ offset: true }),
        bootstrapStart: z.number().int().nonnegative().safe(),
        callsObservation: streamSchema,
        legsObservation: streamSchema,
        sourceIsAtomicSnapshot: z.literal(false),
        calls: z.array(posInboundCallSchema),
        legs: z.array(talkParticipationLegSchema),
      })
      .strict(),
  })
  .strict();

function localDay(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Replay both calculation and coverage. Observation boundaries are not source-event watermarks. */
export function replayPosInboundRecord(payload: unknown, periodStart: string, periodEnd: string) {
  const value = posInboundPayloadSchema.parse(payload);
  const policy = parsePosInboundPolicy(value.policy),
    e = value.sourceEvidence,
    scope = e.scope;
  const sorted = (items: readonly (string | number)[] | null) =>
    items === null ? null : JSON.stringify([...items].sort());
  if (
    !sunday.safeParse(periodStart).success ||
    Date.parse(periodEnd) - Date.parse(periodStart) !== 6 * 86400000 ||
    scope.periodStart !== periodStart ||
    scope.periodEnd !== periodEnd ||
    periodStart < policy.effectivePeriodStart ||
    value.employeeContext.teamId !== policy.teamId ||
    scope.timeZone !== policy.timeZone ||
    scope.dateBasis !== policy.dateBasis ||
    sorted(scope.groupIds) !== sorted(policy.groupIds) ||
    sorted(scope.phoneNumbers) !== sorted(policy.phoneNumbers)
  )
    throw Error("POS inbound record differs from its prospective week policy");
  const streams = [e.callsObservation, e.legsObservation];
  const starts = streams.map((s) => Date.parse(s.startedAt)),
    ends = streams.map((s) => Date.parse(s.endedAt));
  const validated = Date.parse(e.validatedAt);
  if (
    streams.some(
      (s, i) =>
        starts[i]! > ends[i]! ||
        ends[i]! > validated ||
        s.watermark * 1000 > ends[i]! ||
        s.watermark < e.bootstrapStart
    ) ||
    validated - Math.min(...ends) > policy.observationLimits.maxAgeMs ||
    Math.max(...ends) - Math.min(...starts) > policy.observationLimits.maxSpanMs ||
    e.bootstrapStart * 1000 > Date.parse(periodStart) - 86400000
  )
    throw Error("Invalid POS inbound source observation coverage");
  const observationStartedAt = new Date(Math.min(...starts)).toISOString();
  const observationEndedAt = new Date(Math.max(...ends)).toISOString();
  const observedDay = localDay(Math.min(...starts), scope.timeZone);
  const validationDay = localDay(validated, scope.timeZone);
  if (validationDay < periodStart || observedDay < periodStart)
    throw Error("POS inbound week has not been observed");
  // A fresh terminal response cannot certify a closed week if either stream began
  // before its end. A new overlap collection is required after the local boundary.
  if (validationDay > periodEnd && observedDay <= periodEnd)
    throw Error("POS inbound closed week requires both collections after period end");
  const coverageMode = validationDay > periodEnd ? "closed-week-observation" : "in-progress";
  const result = calculatePosInboundReport(e.calls, e.legs, scope);
  const callIds = new Set(result.participatingCallIds),
    legIds = new Set(result.selectedLegIds);
  if (
    e.calls.some((c) => !callIds.has(c.id) || Date.parse(c.updated_at) > ends[0]!) ||
    e.legs.some((l) => !legIds.has(l.id) || Date.parse(l.updated_at) > ends[1]!)
  )
    throw Error("Foreign or inconsistent POS employee evidence");
  const sourceScopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        contract: POS_INBOUND_REPORT_CONTRACT,
        accountReference: policy.accountReference,
        agentId: scope.agentId,
        timeZone: scope.timeZone,
        dateBasis: scope.dateBasis,
        groupIds: [...scope.groupIds].sort((a, b) => a - b),
        phoneNumbers: scope.phoneNumbers === null ? null : [...scope.phoneNumbers].sort(),
      })
    )
    .digest("hex");
  return {
    ...value,
    policy,
    result,
    sourceScopeFingerprint,
    coverageMode,
    observationStartedAt,
    observationEndedAt,
  };
}

/** Inactive candidate; later live binding checks and a scoped release are still required. */
export function buildPosInboundRecord(
  snapshot: TalkCollectionSnapshot,
  input: PosInboundPolicy,
  config: ConnectorConfig,
  identity: { employeeId: string; teamId: string; agentId: number; externalId: string },
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const policy = parsePosInboundPolicy(input);
  if (
    policy.organizationId !== config.organizationId ||
    policy.dataSourceId !== config.dataSourceId ||
    policy.teamId !== identity.teamId
  )
    throw Error("POS inbound source/organization/team mismatch");
  if (
    !identity.externalId.trim() ||
    identity.externalId !== identity.externalId.trim() ||
    identity.externalId.length > 320
  )
    throw Error("Invalid POS inbound external identity");
  const scope = {
    periodStart,
    periodEnd,
    timeZone: policy.timeZone,
    agentId: identity.agentId,
    groupIds: policy.groupIds,
    phoneNumbers: policy.phoneNumbers,
    dateBasis: policy.dateBasis,
  };
  validateTalkObservation(snapshot, policy.accountReference, scope, policy.observationLimits, now);
  const result = calculatePosInboundReport(snapshot.calls, snapshot.legs, scope);
  const calls = new Set(result.participatingCallIds),
    legs = new Set(result.selectedLegIds);
  const observation = (state: TalkCollectionSnapshot["callsState"]) => ({
    startedAt: state.observationStartedAt,
    endedAt: state.lastPageAt!,
    watermark: state.cursor.watermark,
    cycle: state.cycle,
  });
  const payload = {
    sourceContract: POS_INBOUND_REPORT_CONTRACT,
    policy,
    employeeContext: { employeeId: identity.employeeId, teamId: identity.teamId },
    sourceEvidence: {
      scope,
      validatedAt: now.toISOString(),
      bootstrapStart: snapshot.bootstrapStart,
      callsObservation: observation(snapshot.callsState),
      legsObservation: observation(snapshot.legsState),
      sourceIsAtomicSnapshot: false,
      calls: snapshot.calls
        .filter((c) => calls.has(c.id))
        .map((c) => posInboundCallSchema.parse(c)),
      legs: snapshot.legs
        .filter((l) => legs.has(l.id))
        .map((l) => talkParticipationLegSchema.parse(l)),
    },
  };
  const replay = replayPosInboundRecord(payload, periodStart, periodEnd);
  return {
    externalRecordType: "pos_inbound_report_candidate",
    externalRecordId: `pos-inbound-report-${identity.externalId}-${periodStart}`,
    employeeExternalId: identity.externalId,
    periodStart,
    periodEnd,
    payload,
    occurredAt: new Date(replay.observationStartedAt),
    sourceUpdatedAt: new Date(replay.observationStartedAt),
  };
}

export function normalizePosInboundRecord(
  payload: unknown,
  employeeId: string,
  teamId: string | null,
  periodStart: string,
  periodEnd: string
): NormalizedFactInput[] {
  const r = replayPosInboundRecord(payload, periodStart, periodEnd);
  if (r.employeeContext.employeeId !== employeeId || r.employeeContext.teamId !== teamId)
    throw Error("POS inbound employee or team changed before publication");
  const durations = {
    avg_talk_time_inbound: r.result.durations.talk,
    avg_hold_time_inbound: r.result.durations.callHoldWeightedByLeg,
    avg_call_duration_inbound: r.result.durations.duration,
    avg_consultation_time_inbound: r.result.durations.consultation,
  };
  return r.policy.metricKeys.map((key) => {
    const duration = durations[key as keyof typeof durations];
    return {
      employeeId,
      teamId,
      periodStart,
      periodEnd,
      factType: key,
      numericValue: r.result.values[key],
      textValue: null,
      booleanValue: null,
      unit: duration ? "s" : "count",
      dimensionsJson: {
        sourceContract: POS_INBOUND_REPORT_CONTRACT,
        reportingTimeZone: r.sourceEvidence.scope.timeZone,
        sourceScopeFingerprint: r.sourceScopeFingerprint,
        publicationEligible: false,
        dateBasis: "leg-created",
        coverageMode: r.coverageMode,
        sourceIsAtomicSnapshot: false,
        observationStartedAt: r.observationStartedAt,
        observationEndedAt: r.observationEndedAt,
        selectedLegIds: r.result.selectedLegIds,
        participatingCallIds: r.result.participatingCallIds,
        acceptedLegIds: r.result.acceptedLegIds,
        uncertainAcceptedLegIds: r.result.uncertainAcceptedLegIds,
        declinedLegIds: r.result.declinedLegIds,
        missedLegIds: r.result.missedLegIds,
        ...(duration ? { aggregation: "mean", ...duration } : {}),
        ...(key === "avg_hold_time_inbound"
          ? { durationBasis: "whole-call-hold-weighted-per-selected-leg" }
          : {}),
      },
    };
  });
}
