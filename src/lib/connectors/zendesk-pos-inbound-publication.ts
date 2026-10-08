import { createHash } from "node:crypto";
import { z } from "zod";
import { POS_INBOUND_CONTRACT } from "@/lib/domain/metrics/source-context";
import {
  buildPosInboundRecord,
  normalizePosInboundRecord,
  parsePosInboundPolicy,
  posInboundPayloadSchema,
  posInboundPolicySchema,
  replayPosInboundRecord,
} from "./zendesk-pos-inbound-record";
import type { TalkCollectionSnapshot } from "./zendesk-talk-observation";
import type { ConnectorConfig, IngestedRecord } from "./types";

const releaseSchema = z
  .object({
    policy: posInboundPolicySchema,
    releaseEvidenceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
export type PosInboundRelease = z.infer<typeof releaseSchema>;
export function parsePosInboundRelease(input: unknown): PosInboundRelease {
  const r = releaseSchema.parse(input);
  return { ...r, policy: parsePosInboundPolicy(r.policy) };
}
const publicationSchema = z
  .object({
    sourceContract: z.literal(POS_INBOUND_CONTRACT),
    release: releaseSchema,
    candidate: posInboundPayloadSchema,
  })
  .strict();
function parsePublication(input: unknown) {
  const value = publicationSchema.parse(input);
  const release = parsePosInboundRelease(value.release);
  if (
    JSON.stringify(release.policy) !== JSON.stringify(parsePosInboundPolicy(value.candidate.policy))
  )
    throw Error("POS inbound evidence differs from its release policy");
  return { ...value, release };
}

export function buildPosInboundPublication(
  snapshot: TalkCollectionSnapshot,
  input: PosInboundRelease,
  config: ConnectorConfig,
  identity: { employeeId: string; teamId: string; agentId: number; externalId: string },
  periodStart: string,
  periodEnd: string,
  now = new Date()
): IngestedRecord {
  const release = parsePosInboundRelease(input);
  const candidate = buildPosInboundRecord(
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
    externalRecordType: "pos_inbound_report_summary",
    payload: {
      sourceContract: POS_INBOUND_CONTRACT,
      release,
      candidate: candidate.payload,
    },
  };
}

/** Recheck at commit time, including a Sunday boundary crossed after fetch. */
export function assertPosInboundPublicationFresh(input: unknown, now = new Date()) {
  if (!Number.isFinite(now.getTime())) throw Error("Invalid POS publication time");
  const { candidate } = parsePublication(input);
  const e = candidate.sourceEvidence;
  if (Date.parse(e.validatedAt) > now.getTime()) throw Error("POS publication precedes validation");
  replayPosInboundRecord(
    { ...candidate, sourceEvidence: { ...e, validatedAt: now.toISOString() } },
    e.scope.periodStart,
    e.scope.periodEnd
  );
}

export function normalizePosInboundPublication(
  input: unknown,
  employeeId: string,
  teamId: string | null,
  start: string,
  end: string
) {
  const { candidate, release } = parsePublication(input);
  return normalizePosInboundRecord(candidate, employeeId, teamId, start, end).map((fact) => ({
    ...fact,
    dimensionsJson: {
      ...fact.dimensionsJson,
      sourceContract: POS_INBOUND_CONTRACT,
      publicationEligible: true,
      releaseEvidenceSha256: release.releaseEvidenceSha256,
      sourceScopeFingerprint: createHash("sha256")
        .update(`${POS_INBOUND_CONTRACT}:${fact.dimensionsJson!.sourceScopeFingerprint}`)
        .digest("hex"),
    },
  }));
}
