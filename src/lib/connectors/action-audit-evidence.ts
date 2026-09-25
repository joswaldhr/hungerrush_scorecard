import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dataSources, sourceRecords } from "@/lib/db/schema";
import { actionObservationKey } from "./action-observation-key";
import { isZendeskAccountReference } from "./zendesk-account-binding";

const TYPE = "zendesk_action_audit_evidence_v2_shadow";
const id = z.number().int().positive().safe();
const status = z.enum(["new", "open", "pending", "hold", "solved", "closed", "deleted"]);
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const retainedEvent = z.object({
  id,
  ticket_id: id,
  updater_id: z.number().int().safe().nullable(),
  created_at: z.string().datetime({ offset: true }),
  child_events: z
    .array(
      z.object({
        id,
        event_type: z.string().max(100),
        status: status.optional(),
        previousStatus: status.nullable(),
        comment_present: z.boolean().optional(),
      })
    )
    .max(1000),
});
const channel = z.enum([
  "web",
  "api",
  "system",
  "email",
  "mobile",
  "rule",
  "voice",
  "chat",
  "sms",
  "other",
  "numeric",
  "missing",
]);
const safeVia = z.object({
  channel,
  relation: z.enum(["trigger", "automation", "rule", "other", "missing"]),
  sourceType: z.enum(["rule", "other", "missing"]),
});
const vendorVia = z
  .object({
    channel: z.union([z.string(), z.number().int()]).optional(),
    source: z
      .object({ type: z.string().optional(), rel: z.string().nullable().optional() })
      .optional(),
  })
  .transform((via): z.infer<typeof safeVia> => ({
    channel:
      via.channel === undefined
        ? "missing"
        : typeof via.channel === "number"
          ? "numeric"
          : channel.safeParse(via.channel).success
            ? (via.channel as z.infer<typeof channel>)
            : "other",
    relation:
      via.source?.rel == null
        ? "missing"
        : ["trigger", "automation", "rule"].includes(via.source.rel)
          ? (via.source.rel as "trigger" | "automation" | "rule")
          : "other",
    sourceType:
      via.source?.type === undefined ? "missing" : via.source.type === "rule" ? "rule" : "other",
  }));
const vendorAudit = z.object({
  audit: z.object({
    id,
    ticket_id: id,
    author_id: z.number().int().safe().nullable(),
    created_at: z.string().datetime({ offset: true }),
    via: vendorVia.optional(),
    events: z
      .array(
        z.object({
          id,
          type: z.string().max(100),
          field_name: z.string().optional(),
          value: z.unknown().optional(),
          previous_value: z.unknown().optional(),
          via: vendorVia.optional(),
        })
      )
      .max(1000),
  }),
});
const evidenceSchema = z.object({
  version: z.literal(1),
  accountReference: z.string(),
  checkpointId: z.uuid(),
  checkpointHash: z.string(),
  sourceEventRecordId: z.uuid(),
  sourceEventHash: z.string(),
  retainedEventDigest: z.string(),
  observationKey: z.string(),
  capturedAt: z.string().datetime(),
  historicalEligibility: z.literal("unknown"),
  humanActivityAttribution: z.literal("unknown"),
  evidenceHash: z.string(),
  audit: z.object({
    id,
    ticketId: id,
    actorId: z.number().int().safe().nullable(),
    retainedUpdaterId: z.number().int().safe().nullable(),
    actorMatchesUpdater: z.boolean(),
    createdAt: z.string().datetime(),
    via: safeVia.nullable(),
    children: z.array(
      z.object({
        id,
        type: z.string(),
        via: safeVia.nullable(),
        hasViaOverride: z.boolean(),
        statusBefore: status.nullable(),
        statusAfter: status.nullable(),
      })
    ),
  }),
});

export interface ActionAuditScope {
  organizationId: string;
  dataSourceId: string;
  accountReference: string;
  start: Date;
  endExclusive: Date;
  observationId?: string;
}
type Connection = Pick<typeof db, "select">;

async function context(
  connection: Connection,
  scope: ActionAuditScope,
  eventId: number,
  lock = false
) {
  id.parse(eventId);
  if (
    !isZendeskAccountReference(scope.accountReference) ||
    !Number.isFinite(scope.start.getTime()) ||
    !Number.isFinite(scope.endExclusive.getTime()) ||
    scope.start >= scope.endExclusive ||
    scope.endExclusive.getTime() > Date.now() - 120_000
  )
    throw new Error("Audit evidence requires a bound closed observation");
  const sourceQuery = connection
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.id, scope.dataSourceId),
        eq(dataSources.organizationId, scope.organizationId)
      )
    );
  const [source] = await (lock ? sourceQuery.for("update") : sourceQuery);
  if (
    !source ||
    !["zendesk", "staging"].includes(source.type) ||
    source.status !== "configured" ||
    source.configurationReference !== scope.accountReference
  )
    throw new Error("Audit evidence source is not permitted or its account binding changed");
  const key = actionObservationKey(
    scope.start.toISOString(),
    scope.endExclusive.toISOString(),
    scope.observationId
  );
  const checkpointQuery = connection
    .select()
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, scope.dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_ticket_action_checkpoint_v2_shadow"),
        eq(sourceRecords.externalRecordId, key)
      )
    );
  const [checkpoint] = await (lock ? checkpointQuery.for("share") : checkpointQuery);
  const state = z
    .object({
      status: z.literal("complete"),
      accountReference: z.string(),
      start: z.string(),
      endExclusive: z.string(),
    })
    .safeParse(checkpoint?.payloadJson);
  if (
    !checkpoint ||
    !state.success ||
    state.data.accountReference !== scope.accountReference ||
    state.data.start !== scope.start.toISOString() ||
    state.data.endExclusive !== scope.endExclusive.toISOString()
  )
    throw new Error("Audit evidence requires a completed matching checkpoint");
  const recordQuery = connection
    .select()
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, scope.dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_ticket_action_event_v2_shadow"),
        eq(sourceRecords.externalRecordId, `${checkpoint.id}:${eventId}`)
      )
    );
  const [record] = await (lock ? recordQuery.for("share") : recordQuery);
  if (!record) throw new Error("Retained event is unavailable");
  const event = retainedEvent.parse(record.payloadJson);
  if (
    event.id !== eventId ||
    Date.parse(event.created_at) < scope.start.getTime() ||
    Date.parse(event.created_at) >= scope.endExclusive.getTime() ||
    new Set(event.child_events.map((child) => child.id)).size !== event.child_events.length
  )
    throw new Error("Retained event does not match the observation");
  return {
    event,
    binding: {
      accountReference: scope.accountReference,
      checkpointId: checkpoint.id,
      checkpointHash: checkpoint.payloadHash,
      sourceEventRecordId: record.id,
      sourceEventHash: record.payloadHash,
      retainedEventDigest: digest(event),
      observationKey: key,
    },
    key: `${checkpoint.id}:${eventId}`,
  };
}

