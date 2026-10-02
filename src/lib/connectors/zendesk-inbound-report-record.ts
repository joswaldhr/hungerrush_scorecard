import { createHash } from "node:crypto";
import { z } from "zod";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import { validateTalkObservation, type TalkCollectionSnapshot } from "./zendesk-talk-observation";
import {
  talkParticipationCallSchema,
  talkParticipationLegSchema,
} from "./zendesk-talk-participation";
import {
  calculateInboundReport,
  inboundReportKeys,
  inboundReportScopeSchema,
  INBOUND_REPORT_CONTRACT,
} from "./zendesk-inbound-report";
import type { ConnectorConfig, IngestedRecord, NormalizedFactInput } from "./types";

const week = z.iso.date().refine((s) => new Date(`${s}T00:00:00Z`).getUTCDay() === 0);
const metricKeys = z
  .array(z.enum(inboundReportKeys))
  .min(1)
  .max(inboundReportKeys.length)
  .refine((keys) => new Set(keys).size === keys.length);
export const policySchema = z
  .object({
    schemaVersion: z.literal(1),
    organizationId: z.uuid(),
    dataSourceId: z.uuid(),
    teamId: z.uuid(),
    accountReference: z.string().refine(isZendeskAccountReference),
    effectivePeriodStart: week,
    timeZone: z.string().min(1),
    groupIds: inboundReportScopeSchema.shape.groupIds,
    phoneNumbers: inboundReportScopeSchema.shape.phoneNumbers,
    dateBasis: inboundReportScopeSchema.shape.dateBasis,
    offeredDefinition: inboundReportScopeSchema.shape.offeredDefinition,
    metricKeys,
    observationLimits: z
      .object({
        maxAgeMs: z
          .number()
          .int()
          .min(1)
          .max(26 * 3600000),
        maxSpanMs: z.number().int().min(1).max(3600000),
      })
      .strict(),
  })
  .strict();
export type InboundReportPolicy = z.infer<typeof policySchema>;
// This policy is deliberately not registered with env, a connector, a cron or sync-engine.
export function parseInboundReportPolicy(input: unknown): InboundReportPolicy {
  const policy = policySchema.parse(input);
  return {
    ...policy,
    timeZone: new Intl.DateTimeFormat("en", { timeZone: policy.timeZone }).resolvedOptions()
      .timeZone,
  };
}
export const payloadSchema = z
  .object({
    sourceContract: z.literal(INBOUND_REPORT_CONTRACT),
    employeeContext: z.object({ employeeId: z.string().min(1), teamId: z.uuid() }).strict(),
    sourceEvidence: z
      .object({
        accountReference: z.string().refine(isZendeskAccountReference),
        scope: inboundReportScopeSchema,
        metricKeys,
        observationStartedAt: z.iso.datetime({ offset: true }),
        observationEndedAt: z.iso.datetime({ offset: true }),
        sourceIsAtomicSnapshot: z.literal(false),
        independentMetricQualificationComplete: z.literal(false),
        calls: z.array(talkParticipationCallSchema),
        legs: z.array(talkParticipationLegSchema),
      })
      .strict(),
  })
  .strict();
function replay(payload: unknown, periodStart: string, periodEnd: string) {
  const parsed = payloadSchema.parse(payload),
    e = parsed.sourceEvidence;
  if (
    e.scope.periodStart !== periodStart ||
    e.scope.periodEnd !== periodEnd ||
    Date.parse(e.observationStartedAt) > Date.parse(e.observationEndedAt)
  )
    throw Error("Inbound evidence interval mismatch");
  const result = calculateInboundReport(e.calls, e.legs, e.scope);
  const callIds = new Set(result.participatingCallIds),
    legIds = new Set(result.selectedLegIds);
  if (
    e.calls.some((c) => !callIds.has(c.id)) ||
    e.legs.some((l) => !legIds.has(l.id)) ||
    [...e.calls, ...e.legs].some((r) => Date.parse(r.updated_at) > Date.parse(e.observationEndedAt))
  )
    throw Error("Foreign or inconsistent inbound employee evidence");
  const sourceScopeFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        contract: INBOUND_REPORT_CONTRACT,
        accountReference: e.accountReference,
        agentId: e.scope.agentId,
        timeZone: e.scope.timeZone,
        dateBasis: e.scope.dateBasis,
        offeredDefinition: e.scope.offeredDefinition,
        groupIds: [...e.scope.groupIds].sort((a, b) => a - b),
        phoneNumbers: [...e.scope.phoneNumbers].sort(),
      })
    )
    .digest("hex");
  return { ...parsed, result, sourceScopeFingerprint };
}

