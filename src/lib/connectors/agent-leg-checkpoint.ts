import { createHash } from "node:crypto";
import { and, eq, inArray, like, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sourceRecords } from "@/lib/db/schema";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import { parseAgentLegPage, type AgentLeg } from "./zendesk-agent-legs";
import { SourceRetryLaterError } from "./source-retry";
import { actionObservationKey } from "./action-observation-key";
import { assertActionShadowWrite, type ActionShadowWriteScope } from "./action-shadow-lease";

// Separate namespaces keep shadow checkpoints/events outside the active fact publisher.
const CHECKPOINT = "zendesk_agent_leg_checkpoint_v2_shadow";
const EVENT = "zendesk_agent_leg_record_v2_shadow";
const stateSchema = z.object({
  version: z.literal(1),
  start: z.string().datetime(),
  endExclusive: z.string().datetime(),
  path: z.string(),
  watermark: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
  status: z.enum(["pending", "waiting", "complete"]),
  visited: z.array(z.string()),
  notBefore: z.string().datetime().nullable().default(null),
});
const REVISION = "zendesk_agent_leg_revision_v2_shadow";
type State = z.infer<typeof stateSchema>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface AgentLegExportScope extends ActionShadowWriteScope {
  start: Date;
  endExclusive: Date;
  observationId?: string;
}

function initialState(scope: AgentLegExportScope): State {
  if (
    !Number.isFinite(scope.start.getTime()) ||
    !Number.isFinite(scope.endExclusive.getTime()) ||
    scope.start >= scope.endExclusive ||
    scope.endExclusive.getTime() > Date.now() - 120_000
  ) {
    throw new Error("Invalid agent leg interval");
  }
  const watermark = Math.floor(scope.start.getTime() / 1000);
  return {
    version: 1,
    start: scope.start.toISOString(),
    endExclusive: scope.endExclusive.toISOString(),
    path: `/channels/voice/stats/incremental/legs.json?start_time=${watermark}`,
    watermark,
    pages: 0,
    status: "pending",
    visited: [],
    notBefore: null,
  };
}

async function checkpoint(scope: AgentLegExportScope, create = true) {
  await assertOrganizationResource(scope.organizationId, "source", scope.dataSourceId);
  const state = initialState(scope);
  const externalRecordId = actionObservationKey(
    state.start,
    state.endExclusive,
    scope.observationId
  );
  if (create)
    await db.transaction(async (tx) => {
      await assertActionShadowWrite(scope, tx);
      await tx
        .insert(sourceRecords)
        .values({
          dataSourceId: scope.dataSourceId,
          externalRecordType: CHECKPOINT,
          externalRecordId,
          payloadJson: state,
          payloadHash: hash(state),
        })
        .onConflictDoNothing();
    });
  const [row] = await db
    .select()
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, scope.dataSourceId),
        eq(sourceRecords.externalRecordType, CHECKPOINT),
        eq(sourceRecords.externalRecordId, externalRecordId)
      )
    );
  if (!row && create) throw new Error("Agent leg checkpoint unavailable");
  return row;
}