const predicate = (scope: ActionAuditScope, key: string) =>
  and(
    eq(sourceRecords.dataSourceId, scope.dataSourceId),
    eq(sourceRecords.externalRecordType, TYPE),
    eq(sourceRecords.externalRecordId, key)
  );
function validateSaved(value: unknown, binding: Awaited<ReturnType<typeof context>>["binding"]) {
  const saved = evidenceSchema.parse(value);
  if (
    Object.entries(binding).some(
      ([key, expected]) => saved[key as keyof typeof binding] !== expected
    ) ||
    digest(saved.audit) !== saved.evidenceHash
  )
    throw new Error("Retained audit evidence no longer matches its source observation");
  return saved;
}

/** Offline evidence capture only: one GET, immutable source binding, no human classification or publication. */
export async function captureActionAuditEvidence(
  scope: ActionAuditScope,
  eventId: number,
  getPage: (path: string) => Promise<unknown>
) {
  const before = await context(db, scope, eventId);
  const [existing] = await db.select().from(sourceRecords).where(predicate(scope, before.key));
  if (existing) return validateSaved(existing.payloadJson, before.binding);
  const candidates = before.event.child_events.filter(
    (child) => child.event_type === "Change" || child.comment_present
  );
  if (!candidates.length) throw new Error("Event contains no ticket activity candidates");
  const { audit } = vendorAudit.parse(
    await getPage(`/tickets/${before.event.ticket_id}/audits/${eventId}.json`)
  );
  if (
    audit.id !== eventId ||
    audit.ticket_id !== before.event.ticket_id ||
    Date.parse(audit.created_at) !== Date.parse(before.event.created_at) ||
    new Set(audit.events.map((child) => child.id)).size !== audit.events.length
  )
    throw new Error(
      `Audit does not match the retained event: ${[
        audit.id !== eventId && "event",
        audit.ticket_id !== before.event.ticket_id && "ticket",
        Date.parse(audit.created_at) !== Date.parse(before.event.created_at) && "timestamp",
        new Set(audit.events.map((child) => child.id)).size !== audit.events.length &&
          "duplicate child",
      ]
        .filter(Boolean)
        .join(", ")}`
    );
  const children = candidates.map((child) => {
    const match = audit.events.find(
      (item) => item.id === child.id && item.type === child.event_type
    );
    if (
      !match ||
      (child.status !== undefined &&
        (match.field_name !== "status" ||
          match.value !== child.status ||
          (child.previousStatus !== null && match.previous_value !== child.previousStatus)))
    )
      throw new Error("Audit child does not match retained activity");
    return {
      id: child.id,
      type: child.event_type,
      via: match.via ?? null,
      hasViaOverride: match.via !== undefined,
      statusBefore:
        match.field_name === "status"
          ? (status.safeParse(match.previous_value).data ?? null)
          : null,
      statusAfter:
        match.field_name === "status" ? (status.safeParse(match.value).data ?? null) : null,
    };
  });
  const normalizedAudit = {
    id: audit.id,
    ticketId: audit.ticket_id,
    actorId: audit.author_id,
    retainedUpdaterId: before.event.updater_id,
    actorMatchesUpdater: audit.author_id === before.event.updater_id,
    createdAt: new Date(audit.created_at).toISOString(),
    via: audit.via ?? null,
    children,
  };
  const snapshot = evidenceSchema.parse({
    version: 1,
    ...before.binding,
    capturedAt: new Date().toISOString(),
    historicalEligibility: "unknown",
    humanActivityAttribution: "unknown",
    audit: normalizedAudit,
    evidenceHash: digest(normalizedAudit),
  });
  return db.transaction(async (tx) => {
    const after = await context(tx, scope, eventId, true);
    if (digest(after.binding) !== digest(before.binding))
      throw new Error("Source observation changed during audit capture");
    const [winner] = await tx.select().from(sourceRecords).where(predicate(scope, after.key));
    if (winner) {
      const saved = validateSaved(winner.payloadJson, after.binding);
      if (saved.evidenceHash !== snapshot.evidenceHash)
        throw new Error("Conflicting audit evidence was already retained");
      return saved;
    }
    await tx.insert(sourceRecords).values({
      dataSourceId: scope.dataSourceId,
      externalRecordType: TYPE,
      externalRecordId: after.key,
      payloadJson: snapshot,
      payloadHash: digest(snapshot),
    });
    return snapshot;
  });
}
