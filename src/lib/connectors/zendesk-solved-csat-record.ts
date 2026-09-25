import { createHash } from "node:crypto";
import { z } from "zod";
import { assertZendeskAccountBinding, isZendeskAccountReference } from "./zendesk-account-binding";
import { calculateSolvedCsatCandidate, type fetchSolvedCsatCandidate } from "./zendesk-solved-csat";
import { SOLVED_CSAT_CONTRACT } from "@/lib/domain/metrics/source-context";
import type { IngestedRecord, NormalizedFactInput } from "./types";

type Snapshot = Awaited<ReturnType<typeof fetchSolvedCsatCandidate>>;
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const payloadSchema = z.object({
  sourceContract: z.literal(SOLVED_CSAT_CONTRACT),
  employeeContext: z
    .object({ employeeId: z.string().min(1), teamId: z.string().nullable() })
    .optional(),
  metricKeys: z
    .array(z.enum(["csat_score", "csat_response_rate"]))
    .min(1)
    .max(2)
    .refine((keys) => new Set(keys).size === keys.length),
  sourceEvidence: z.object({
    complete: z.literal(true),
    population: z.literal("all-solved-satisfaction-states"),
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
    // The calculator validates each minimal source field. No ticket body is retained.
    tickets: z.array(z.unknown()),
    metrics: z.array(z.unknown()),
  }),
});

function parseEvidence(payload: unknown, periodStart: string, periodEnd: string) {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success) throw new Error("Invalid solved CSAT source evidence");
  const evidence = parsed.data.sourceEvidence;
  if (evidence.scope.periodStart !== periodStart || evidence.scope.periodEnd !== periodEnd)
    throw new Error("CSAT source period does not match publication interval");
  if (Date.parse(evidence.observationStartedAt) > Date.parse(evidence.observationEndedAt))
    throw new Error("Invalid CSAT source observation interval");
  const tickets = evidence.tickets as Snapshot["tickets"];
  const metrics = evidence.metrics as Snapshot["metrics"];
  const result = calculateSolvedCsatCandidate(tickets, metrics, evidence.scope);
  const ids = new Set(tickets.map((t) => t.id));
  if (
    tickets.some((t) => t.assignee_id !== evidence.scope.agentId) ||
    metrics.length !== tickets.length ||
    metrics.some((m) => !ids.has(m.ticket_id))
  )
    throw new Error("CSAT employee snapshot has incomplete or foreign evidence");
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
  return {
    evidence,
    result,
    sourceScopeFingerprint,
    metricKeys: parsed.data.metricKeys,
    employeeContext: parsed.data.employeeContext,
  };
}

/** Ingestion adapter only. The live collector remains disconnected until release qualification. */
export function buildSolvedCsatRecord(
  snapshot: Snapshot,
  identity: {
    accountReference: string;
    subdomain: string;
    agentId: number;
    externalId: string;
    metricKeys?: Array<"csat_score" | "csat_response_rate">;
    employeeContext?: { employeeId: string; teamId: string | null };
  }
): IngestedRecord {
  const accountReference = assertZendeskAccountBinding(
    identity.accountReference,
    identity.subdomain
  );
  const coverage = snapshot.coverage;
  if (
    !coverage.complete ||
    coverage.population !== "all-solved-satisfaction-states" ||
    !coverage.agentIds.includes(identity.agentId)
  )
    throw new Error("CSAT employee identity is outside complete collector coverage");
  if (
    !identity.externalId.trim() ||
    identity.externalId.trim() !== identity.externalId ||
    identity.externalId.length > 320
  )
    throw new Error("Invalid CSAT external identity");
  const tickets = snapshot.tickets
    .filter((t) => t.assignee_id === identity.agentId)
    .map((t) => ({
      id: t.id,
      assignee_id: t.assignee_id,
      group_id: t.group_id,
      brand_id: t.brand_id,
      satisfaction_rating:
        t.satisfaction_rating === null ? null : { score: t.satisfaction_rating.score },
    }));
  const ticketIds = new Set(tickets.map((t) => t.id));
  const payload = {
    sourceContract: SOLVED_CSAT_CONTRACT,
    ...(identity.employeeContext ? { employeeContext: identity.employeeContext } : {}),
    metricKeys: identity.metricKeys ?? ["csat_score", "csat_response_rate"],
    sourceEvidence: {
      complete: true,
      population: coverage.population,
      accountReference,
      observationStartedAt: coverage.observationStartedAt,
      observationEndedAt: coverage.observationEndedAt,
      scope: {
        periodStart: coverage.periodStart,
        periodEnd: coverage.periodEnd,
        timeZone: coverage.timeZone,
        agentId: identity.agentId,
        groupIds: coverage.groupIds,
        brandIds: coverage.brandIds,
      },
      tickets,
      metrics: snapshot.metrics
        .filter((m) => ticketIds.has(m.ticket_id))
        .map((m) => ({ ticket_id: m.ticket_id, solved_at: m.solved_at })),
    },
  };
  parseEvidence(payload, coverage.periodStart, coverage.periodEnd);
  return {
    externalRecordType: "csat_summary",
    externalRecordId: `csat-${identity.externalId}-${coverage.periodStart}`,
    employeeExternalId: identity.externalId,
    // Beginning of sequential collection is the conservative freshness bound.
    occurredAt: new Date(coverage.observationStartedAt),
    sourceUpdatedAt: new Date(coverage.observationStartedAt),
    periodStart: coverage.periodStart,
    periodEnd: coverage.periodEnd,
    payload,
  };
}

export function normalizeSolvedCsatRecord(
  payload: unknown,
  employeeId: string,
  teamId: string | null,
  periodStart: string,
  periodEnd: string
): NormalizedFactInput[] {
  const { evidence, result, sourceScopeFingerprint, metricKeys, employeeContext } = parseEvidence(
    payload,
    periodStart,
    periodEnd
  );
  if (
    employeeContext &&
    (employeeContext.employeeId !== employeeId || employeeContext.teamId !== teamId)
  )
    throw new Error("CSAT employee or team assignment changed before publication");
  return (["score", "response"] as const)
    .filter((kind) => metricKeys.includes(kind === "score" ? "csat_score" : "csat_response_rate"))
    .map((kind) => ({
      employeeId,
      teamId,
      periodStart,
      periodEnd,
      factType: kind === "score" ? "csat_score" : "csat_response_rate",
      numericValue: result[kind].value,
      textValue: null,
      booleanValue: null,
      unit: "%",
      dimensionsJson: {
        sourceContract: SOLVED_CSAT_CONTRACT,
        reportingTimeZone: evidence.scope.timeZone,
        sourceScopeFingerprint,
        numerator: result[kind].numerator,
        denominator: result[kind].denominator,
        cohortTicketIds: result.cohortIds,
        numeratorTicketIds:
          kind === "score"
            ? result.goodIds
            : [...result.goodIds, ...result.badIds].sort((a, b) => a - b),
        denominatorTicketIds:
          kind === "score"
            ? [...result.goodIds, ...result.badIds].sort((a, b) => a - b)
            : result.surveyedIds,
        observationStartedAt: evidence.observationStartedAt,
        observationEndedAt: evidence.observationEndedAt,
      },
    }));
}
