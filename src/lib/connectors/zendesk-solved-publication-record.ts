import { createHash } from "node:crypto";
import { z } from "zod";
import {
  UPDATER_SOLVED_CONTRACT,
  ASSIGNEE_SOLVED_CONTRACT,
} from "@/lib/domain/metrics/source-context";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { buildTicketReportCandidateRecord } from "./zendesk-ticket-report-record";
import type { ConnectorConfig, IngestedRecord, NormalizedFactInput } from "./types";

const id = z.number().int().positive().safe();
const ids = z
  .array(id)
  .min(1)
  .max(500)
  .refine((v) => new Set(v).size === v.length);
const base = z.object({
  organizationId: z.uuid(),
  dataSourceId: z.uuid(),
  teamId: z.uuid(),
  accountReference: z.string(),
  subdomain: z.string(),
  timeZone: z.string().min(1),
  brandIds: ids.nullable(),
  effectivePeriodStart: z.iso.date(),
  maxObservationAgeSeconds: z.number().int().min(60).max(86400),
  releaseEvidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
});
export const solvedReleaseSchema = z.discriminatedUnion("kind", [
  base.extend({ kind: z.literal("updater"), groupIds: ids }).strict(),
  base.extend({ kind: z.literal("assignee-solved"), groupIds: ids.nullable() }).strict(),
]);
export type SolvedRelease = z.infer<typeof solvedReleaseSchema>;
export function parseSolvedRelease(input: unknown): SolvedRelease {
  const policy = solvedReleaseSchema.parse(input);
  assertZendeskAccountBinding(policy.accountReference, policy.subdomain);
  new Intl.DateTimeFormat("en", { timeZone: policy.timeZone });
  if (new Date(`${policy.effectivePeriodStart}T00:00:00Z`).getUTCDay() !== 0)
    throw Error("Solved publication requires a Sunday cutover");
  return policy;
}
export const solvedMetricKey = (policy: SolvedRelease) =>
  policy.kind === "updater" ? "zendesk_tickets_solved_credits" : "zendesk_assignee_solved_tickets";
const contract = (policy: SolvedRelease) =>
  policy.kind === "updater" ? UPDATER_SOLVED_CONTRACT : ASSIGNEE_SOLVED_CONTRACT;
const identitySchema = z
  .object({
    employeeId: z.uuid(),
    teamId: z.uuid(),
    agentId: id,
    externalId: z
      .string()
      .min(1)
      .max(320)
      .refine((s) => s.trim() === s),
    observationStartedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type SolvedPublicationIdentity = z.infer<typeof identitySchema>;
const payloadSchema = z
  .object({
    sourceContract: z.enum([UPDATER_SOLVED_CONTRACT, ASSIGNEE_SOLVED_CONTRACT]),
    release: solvedReleaseSchema,
    identity: identitySchema,
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    sourceEvidence: z.unknown(),
  })
  .strict();

function replay(
  input: unknown,
  policy: SolvedRelease,
  identity: SolvedPublicationIdentity,
  periodStart: string,
  periodEnd: string
) {
  if (
    identity.teamId !== policy.teamId ||
    periodStart < policy.effectivePeriodStart ||
    new Date(`${periodStart}T00:00:00Z`).getUTCDay() !== 0 ||
    Date.parse(periodEnd) - Date.parse(periodStart) !== 6 * 86400000
  )
    throw Error("Solved publication team or reporting interval differs from policy");
  const common = {
    periodStart,
    periodEnd,
    timeZone: policy.timeZone,
    agentIds: [identity.agentId],
    brandIds: policy.brandIds,
  };
  const selection =
    policy.kind === "updater"
      ? {
          kind: "updater" as const,
          scope: {
            ...common,
            groupIds: policy.groupIds,
            dateBasis: "update-created" as const,
            groupBasis: "current-ticket-group" as const,
            attribution: "updater-account" as const,
          },
        }
      : {
          kind: "assignee-solved" as const,
          scope: {
            ...common,
            groupIds: policy.groupIds,
            dateBasis: "latest-solved" as const,
            attribution: "current-assignee" as const,
          },
        };
  const candidate = buildTicketReportCandidateRecord(input, selection, {
    ...identity,
    accountReference: policy.accountReference,
    subdomain: policy.subdomain,
  });
  const result = candidate.payload.result as Record<string, unknown>;
  const count =
    policy.kind === "updater" ? result.ticketsSolvedCredits : result.assigneeSolvedTickets;
  if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0)
    throw Error("Solved publication lacks complete source coverage or joined evidence");
  return { candidate, count };
}

/** Fail before publication on stale captures, including captures that age while queued. */
export function assertSolvedObservationFresh(payload: unknown, now: Date) {
  const parsed = payloadSchema.parse(payload);
  const policy = parseSolvedRelease(parsed.release);
  const age = now.getTime() - Date.parse(parsed.identity.observationStartedAt);
  const evidence = parsed.sourceEvidence as { observedAt?: unknown } | null;
  const end = typeof evidence?.observedAt === "string" ? Date.parse(evidence.observedAt) : NaN;
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > policy.maxObservationAgeSeconds * 1000 ||
    !Number.isFinite(end) ||
    end > now.getTime()
  )
    throw Error("Solved publication observation is stale or in the future");
}