/** One network page per invocation. A failed fetch leaves the durable cursor untouched. */
export async function advanceAgentLegExport(
  scope: AgentLegExportScope,
  getPage: (path: string) => Promise<unknown>
) {
  const before = await checkpoint(scope);
  if (!before) throw new Error("Agent leg checkpoint unavailable");
  const state = stateSchema.parse(before.payloadJson);
  if (state.status === "complete") return { advanced: false, state };
  if (state.notBefore && Date.parse(state.notBefore) > Date.now())
    return { advanced: false, state };
  const requestHash = hash(state.path);
  // A repeated Talk cursor is valid only when the records and watermark also repeat.
  if (state.visited.includes(requestHash) && state.visited.at(-1) !== requestHash)
    throw new Error("Agent leg export stalled");
  let response: unknown;
  try {
    response = await getPage(state.path);
  } catch (error) {
    if (!(error instanceof SourceRetryLaterError)) throw error;
    const deferred: State = {
      ...state,
      notBefore: new Date(Date.now() + error.retryAfterMs).toISOString(),
    };
    return db.transaction(async (tx) => {
      await assertActionShadowWrite(scope, tx);
      const [locked] = await tx
        .select()
        .from(sourceRecords)
        .where(eq(sourceRecords.id, before.id))
        .for("update");
      if (!locked) throw new Error("Agent leg checkpoint unavailable");
      if (locked.payloadHash !== before.payloadHash)
        return { advanced: false, state: stateSchema.parse(locked.payloadJson) };
      await tx
        .update(sourceRecords)
        .set({ payloadJson: deferred, payloadHash: hash(deferred) })
        .where(eq(sourceRecords.id, before.id));
      return { advanced: false, state: deferred };
    });
  }
  const page = parseAgentLegPage(response);
  if (page.count !== page.legs.length || page.end_time < state.watermark) {
    throw new Error("Agent leg export has inconsistent count or watermark");
  }
  if (page.count > 0 && !page.next_page) throw new Error("Agent leg export missing continuation");
  const records = new Map<string, AgentLeg>();
  const versions = new Map<string, AgentLeg>();
  for (const event of page.legs) {
    const key = `${before.id}:${event.id}`;
    const revisionKey = `${key}:${event.updated_at}`;
    const priorVersion = versions.get(revisionKey);
    if (priorVersion && hash(priorVersion) !== hash(event))
      throw new Error("Conflicting agent leg revision");
    versions.set(revisionKey, event);
    const previous = records.get(key);
    if (!previous || Date.parse(event.updated_at) > Date.parse(previous.updated_at))
      records.set(key, event);
  }
  return db.transaction(async (tx) => {
    await assertActionShadowWrite(scope, tx);
    const [locked] = await tx
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.id, before.id))
      .for("update");
    if (!locked) throw new Error("Agent leg checkpoint unavailable");
    // A competing worker advanced first; discard this fetch instead of rewinding progress.
    if (locked.payloadHash !== before.payloadHash)
      return { advanced: false, state: stateSchema.parse(locked.payloadJson) };
    let identicalBoundary = state.pages > 0;
    if (records.size) {
      const existing = await tx
        .select()
        .from(sourceRecords)
        .where(
          and(
            eq(sourceRecords.dataSourceId, scope.dataSourceId),
            eq(sourceRecords.externalRecordType, EVENT),
            inArray(sourceRecords.externalRecordId, [...records.keys()])
          )
        );
      const previous = new Map(existing.map((row) => [row.externalRecordId, row]));
      const revisionIds = [...versions.keys()];
      const revisions = await tx
        .select()
        .from(sourceRecords)
        .where(
          and(
            eq(sourceRecords.dataSourceId, scope.dataSourceId),
            eq(sourceRecords.externalRecordType, REVISION),
            inArray(sourceRecords.externalRecordId, revisionIds)
          )
        );
      const knownRevisions = new Map(
        revisions.map((row) => [row.externalRecordId, row.payloadHash])
      );
      const revisionRows: Array<typeof sourceRecords.$inferInsert> = [];
      const latestRows: Array<typeof sourceRecords.$inferInsert> = [];
      for (const [revisionId, event] of versions) {
        const payloadHash = hash(event);
        if (previous.get(`${before.id}:${event.id}`)?.payloadHash !== payloadHash)
          identicalBoundary = false;
        const knownHash = knownRevisions.get(revisionId);
        if (knownHash && knownHash !== payloadHash)
          throw new Error("Conflicting agent leg revision");
        if (!knownHash)
          revisionRows.push({
            dataSourceId: scope.dataSourceId,
            externalRecordType: REVISION,
            externalRecordId: revisionId,
            occurredAt: new Date(event.created_at),
            sourceUpdatedAt: new Date(event.updated_at),
            payloadJson: event,
            payloadHash,
          });
      }
      for (const [key, event] of records) {
        const payloadHash = hash(event);
        const prior = previous.get(key);
        const priorTime = prior?.sourceUpdatedAt?.getTime() ?? -Infinity;
        const updatedAt = new Date(event.updated_at);
        if (!prior || prior.payloadHash !== payloadHash) identicalBoundary = false;
        if (priorTime === updatedAt.getTime() && prior?.payloadHash !== payloadHash)
          throw new Error("Conflicting agent leg revision");
        if (!prior || updatedAt.getTime() > priorTime)
          latestRows.push({
            dataSourceId: scope.dataSourceId,
            externalRecordType: EVENT,
            externalRecordId: key,
            occurredAt: new Date(event.created_at),
            sourceUpdatedAt: updatedAt,
            payloadJson: event,
            payloadHash,
          });
      }
      for (let offset = 0; offset < revisionRows.length; offset += 250) {
        await tx
          .insert(sourceRecords)
          .values(revisionRows.slice(offset, offset + 250))
          .onConflictDoNothing();
      }
      for (let offset = 0; offset < latestRows.length; offset += 250) {
        await tx
          .insert(sourceRecords)
          .values(latestRows.slice(offset, offset + 250))
          .onConflictDoUpdate({
            target: [
              sourceRecords.dataSourceId,
              sourceRecords.externalRecordType,
              sourceRecords.externalRecordId,
            ],
            set: {
              payloadJson: sql`excluded.payload_json`,
              payloadHash: sql`excluded.payload_hash`,
              sourceUpdatedAt: sql`excluded.source_updated_at`,
              occurredAt: sql`excluded.occurred_at`,
              ingestedAt: new Date(),
            },
          });
      }
    }

    const complete =
      page.count === 0 ||
      (identicalBoundary && page.next_page === state.path && page.end_time === state.watermark);
    if (!complete && state.visited.includes(hash(page.next_page!)))
      throw new Error("Agent leg export stalled");
    const next: State = {
      ...state,
      path: page.next_page ?? state.path,
      watermark: page.end_time,
      pages: state.pages + 1,
      notBefore: null,
      status: complete ? "complete" : "pending",
      visited: [...state.visited, requestHash],
    };
    // Events and cursor commit together. A rollback cannot skip an uncommitted page.
    await tx
      .update(sourceRecords)
      .set({ payloadJson: next, payloadHash: hash(next), ingestedAt: new Date() })
      .where(eq(sourceRecords.id, before.id));
    return { advanced: true, state: next };
  });
}

