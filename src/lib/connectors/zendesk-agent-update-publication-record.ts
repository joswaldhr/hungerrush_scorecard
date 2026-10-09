import { createHash } from "node:crypto";
import { z } from "zod";
import { AGENT_UPDATE_CONTRACT } from "@/lib/domain/metrics/source-context";
import { assertZendeskAccountBinding } from "./zendesk-account-binding";
import { buildTicketReportCandidateRecord } from "./zendesk-ticket-report-record";
import { solvedReleaseSchema } from "./zendesk-solved-publication-record";
import type { ConnectorConfig, IngestedRecord, NormalizedFactInput } from "./types";

export const AGENT_UPDATE_KEY = "zendesk_agent_update_events";
// Share only structural release validation; solved policies cannot select this path.
export const agentUpdateReleaseSchema = solvedReleaseSchema.options[0]
  .extend({ kind: z.literal("agent-updates") })
  .strict();
export type AgentUpdateRelease = z.infer<typeof agentUpdateReleaseSchema>;
export function parseAgentUpdateRelease(input: unknown): AgentUpdateRelease {
  const policy = agentUpdateReleaseSchema.parse(input);
  assertZendeskAccountBinding(policy.accountReference, policy.subdomain);
  new Intl.DateTimeFormat("en", { timeZone: policy.timeZone });
  if (new Date(`${policy.effectivePeriodStart}T00:00:00Z`).getUTCDay() !== 0)
    throw Error("Agent updates require a Sunday cutover");
  return policy;
}
const identitySchema = z
  .object({
    employeeId: z.uuid(),
    teamId: z.uuid(),
    agentId: z.number().int().positive().safe(),
    externalId: z
      .string()
      .min(1)
      .max(320)
      .refine((s) => s.trim() === s),
    observationStartedAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export type AgentUpdateIdentity = z.infer<typeof identitySchema>;
const payloadSchema = z
  .object({
    sourceContract: z.literal(AGENT_UPDATE_CONTRACT),
    release: agentUpdateReleaseSchema,
    identity: identitySchema,
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    sourceEvidence: z.unknown(),
  })
  .strict();

function replay(
  input: unknown,
  policy: AgentUpdateRelease,
  identity: AgentUpdateIdentity,
  periodStart: string,
  periodEnd: string
) {
  z.iso.date().parse(periodStart);
  z.iso.date().parse(periodEnd);
  if (
    identity.teamId !== policy.teamId ||
    periodStart < policy.effectivePeriodStart ||
    new Date(`${periodStart}T00:00:00Z`).getUTCDay() !== 0 ||
    Date.parse(periodEnd) - Date.parse(periodStart) !== 6 * 86400000
  )
    throw Error("Agent-update team or interval differs from release");
  const candidate = buildTicketReportCandidateRecord(
    input,
    {
      kind: "updater",
      scope: {
        periodStart,
        periodEnd,
        timeZone: policy.timeZone,
        agentIds: [identity.agentId],
        groupIds: policy.groupIds,
        brandIds: policy.brandIds,
        dateBasis: "update-created",
        groupBasis: "current-ticket-group",
        attribution: "updater-account",
      },
    },
    { ...identity, accountReference: policy.accountReference, subdomain: policy.subdomain }
  );
  const result = candidate.payload.result as {
    agentUpdateEvents: unknown;
    updateEventIds: number[];
  };
  if (
    typeof result.agentUpdateEvents !== "number" ||
    !Number.isSafeInteger(result.agentUpdateEvents) ||
    result.agentUpdateEvents < 0 ||
    result.agentUpdateEvents !== result.updateEventIds.length
  )
    throw Error("Agent updates lack complete event, parent or role evidence");
  return { candidate, count: result.agentUpdateEvents };
}

/** The oldest dependency/cutoff governs freshness, including time spent queued. */
export function assertAgentUpdateObservationFresh(input: unknown, now: Date) {
  const payload = payloadSchema.parse(input),
    policy = parseAgentUpdateRelease(payload.release);
  const evidence = payload.sourceEvidence as {
    observedAt?: unknown;
    coverage?: { asOf?: unknown };
  } | null;
  const cutoff = evidence?.coverage?.asOf;
  const oldest = Math.min(
    Date.parse(payload.identity.observationStartedAt),
    cutoff === undefined ? Infinity : typeof cutoff === "string" ? Date.parse(cutoff) : NaN
  );
  const end = typeof evidence?.observedAt === "string" ? Date.parse(evidence.observedAt) : NaN;
  const age = now.getTime() - oldest;
  if (
    !Number.isFinite(age) ||
    age < 0 ||
    age > policy.maxObservationAgeSeconds * 1000 ||
    !Number.isFinite(end) ||
    end > now.getTime()
  )
    throw Error("Agent-update observation is stale or in the future");
}

/** Explicit, separately released path. Not registered with routes, jobs or environment policy. */
export function buildAgentUpdatePublicationRecord(
  source: unknown,
  input: AgentUpdateRelease,
  config: ConnectorConfig,
  identityInput: AgentUpdateIdentity,
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const policy = parseAgentUpdateRelease(input),
    identity = identitySchema.parse(identityInput);
  if (
    config.organizationId !== policy.organizationId ||
    config.dataSourceId !== policy.dataSourceId
  )
    throw Error("Agent-update release does not own source");
  const { candidate } = replay(source, policy, identity, periodStart, periodEnd);
  const payload = {
    sourceContract: AGENT_UPDATE_CONTRACT,
    release: policy,
    identity,
    periodStart,
    periodEnd,
    sourceEvidence: candidate.payload.sourceEvidence,
  };
  assertAgentUpdateObservationFresh(payload, now);
  const evidence = payload.sourceEvidence as { coverage: { asOf?: string } };
  const observed = new Date(
    Math.min(
      Date.parse(identity.observationStartedAt),
      evidence.coverage.asOf ? Date.parse(evidence.coverage.asOf) : Infinity
    )
  );
  return {
    ...candidate,
    occurredAt: observed,
    sourceUpdatedAt: observed,
    externalRecordType: "agent_update_report_summary",
    externalRecordId: `${AGENT_UPDATE_CONTRACT}:${identity.agentId}:${periodStart}:${periodEnd}`,
    payload,
  };
}

export function normalizeAgentUpdatePublicationRecord(
  input: unknown,
  employeeId: string,
  teamId: string | null,
  periodStart: string,
  periodEnd: string
): NormalizedFactInput[] {
  const payload = payloadSchema.parse(input),
    policy = parseAgentUpdateRelease(payload.release);
  if (
    payload.identity.employeeId !== employeeId ||
    payload.identity.teamId !== teamId ||
    payload.periodStart !== periodStart ||
    payload.periodEnd !== periodEnd
  )
    throw Error("Agent-update context differs from retained evidence");
  const { candidate, count } = replay(
    payload.sourceEvidence,
    policy,
    payload.identity,
    periodStart,
    periodEnd
  );
  const evidence = candidate.payload.sourceEvidence as { coverage: { asOf?: string } };
  return [
    {
      employeeId,
      teamId,
      periodStart,
      periodEnd,
      factType: AGENT_UPDATE_KEY,
      numericValue: count,
      textValue: null,
      booleanValue: null,
      unit: "updates",
      dimensionsJson: {
        sourceContract: AGENT_UPDATE_CONTRACT,
        reportingTimeZone: policy.timeZone,
        sourceScopeFingerprint: createHash("sha256")
          .update(`${AGENT_UPDATE_CONTRACT}:${candidate.payload.sourceScopeFingerprint}`)
          .digest("hex"),
        publicationEligible: true,
        releaseEvidenceSha256: policy.releaseEvidenceSha256,
        attribution: "updater-account",
        humanActivityVerified: false,
        reportingMode: evidence.coverage.asOf ? "in-progress" : "closed-period",
        ...(evidence.coverage.asOf ? { reportingAsOf: evidence.coverage.asOf } : {}),
      },
    },
  ];
}