/** Explicit solved-only path. No environment flag or scheduler enables this by default. */
export function buildSolvedPublicationRecord(
  sourceEvidence: unknown,
  input: SolvedRelease,
  config: ConnectorConfig,
  identityInput: SolvedPublicationIdentity,
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const policy = parseSolvedRelease(input),
    identity = identitySchema.parse(identityInput);
  if (
    config.organizationId !== policy.organizationId ||
    config.dataSourceId !== policy.dataSourceId
  )
    throw Error("Solved policy does not own the source");
  const { candidate } = replay(sourceEvidence, policy, identity, periodStart, periodEnd);
  const payload = {
    sourceContract: contract(policy),
    release: policy,
    identity,
    periodStart,
    periodEnd,
    sourceEvidence: candidate.payload.sourceEvidence,
  };
  assertSolvedObservationFresh(payload, now);
  return {
    ...candidate,
    externalRecordType: "solved_ticket_report_summary",
    externalRecordId: `${contract(policy)}:${identity.agentId}:${periodStart}:${periodEnd}`,
    payload,
  };
}

/** Rebuild from retained source IDs; never accept caller-supplied totals as facts. */
export function normalizeSolvedPublicationRecord(
  input: unknown,
  employeeId: string,
  teamId: string | null,
  periodStart: string,
  periodEnd: string
): NormalizedFactInput[] {
  const payload = payloadSchema.parse(input),
    policy = parseSolvedRelease(payload.release);
  if (
    payload.identity.employeeId !== employeeId ||
    payload.identity.teamId !== teamId ||
    payload.periodStart !== periodStart ||
    payload.periodEnd !== periodEnd ||
    payload.sourceContract !== contract(policy)
  )
    throw Error("Solved publication context differs from its retained evidence");
  const { candidate, count } = replay(
    payload.sourceEvidence,
    policy,
    payload.identity,
    periodStart,
    periodEnd
  );
  return [
    {
      employeeId,
      teamId,
      periodStart,
      periodEnd,
      factType: solvedMetricKey(policy),
      numericValue: count,
      textValue: null,
      booleanValue: null,
      unit: "tickets",
      dimensionsJson: {
        sourceContract: contract(policy),
        reportingTimeZone: policy.timeZone,
        sourceScopeFingerprint: createHash("sha256")
          .update(`${contract(policy)}:${candidate.payload.sourceScopeFingerprint}`)
          .digest("hex"),
        publicationEligible: true,
        releaseEvidenceSha256: policy.releaseEvidenceSha256,
        attribution: policy.kind === "updater" ? "updater-account" : "current-assignee",
        humanActivityVerified: false,
      },
    },
  ];
}
