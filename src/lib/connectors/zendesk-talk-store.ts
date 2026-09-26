import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dataSources, sourceRecords } from "@/lib/db/schema";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import {
  advanceTalkCursor,
  initialTalkCursor,
  type TalkCursor,
  type TalkRecordValue,
} from "./zendesk-talk-cursor";
import { outboundCallSchema } from "./zendesk-outbound";
import { talkParticipationLegSchema } from "./zendesk-talk-participation";

// These namespaces never enter the ticket-action shadow worker or fact publisher.
const LEASE = "zendesk_talk_collection_lease_v1";
const CHECKPOINT = "zendesk_talk_collection_checkpoint_v1";
const RECORD = "zendesk_talk_collection_record_v1";
const REVISION = "zendesk_talk_collection_revision_v1";
const hash = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export interface TalkStoreScope {
  organizationId: string;
  dataSourceId: string;
  accountReference: string;
}
export interface TalkOwnedScope extends TalkStoreScope {
  token: string;
}
const leaseSchema = z.object({
  token: z.uuid(),
  expiresAt: z.iso.datetime(),
  nextAllowedAt: z.iso.datetime(),
});
const filter = (source: string, type: string, key: string) =>
  and(
    eq(sourceRecords.dataSourceId, source),
    eq(sourceRecords.externalRecordType, type),
    eq(sourceRecords.externalRecordId, key)
  );
async function lockSource(tx: Tx, scope: TalkStoreScope) {
  if (!isZendeskAccountReference(scope.accountReference))
    throw Error("Invalid Talk account binding");
  await tx.execute(
    sql`select set_config('lock_timeout', '3000', true), set_config('statement_timeout', '15000', true)`
  );
  // Serialize the account even if it is configured as more than one data source.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${scope.accountReference}, 0))`
  );
  const [source] = await tx
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.id, scope.dataSourceId),
        eq(dataSources.organizationId, scope.organizationId)
      )
    )
    .for("update");
  if (
    !source ||
    source.type !== "zendesk" ||
    source.status !== "configured" ||
    source.configurationReference !== scope.accountReference
  )
    throw Error("Talk source binding not permitted");
}
async function clock(tx: Tx) {
  const [row] = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
  return Date.parse(row!.now);
}
async function upsert(tx: Tx, source: string, type: string, key: string, payload: unknown) {
  const values = {
    dataSourceId: source,
    externalRecordType: type,
    externalRecordId: key,
    payloadJson: payload,
    payloadHash: hash(payload),
    ingestedAt: new Date(),
  };
  await tx
    .insert(sourceRecords)
    .values(values)
    .onConflictDoUpdate({
      target: [
        sourceRecords.dataSourceId,
        sourceRecords.externalRecordType,
        sourceRecords.externalRecordId,
      ],
      set: values,
    });
}
async function upsertPage(
  tx: Tx,
  source: string,
  type: string,
  rows: Array<{ key: string; payload: unknown }>
) {
  for (let offset = 0; offset < rows.length; offset += 200) {
    await tx
      .insert(sourceRecords)
      .values(
        rows.slice(offset, offset + 200).map(({ key, payload }) => ({
          dataSourceId: source,
          externalRecordType: type,
          externalRecordId: key,
          payloadJson: payload,
          payloadHash: hash(payload),
          ingestedAt: new Date(),
        }))
      )
      .onConflictDoUpdate({
        target: [
          sourceRecords.dataSourceId,
          sourceRecords.externalRecordType,
          sourceRecords.externalRecordId,
        ],
        set: {
          payloadJson: sql`excluded.payload_json`,
          payloadHash: sql`excluded.payload_hash`,
          ingestedAt: sql`excluded.ingested_at`,
        },
      });
  }
}
async function owned(tx: Tx, scope: TalkOwnedScope) {
  await lockSource(tx, scope);
  const [row] = await tx
    .select()
    .from(sourceRecords)
    .where(filter(scope.dataSourceId, LEASE, scope.accountReference));
  const lease = leaseSchema.safeParse(row?.payloadJson);
  const now = await clock(tx);
  if (!lease.success || lease.data.token !== scope.token || Date.parse(lease.data.expiresAt) <= now)
    throw Error("Talk collection lease is no longer owned");
  return { lease: lease.data, now };
}