/** Inactive, side-effect-free record builder. Live assignment/identity and atomic publication gates remain required. */
export function buildInboundReportRecord(
  snapshot: TalkCollectionSnapshot,
  input: InboundReportPolicy,
  config: ConnectorConfig,
  identity: { employeeId: string; teamId: string; agentId: number; externalId: string },
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const policy = parseInboundReportPolicy(input);
  if (
    policy.organizationId !== config.organizationId ||
    policy.dataSourceId !== config.dataSourceId ||
    identity.teamId !== policy.teamId
  )
    throw Error("Inbound source/organization/team policy mismatch");
  if (periodStart < policy.effectivePeriodStart)
    throw Error("Inbound period precedes prospective cutover");
  if (
    !identity.externalId.trim() ||
    identity.externalId.trim() !== identity.externalId ||
    identity.externalId.length > 320
  )
    throw Error("Invalid inbound external identity");
  const scope = {
    periodStart,
    periodEnd,
    timeZone: policy.timeZone,
    agentId: identity.agentId,
    groupIds: policy.groupIds,
    phoneNumbers: policy.phoneNumbers,
    dateBasis: policy.dateBasis,
    offeredDefinition: policy.offeredDefinition,
  };
  const observed = validateTalkObservation(
    snapshot,
    policy.accountReference,
    scope,
    policy.observationLimits,
    now
  );
  const result = calculateInboundReport(snapshot.calls, snapshot.legs, scope);
  const callIds = new Set(result.participatingCallIds),
    legIds = new Set(result.selectedLegIds);
  const payload = {
    sourceContract: INBOUND_REPORT_CONTRACT,
    employeeContext: { employeeId: identity.employeeId, teamId: identity.teamId },
    sourceEvidence: {
      accountReference: policy.accountReference,
      scope,
      metricKeys: policy.metricKeys,
      observationStartedAt: observed.observationStartedAt,
      observationEndedAt: observed.observationEndedAt,
      sourceIsAtomicSnapshot: false,
      independentMetricQualificationComplete: false,
      calls: snapshot.calls
        .filter((c) => callIds.has(c.id))
        .map((c) => talkParticipationCallSchema.parse(c)),
      legs: snapshot.legs
        .filter((l) => legIds.has(l.id))
        .map((l) => talkParticipationLegSchema.parse(l)),
    },
  };
  replay(payload, periodStart, periodEnd);
  return {
    externalRecordType: "inbound_report_candidate",
    externalRecordId: `inbound-report-${identity.externalId}-${periodStart}`,
    employeeExternalId: identity.externalId,
    periodStart,
    periodEnd,
    payload,
    occurredAt: new Date(observed.observationStartedAt),
    sourceUpdatedAt: new Date(observed.observationStartedAt),
  };
}

/** Rebuild values from minimized raw evidence; never trust stored numeric totals. Not wired into the live normalizer. */
export function normalizeInboundReportRecord(
  payload: unknown,
  employeeId: string,
  teamId: string | null,
  periodStart: string,
  periodEnd: string
): NormalizedFactInput[] {
  const {
    employeeContext,
    sourceEvidence: e,
    result: r,
    sourceScopeFingerprint,
  } = replay(payload, periodStart, periodEnd);
  if (employeeContext.employeeId !== employeeId || employeeContext.teamId !== teamId)
    throw Error("Inbound employee or team changed before publication");
  return e.metricKeys.map((key) => ({
    employeeId,
    teamId,
    periodStart,
    periodEnd,
    factType: key,
    numericValue: r.values[key],
    textValue: null,
    booleanValue: null,
    unit:
      key === "inbound_calls_answer_rate"
        ? "%"
        : key === "total_talk_time_inbound" || key === "max_hold_time_inbound"
          ? "s"
          : "count",
    dimensionsJson: {
      sourceContract: INBOUND_REPORT_CONTRACT,
      reportingTimeZone: e.scope.timeZone,
      sourceScopeFingerprint,
      publicationEligible: false,
      independentMetricQualificationComplete: false,
      dateBasis: e.scope.dateBasis,
      offeredDefinition: e.scope.offeredDefinition,
      selectedLegIds: r.selectedLegIds,
      offeredLegIds: r.offeredLegIds,
      acceptedLegIds: r.acceptedLegIds,
      declinedLegIds: r.declinedLegIds,
      missedLegIds: r.missedLegIds,
      unreachableLegIds: r.unreachableLegIds,
      abandonedParticipatingCallIds: r.abandonedCallIds,
      uncertainAcceptedLegIds: r.uncertainAcceptedLegIds,
      ...(key === "inbound_calls_answer_rate"
        ? {
            numerator: r.values.inbound_calls_accepted,
            denominator: r.values.inbound_calls_offered,
          }
        : {}),
      ...(key === "total_talk_time_inbound" ? { aggregation: "sum", ...r.talk } : {}),
      ...(key === "max_hold_time_inbound" ? { aggregation: "maximum", ...r.hold } : {}),
      observationStartedAt: e.observationStartedAt,
      observationEndedAt: e.observationEndedAt,
    },
  }));
}
