import { createHash } from "node:crypto";
import { z } from "zod";
import { INBOUND_PARTICIPATION_CONTRACT } from "@/lib/domain/metrics/source-context";
import {
  buildInboundReportRecord,
  normalizeInboundReportRecord,
  parseInboundReportPolicy,
  payloadSchema,
  policySchema,
} from "./zendesk-inbound-report-record";
import type { TalkCollectionSnapshot } from "./zendesk-talk-observation";
import type { ConnectorConfig, IngestedRecord } from "./types";

export const inboundReleasePolicySchema = z
  .object({
    policy: policySchema,
    // Retained release evidence, not a claim inferred from successful collection.
    releaseEvidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type InboundReleasePolicy = z.infer<typeof inboundReleasePolicySchema>;
export function parseInboundReleasePolicy(input: unknown): InboundReleasePolicy {
  const value = inboundReleasePolicySchema.parse(input);
  return { ...value, policy: parseInboundReportPolicy(value.policy) };
}
export const inboundPublicationPayloadSchema = z
  .object({
    sourceContract: z.literal(INBOUND_PARTICIPATION_CONTRACT),
    release: inboundReleasePolicySchema,
    candidate: payloadSchema,
  })
  .strict();
export function buildInboundPublicationRecord(
  snapshot: TalkCollectionSnapshot,
  input: InboundReleasePolicy,
  config: ConnectorConfig,
  identity: { employeeId: string; teamId: string; agentId: number; externalId: string },
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const release = parseInboundReleasePolicy(input);
  const candidate = buildInboundReportRecord(
    snapshot,
    release.policy,
    config,
    identity,
    periodStart,
    periodEnd,
    now
  );
  return {
    ...candidate,
    externalRecordType: "inbound_participation_summary",
    payload: {
      sourceContract: INBOUND_PARTICIPATION_CONTRACT,
      release,
      candidate: candidate.payload,
    },
  };
}
export function normalizeInboundPublicationRecord(
  payload: unknown,
  employeeId: string,
  teamId: string | null,
  periodStart: string,
  periodEnd: string
) {
  const parsed = inboundPublicationPayloadSchema.parse(payload);
  const { policy } = parseInboundReleasePolicy(parsed.release);
  const evidence = parsed.candidate.sourceEvidence;
  const scope = evidence.scope;
  const sorted = (v: readonly (number | string)[]) => JSON.stringify([...v].sort());
  if (
    periodStart < policy.effectivePeriodStart ||
    teamId !== policy.teamId ||
    evidence.accountReference !== policy.accountReference ||
    scope.timeZone !== policy.timeZone ||
    scope.dateBasis !== policy.dateBasis ||
    scope.offeredDefinition !== policy.offeredDefinition ||
    sorted(scope.groupIds) !== sorted(policy.groupIds) ||
    sorted(scope.phoneNumbers) !== sorted(policy.phoneNumbers) ||
    sorted(evidence.metricKeys) !== sorted(policy.metricKeys)
  )
    throw Error("Inbound publication evidence differs from its release policy");
  return normalizeInboundReportRecord(
    parsed.candidate,
    employeeId,
    teamId,
    periodStart,
    periodEnd
  ).map((fact) => ({
    ...fact,
    dimensionsJson: {
      ...fact.dimensionsJson,
      sourceContract: INBOUND_PARTICIPATION_CONTRACT,
      publicationEligible: true,
      releaseEvidenceSha256: parsed.release.releaseEvidenceSha256,
      sourceScopeFingerprint: createHash("sha256")
        .update(`${INBOUND_PARTICIPATION_CONTRACT}:${fact.dimensionsJson!.sourceScopeFingerprint}`)
        .digest("hex"),
      ...(["total_talk_time_inbound", "max_hold_time_inbound"].includes(fact.factType)
        ? { cohortCount: evidence.legs.length }
        : {}),
    },
  }));
}