/** Six-minute lease fences a worker whose hosted budget is at most five minutes. */
export async function claimTalkCollection(scope: TalkStoreScope) {
  return db.transaction(async (tx) => {
    await lockSource(tx, scope);
    const now = await clock(tx);
    const rows = await tx
      .select()
      .from(sourceRecords)
      .where(
        and(
          eq(sourceRecords.externalRecordType, LEASE),
          eq(sourceRecords.externalRecordId, scope.accountReference)
        )
      );
    const leases = rows.map((r) => leaseSchema.parse(r.payloadJson));
    const active = leases.find((l) => Date.parse(l.expiresAt) > now);
    if (active) return { acquired: false as const, retryAt: active.expiresAt };
    const lease = {
      token: randomUUID(),
      expiresAt: new Date(now + 360_000).toISOString(),
      nextAllowedAt: new Date(
        Math.max(now, ...leases.map((l) => Date.parse(l.nextAllowedAt)))
      ).toISOString(),
    };
    await upsert(tx, scope.dataSourceId, LEASE, scope.accountReference, lease);
    return { acquired: true as const, ...lease };
  });
}

/** Reserve immediately before each GET; waiting workers retain no open transaction. */
export async function reserveTalkRequest(scope: TalkOwnedScope) {
  return db.transaction(async (tx) => {
    const { lease, now } = await owned(tx, scope);
    if (Date.parse(lease.nextAllowedAt) > now)
      return { reserved: false as const, waitMs: Date.parse(lease.nextAllowedAt) - now };
    await upsert(tx, scope.dataSourceId, LEASE, scope.accountReference, {
      ...lease,
      nextAllowedAt: new Date(now + 6300).toISOString(),
    });
    return { reserved: true as const, waitMs: 0 };
  });
}

export async function deferTalkRequests(scope: TalkOwnedScope, retryAfterMs: number) {
  if (!Number.isFinite(retryAfterMs) || retryAfterMs < 0 || retryAfterMs > 86400000)
    throw Error("Invalid Talk retry delay");
  await db.transaction(async (tx) => {
    const { lease, now } = await owned(tx, scope);
    await upsert(tx, scope.dataSourceId, LEASE, scope.accountReference, {
      ...lease,
      nextAllowedAt: new Date(
        Math.max(Date.parse(lease.nextAllowedAt), now + retryAfterMs)
      ).toISOString(),
    });
  });
}

export async function releaseTalkCollection(scope: TalkOwnedScope) {
  await db.transaction(async (tx) => {
    await lockSource(tx, scope);
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope.dataSourceId, LEASE, scope.accountReference));
    const lease = leaseSchema.safeParse(row?.payloadJson);
    // A late owner's cleanup must not release a successor or erase the rate limit.
    if (lease.success && lease.data.token === scope.token)
      await upsert(tx, scope.dataSourceId, LEASE, scope.accountReference, {
        ...lease.data,
        expiresAt: new Date(0).toISOString(),
      });
  });
}

interface Checkpoint {
  accountReference: string;
  bootstrapStart: number;
  cycle: number;
  observationStartedAt: string;
  lastPageAt: string | null;
  cursor: TalkCursor;
}
const checkpointSchema = z.object({
  accountReference: z.string(),
  bootstrapStart: z.number().int().nonnegative().safe(),
  cycle: z.number().int().positive().safe(),
  observationStartedAt: z.iso.datetime(),
  lastPageAt: z.iso.datetime().nullable(),
  cursor: z.object({
    version: z.literal(1),
    origin: z.string(),
    resource: z.enum(["calls", "legs"]),
    initialStartTime: z.number().int().nonnegative().safe(),
    path: z.string(),
    watermark: z.number().int().nonnegative().safe(),
    pages: z.number().int().min(0).max(10000),
    status: z.enum(["pending", "exhausted"]),
    visited: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(10000),
  }),
});
function checkpoint(
  payload: unknown,
  scope: TalkStoreScope,
  resource: "calls" | "legs"
): Checkpoint {
  const parsed = checkpointSchema.safeParse(payload);
  if (!parsed.success) throw Error("Invalid stored Talk checkpoint");
  const state = parsed.data,
    cursor = state.cursor;
  if (
    state.accountReference !== scope.accountReference ||
    cursor.resource !== resource ||
    cursor.origin !==
      `https://${scope.accountReference.slice("zendesk-account:".length)}.zendesk.com` ||
    cursor.initialStartTime < state.bootstrapStart ||
    cursor.watermark < cursor.initialStartTime ||
    cursor.visited.length !== cursor.pages ||
    (cursor.pages === 0) !== (state.lastPageAt === null) ||
    (state.lastPageAt !== null &&
      Date.parse(state.lastPageAt) < Date.parse(state.observationStartedAt))
  )
    throw Error("Invalid stored Talk checkpoint scope or chronology");
  return state;
}

