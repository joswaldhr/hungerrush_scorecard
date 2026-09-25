import { createHash } from "node:crypto";
import { and, eq, inArray, like } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sourceRecords } from "@/lib/db/schema";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import { parseTicketActionPage, type TicketActionEvent } from "./zendesk-ticket-actions";
import { SourceRetryLaterError } from "./source-retry";
import { actionObservationKey } from "./action-observation-key";
import { assertActionShadowWrite, type ActionShadowWriteScope } from "./action-shadow-lease";

// Separate namespaces keep shadow checkpoints/events outside the active fact publisher.
const CHECKPOINT = "zendesk_ticket_action_checkpoint_v2_shadow";
const EVENT = "zendesk_ticket_action_event_v2_shadow";
const stateSchema = z.object({
  version: z.literal(1),
  accountReference: z.string().optional(),
  start: z.string().datetime(),
  endExclusive: z.string().datetime(),
  path: z.string(),
  watermark: z.number().int().nonnegative(),
  pages: z.number().int().nonnegative(),
  status: z.enum(["pending", "waiting", "complete"]),
  visited: z.array(z.string()),
  notBefore: z.string().datetime().nullable().default(null),
});
type State = z.infer<typeof stateSchema>;
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export interface TicketActionExportScope extends ActionShadowWriteScope {
  start: Date;
  endExclusive: Date;
  observationId?: string;
}

function initialState(scope: TicketActionExportScope): State {
  if (
    !Number.isFinite(scope.start.getTime()) ||
    !Number.isFinite(scope.endExclusive.getTime()) ||
    scope.start >= scope.endExclusive
  ) {
    throw new Error("Invalid ticket action interval");
  }
  const watermark = Math.floor(scope.start.getTime() / 1000);
  return {
    version: 1,
    ...(scope.workerAccountReference ? { accountReference: scope.workerAccountReference } : {}),
    start: scope.start.toISOString(),
    endExclusive: scope.endExclusive.toISOString(),
    path: `/incremental/ticket_events.json?start_time=${watermark}&per_page=1000`,
    watermark,
    pages: 0,
    status: "pending",
    visited: [],
    notBefore: null,
  };
}

async function checkpoint(scope: TicketActionExportScope, create = true) {
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
  if (!row && create) throw new Error("Ticket action checkpoint unavailable");
  if (
    row &&
    scope.workerLeaseToken !== undefined &&
    stateSchema.parse(row.payloadJson).accountReference !== scope.workerAccountReference
  )
    throw new Error("Ticket action checkpoint belongs to an unbound or different account");
  return row;
}

/** One network page per invocation. A failed fetch leaves the durable cursor untouched. */
export async function advanceTicketActionExport(
  scope: TicketActionExportScope,
  getPage: (path: string) => Promise<unknown>
) {
  const before = await checkpoint(scope);
  if (!before) throw new Error("Ticket action checkpoint unavailable");
  const state = stateSchema.parse(before.payloadJson);
  if (state.status === "complete") return { advanced: false, state };
  if (state.notBefore && Date.parse(state.notBefore) > Date.now())
    return { advanced: false, state };
  const requestHash = hash(state.path);
  if (state.visited.includes(requestHash)) throw new Error("Ticket action export stalled");
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
      if (!locked) throw new Error("Ticket action checkpoint unavailable");
      if (locked.payloadHash !== before.payloadHash)
        return { advanced: false, state: stateSchema.parse(locked.payloadJson) };
      await tx
        .update(sourceRecords)
        .set({ payloadJson: deferred, payloadHash: hash(deferred) })
        .where(eq(sourceRecords.id, before.id));
      return { advanced: false, state: deferred };
    });
  }
  const page = parseTicketActionPage(response);
  if (page.count !== page.ticket_events.length || page.end_time < state.watermark) {
    throw new Error("Ticket action export has inconsistent count or watermark");
  }
  const complete = page.end_time * 1000 >= scope.endExclusive.getTime();
  if (!complete && !page.next_page) throw new Error("Ticket action export missing continuation");
  const next: State = {
    ...state,
    path: page.next_page ?? state.path,
    watermark: page.end_time,
    pages: state.pages + 1,
    notBefore: null,
    status: complete ? "complete" : page.end_of_stream ? "waiting" : "pending",
    // A waiting boundary may be queried again when the provider catches up.
    visited: page.end_of_stream ? [] : [...state.visited, requestHash],
  };
  const records = new Map<string, TicketActionEvent>();
  for (const event of page.ticket_events) {
    const key = `${before.id}:${event.id}`;
    const previous = records.get(key);
    if (previous && hash(previous) !== hash(event))
      throw new Error("Conflicting ticket action event versions");
    records.set(key, event);
  }
  return db.transaction(async (tx) => {
    await assertActionShadowWrite(scope, tx);
    const [locked] = await tx
      .select()
      .from(sourceRecords)
      .where(eq(sourceRecords.id, before.id))
      .for("update");
    if (!locked) throw new Error("Ticket action checkpoint unavailable");
    // A competing worker advanced first; discard this fetch instead of rewinding progress.
    if (locked.payloadHash !== before.payloadHash)
      return { advanced: false, state: stateSchema.parse(locked.payloadJson) };
    if (records.size) {
      const existing = await tx
        .select({
          externalRecordId: sourceRecords.externalRecordId,
          payloadHash: sourceRecords.payloadHash,
        })
        .from(sourceRecords)
        .where(
          and(
            eq(sourceRecords.dataSourceId, scope.dataSourceId),
            eq(sourceRecords.externalRecordType, EVENT),
            inArray(sourceRecords.externalRecordId, [...records.keys()])
          )
        );
      for (const row of existing) {
        if (row.payloadHash !== hash(records.get(row.externalRecordId)))
          throw new Error("Conflicting ticket action event versions");
      }
      const entries = [...records];
      for (let offset = 0; offset < entries.length; offset += 250) {
        await tx
          .insert(sourceRecords)
          .values(
            entries.slice(offset, offset + 250).map(([externalRecordId, event]) => ({
              dataSourceId: scope.dataSourceId,
              externalRecordType: EVENT,
              externalRecordId,
              occurredAt: new Date(event.created_at),
              payloadJson: event,
              payloadHash: hash(event),
            }))
          )
          .onConflictDoNothing();
      }
    }
    // Events and cursor commit together. A rollback cannot skip an uncommitted page.
    await tx
      .update(sourceRecords)
      .set({ payloadJson: next, payloadHash: hash(next), ingestedAt: new Date() })
      .where(eq(sourceRecords.id, before.id));
    return { advanced: true, state: next };
  });
}

/** Scheduling needs only the checkpoint, never the potentially large completed cohort. */
export async function readTicketActionState(scope: TicketActionExportScope) {
  const row = await checkpoint(scope, false);
  return row ? stateSchema.parse(row.payloadJson) : initialState(scope);
}

export async function readTicketActionExport(scope: TicketActionExportScope) {
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
    .map((record) => record.payload as TicketActionEvent)
    .filter((event) => {
      const time = Date.parse(event.created_at);
      return time >= scope.start.getTime() && time < scope.endExclusive.getTime();
    });
  return {
    state,
    cohort: {
      events,
      pages: state.pages,
      observedThrough: new Date(state.watermark * 1000).toISOString(),
      coverage: "complete" as const,
    },
  };
}