/** Scheduling needs only the checkpoint, never the potentially large completed cohort. */
export async function readAgentLegState(scope: AgentLegExportScope) {
  const row = await checkpoint(scope, false);
  return row ? stateSchema.parse(row.payloadJson) : initialState(scope);
}

export async function readAgentLegExport(scope: AgentLegExportScope) {
  const row = await checkpoint(scope, false);
  if (!row) return { state: initialState(scope), cohort: null };
  const state = stateSchema.parse(row.payloadJson);
  if (state.status !== "complete") return { state, cohort: null };
  const rows = await db
    .select({ payload: sourceRecords.payloadJson })
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, scope.dataSourceId),
        eq(sourceRecords.externalRecordType, EVENT),
        // This generated UUID prefix belongs to this interval's checkpoint.
        like(sourceRecords.externalRecordId, `${row.id}:%`)
      )
    );
  const events = rows
    .map((record) => record.payload as AgentLeg)
    .filter((event) => {
      const time = Date.parse(event.created_at);
      return time >= scope.start.getTime() && time < scope.endExclusive.getTime();
    });
  return {
    state,
    cohort: {
      legs: events,
      pages: state.pages,
      observedThrough: new Date(state.watermark * 1000).toISOString(),
      coverage: "complete" as const,
    },
  };
}