/** Resume pending work; an exhausted export starts a new five-minute overlap cycle. */
export async function beginTalkCollectionCycle(
  scope: TalkOwnedScope,
  resource: "calls" | "legs",
  bootstrapStart: number
) {
  const origin = `https://${scope.accountReference.slice("zendesk-account:".length)}.zendesk.com`;
  const initial = initialTalkCursor(origin, resource, bootstrapStart);
  return db.transaction(async (tx) => {
    const { now } = await owned(tx, scope);
    if (bootstrapStart > Math.floor(now / 1000) - 120)
      throw Error("Talk bootstrap must precede the source delay");
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope.dataSourceId, CHECKPOINT, resource));
    const previous = row ? checkpoint(row.payloadJson, scope, resource) : undefined;
    if (
      previous &&
      (previous.accountReference !== scope.accountReference ||
        previous.bootstrapStart !== bootstrapStart)
    )
      throw Error("Talk checkpoint scope changed; explicit rebootstrap required");
    if (previous?.cursor.status === "pending") {
      if (!row?.payloadHash || !/^[a-f0-9]{64}$/.test(row.payloadHash))
        throw Error("Invalid Talk checkpoint hash");
      return { state: previous, expectedHash: row.payloadHash };
    }
    const cursor = previous
      ? initialTalkCursor(
          origin,
          resource,
          Math.max(bootstrapStart, previous.cursor.watermark - 300)
        )
      : initial;
    const state: Checkpoint = {
      accountReference: scope.accountReference,
      bootstrapStart,
      cycle: (previous?.cycle ?? 0) + 1,
      observationStartedAt: new Date(now).toISOString(),
      lastPageAt: null,
      cursor,
    };
    await upsert(tx, scope.dataSourceId, CHECKPOINT, resource, state);
    return { state, expectedHash: hash(state) };
  });
}

/** Atomic page, revisions and cursor commit. Failed validation or lost ownership writes nothing. */
export async function commitTalkCollectionPage(
  scope: TalkOwnedScope,
  resource: "calls" | "legs",
  expectedHash: string,
  response: unknown
) {
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) throw Error("Invalid Talk checkpoint hash");
  const schema = resource === "calls" ? outboundCallSchema : talkParticipationLegSchema;
  const pageRecords = z.object({ [resource]: z.array(schema).max(1000) }).parse(response)[
    resource
  ]!;
  const recordKeys = [...new Set(pageRecords.map((r) => `${resource}:${r.id}`))];
  const revisionKeys = [...new Set(pageRecords.map((r) => `${resource}:${r.id}:${r.updated_at}`))];
  return db.transaction(async (tx) => {
    const { now } = await owned(tx, scope);
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope.dataSourceId, CHECKPOINT, resource));
    if (!row || row.payloadHash !== expectedHash)
      throw Error("Talk checkpoint changed before commit");
    const before = checkpoint(row.payloadJson, scope, resource);
    const latest = recordKeys.length
      ? await tx
          .select()
          .from(sourceRecords)
          .where(
            and(
              eq(sourceRecords.dataSourceId, scope.dataSourceId),
              eq(sourceRecords.externalRecordType, RECORD),
              inArray(sourceRecords.externalRecordId, recordKeys)
            )
          )
      : [];
    const revisions = revisionKeys.length
      ? await tx
          .select()
          .from(sourceRecords)
          .where(
            and(
              eq(sourceRecords.dataSourceId, scope.dataSourceId),
              eq(sourceRecords.externalRecordType, REVISION),
              inArray(sourceRecords.externalRecordId, revisionKeys)
            )
          )
      : [];
    const next = advanceTalkCursor(
      before.cursor,
      response,
      latest.map((r) => r.payloadJson as TalkRecordValue),
      revisions.map((r) => {
        const p = r.payloadJson as { record: TalkRecordValue; digest: string };
        return { id: p.record.id, updatedAt: p.record.updated_at, digest: p.digest };
      })
    );
    await upsertPage(
      tx,
      scope.dataSourceId,
      REVISION,
      next.revisions.map((revision) => ({
        key: `${resource}:${revision.record.id}:${revision.record.updated_at}`,
        payload: revision,
      }))
    );
    await upsertPage(
      tx,
      scope.dataSourceId,
      RECORD,
      next.records.map((record) => ({ key: `${resource}:${record.id}`, payload: record }))
    );
    const state: Checkpoint = {
      ...before,
      cursor: next.cursor,
      lastPageAt: new Date(now).toISOString(),
    };
    await upsert(tx, scope.dataSourceId, CHECKPOINT, resource, state);
    await owned(tx, scope);
    return {
      state,
      expectedHash: hash(state),
      changedRecords: next.records.length,
      revisions: next.revisions.length,
    };
  });
}
