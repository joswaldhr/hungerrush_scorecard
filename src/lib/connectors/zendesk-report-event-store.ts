import { randomUUID } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { dataSources, sourceRecords } from "@/lib/db/schema";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import {
  reportEventChannels,
  reportChannelCoverage,
  reportEventChannelSchema,
} from "./zendesk-report-event-channels";
import {
  advanceReportEventCursor,
  initialReportEventCursor,
  parseReportEventPage,
  reportEventCursorSchema,
  reportEventDigest,
  validateReportEventCursor,
  type ReportEvent,
} from "./zendesk-report-event-cursor";

// Separate from every shadow/v2 namespace; these records cannot publish metric facts.
const LEASE = "zendesk_report_event_lease_v1",
  CHECKPOINT = "zendesk_report_event_checkpoint_v1",
  EVENT = "zendesk_report_event_v1",
  CHANNEL = "zendesk_report_event_channel_v1";
// Incremental export quota is shared with the account's other integrations.
// Production's eleven-second spacing still received 429s; reserve more headroom.
export const REPORT_EVENT_SPACING_MS = 20000;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export interface ReportEventScope {
  organizationId: string;
  dataSourceId: string;
  accountReference: string;
}
export interface OwnedReportEventScope extends ReportEventScope {
  token: string;
}
const leaseSchema = z.object({
  token: z.uuid(),
  expiresAt: z.iso.datetime(),
  nextAllowedAt: z.iso.datetime(),
});
const stateSchema = z.object({
  version: z.literal(1),
  cycle: z.number().int().positive(),
  observationStartedAt: z.iso.datetime(),
  lastPageAt: z.iso.datetime().nullable(),
  cursor: reportEventCursorSchema,
});
const filter = (source: string, type: string, key: string) =>
  and(
    eq(sourceRecords.dataSourceId, source),
    eq(sourceRecords.externalRecordType, type),
    eq(sourceRecords.externalRecordId, key)
  );
async function validateSource(tx: Tx, scope: ReportEventScope, lock = false) {
  if (!isZendeskAccountReference(scope.accountReference))
    throw Error("Invalid report collection account");
  if (lock)
    await tx.execute(sql`select id from data_sources where id=${scope.dataSourceId} for update`);
  const [source] = await tx
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.id, scope.dataSourceId),
        eq(dataSources.organizationId, scope.organizationId)
      )
    );
  if (
    !source ||
    source.type !== "zendesk" ||
    source.status !== "configured" ||
    source.configurationReference !== scope.accountReference
  )
    throw Error("Report collection source binding not permitted");
}
async function lockSource(tx: Tx, scope: ReportEventScope) {
  await tx.execute(
    sql`select set_config('lock_timeout','3000',true),set_config('statement_timeout','20000',true)`
  );
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${scope.accountReference},0))`
  );
  await validateSource(tx, scope, true);
}
async function clock(tx: Tx) {
  const [r] = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
  return Date.parse(r!.now);
}
async function put(tx: Tx, scope: ReportEventScope, type: string, key: string, payload: unknown) {
  const values = {
    dataSourceId: scope.dataSourceId,
    externalRecordType: type,
    externalRecordId: key,
    payloadJson: payload,
    payloadHash: reportEventDigest(payload),
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
async function owned(tx: Tx, scope: OwnedReportEventScope) {
  await lockSource(tx, scope);
  const [row] = await tx
    .select()
    .from(sourceRecords)
    .where(filter(scope.dataSourceId, LEASE, scope.accountReference));
  const lease = leaseSchema.safeParse(row?.payloadJson),
    now = await clock(tx);
  if (!lease.success || lease.data.token !== scope.token || Date.parse(lease.data.expiresAt) <= now)
    throw Error("Report collection lease is no longer owned");
  return { lease: lease.data, now };
}
/** Acquire account then source locks before a consumer publishes its bounded read. */
export async function assertReportAccountOwnership(tx: Tx, scope: OwnedReportEventScope) {
  await owned(tx, scope);
}
export async function claimReportEventCollection(scope: ReportEventScope) {
  return db.transaction(async (tx) => {
    await lockSource(tx, scope);
    const now = await clock(tx);
    // Publication routes claim their sync lease under this same account lock.
    // A preflight read alone would race a different source/week's publisher.
    const [sync] = await tx.execute<{ retry_at: Date }>(sql`
      select max(coalesce((r.metadata_json->>'leaseExpiresAt')::timestamptz,
        r.started_at + interval '10 minutes')) as retry_at
      from sync_runs r join data_sources s on s.id=r.data_source_id
      where s.type='zendesk' and s.configuration_reference=${scope.accountReference}
        and r.status='running'
        and coalesce((r.metadata_json->>'leaseExpiresAt')::timestamptz,
          r.started_at + interval '10 minutes') > clock_timestamp()
    `);
    if (sync?.retry_at)
      return { acquired: false as const, retryAt: new Date(sync.retry_at).toISOString() };
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
      expiresAt: new Date(now + 360000).toISOString(),
      nextAllowedAt: new Date(
        Math.max(now, ...leases.map((l) => Date.parse(l.nextAllowedAt)))
      ).toISOString(),
    };
    await put(tx, scope, LEASE, scope.accountReference, lease);
    return { acquired: true as const, ...lease };
  });
}
export async function reserveReportEventRequest(scope: OwnedReportEventScope) {
  return db.transaction(async (tx) => {
    const { lease, now } = await owned(tx, scope);
    if (Date.parse(lease.nextAllowedAt) > now)
      return { reserved: false as const, waitMs: Date.parse(lease.nextAllowedAt) - now };
    await put(tx, scope, LEASE, scope.accountReference, {
      ...lease,
      nextAllowedAt: new Date(now + REPORT_EVENT_SPACING_MS).toISOString(),
    });
    return { reserved: true as const, waitMs: 0 };
  });
}
export async function deferReportEventRequests(scope: OwnedReportEventScope, delay: number) {
  if (!Number.isFinite(delay) || delay < 0 || delay > 86400000)
    throw Error("Invalid report retry delay");
  await db.transaction(async (tx) => {
    const { lease, now } = await owned(tx, scope);
    await put(tx, scope, LEASE, scope.accountReference, {
      ...lease,
      nextAllowedAt: new Date(Math.max(Date.parse(lease.nextAllowedAt), now + delay)).toISOString(),
    });
  });
}
export async function releaseReportEventCollection(scope: OwnedReportEventScope) {
  await db.transaction(async (tx) => {
    await lockSource(tx, scope);
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope.dataSourceId, LEASE, scope.accountReference));
    const lease = leaseSchema.safeParse(row?.payloadJson);
    if (lease.success && lease.data.token === scope.token)
      await put(tx, scope, LEASE, scope.accountReference, {
        ...lease.data,
        expiresAt: new Date(0).toISOString(),
      });
  });
}
function stateOf(row: typeof sourceRecords.$inferSelect, scope: ReportEventScope) {
  const state = stateSchema.parse(row.payloadJson);
  state.cursor = validateReportEventCursor(state.cursor);
  if (
    state.cursor.accountReference !== scope.accountReference ||
    reportEventDigest(state) !== row.payloadHash ||
    (state.cursor.pages === 0) !== (state.lastPageAt === null) ||
    (state.lastPageAt !== null &&
      Date.parse(state.lastPageAt) < Date.parse(state.observationStartedAt))
  )
    throw Error("Invalid retained report checkpoint");
  return state;
}
/** An interrupted cycle resumes. Only an exhausted cycle starts a bounded overlap refresh. */
export async function beginReportEventCycle(scope: OwnedReportEventScope, bootstrapStart: number) {
  const initial = initialReportEventCursor(scope.accountReference, bootstrapStart);
  return db.transaction(async (tx) => {
    const { now } = await owned(tx, scope);
    if (bootstrapStart > Math.floor(now / 1000) - 120)
      throw Error("Report bootstrap must precede source delay");
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope.dataSourceId, CHECKPOINT, "stream"));
    const previous = row ? stateOf(row, scope) : undefined;
    if (previous && previous.cursor.bootstrapStart !== bootstrapStart)
      throw Error("Report bootstrap changed; explicit rebootstrap required");
    if (previous?.cursor.status === "pending")
      return { state: previous, expectedHash: row!.payloadHash! };
    const state = {
      version: 1 as const,
      cycle: (previous?.cycle ?? 0) + 1,
      observationStartedAt: new Date(now).toISOString(),
      lastPageAt: null,
      cursor: previous
        ? initialReportEventCursor(
            scope.accountReference,
            bootstrapStart,
            Math.max(bootstrapStart, previous.cursor.watermark - 300)
          )
        : initial,
    };
    await put(tx, scope, CHECKPOINT, "stream", state);
    return { state, expectedHash: reportEventDigest(state) };
  });
}
/** Immutable minimized events and their continuation commit together, fenced by DB ownership. */
export async function commitReportEventPage(
  scope: OwnedReportEventScope,
  expectedHash: string,
  response: unknown
) {
  return db.transaction(async (tx) => {
    const { now } = await owned(tx, scope);
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope.dataSourceId, CHECKPOINT, "stream"));
    if (!row || row.payloadHash !== expectedHash)
      throw Error("Report checkpoint changed before commit");
    const before = stateOf(row, scope),
      next = advanceReportEventCursor(before.cursor, response, new Date(now));
    const keys = next.records.map((r) => String(r.id));
    const known = keys.length
      ? await tx
          .select()
          .from(sourceRecords)
          .where(
            and(
              eq(sourceRecords.dataSourceId, scope.dataSourceId),
              eq(sourceRecords.externalRecordType, EVENT),
              inArray(sourceRecords.externalRecordId, keys)
            )
          )
      : [];
    const hashes = new Map(known.map((r) => [r.externalRecordId, r.payloadHash]));
    for (const event of next.records)
      if (hashes.has(String(event.id)) && hashes.get(String(event.id)) !== reportEventDigest(event))
        throw Error("Retained report event changed; publication requires reconciliation");
    const fresh = next.records.filter((r) => !hashes.has(String(r.id)));
    for (let n = 0; n < fresh.length; n += 200)
      await tx.insert(sourceRecords).values(
        fresh.slice(n, n + 200).map((r) => ({
          dataSourceId: scope.dataSourceId,
          externalRecordType: EVENT,
          externalRecordId: String(r.id),
          payloadJson: r,
          payloadHash: reportEventDigest(r),
        }))
      );
    // Preserve v1 event bytes/digests. An overlapping old event may gain separately
    // bound channel evidence; a changed known channel must never silently overwrite it.
    const channels =
      env.ZENDESK_REPORT_EVENT_CHANNEL_RETENTION === "1" ? reportEventChannels(response) : [];
    const retainedChannels = channels.length
      ? await tx
          .select()
          .from(sourceRecords)
          .where(
            and(
              eq(sourceRecords.dataSourceId, scope.dataSourceId),
              eq(sourceRecords.externalRecordType, CHANNEL),
              inArray(
                sourceRecords.externalRecordId,
                channels.map((record) => String(record.eventId))
              )
            )
          )
      : [];
    const channelHashes = new Map(
      retainedChannels.map((record) => [record.externalRecordId, record.payloadHash])
    );
    for (const record of channels)
      if (
        channelHashes.has(String(record.eventId)) &&
        channelHashes.get(String(record.eventId)) !== reportEventDigest(record)
      )
        throw Error("Retained report channel changed; publication requires reconciliation");
    const freshChannels = channels.filter((record) => !channelHashes.has(String(record.eventId)));
    for (let n = 0; n < freshChannels.length; n += 200)
      await tx.insert(sourceRecords).values(
        freshChannels.slice(n, n + 200).map((record) => ({
          dataSourceId: scope.dataSourceId,
          externalRecordType: CHANNEL,
          externalRecordId: String(record.eventId),
          payloadJson: record,
          payloadHash: reportEventDigest(record),
        }))
      );
    const state = { ...before, cursor: next.cursor, lastPageAt: new Date(now).toISOString() };
    await put(tx, scope, CHECKPOINT, "stream", state);
    await owned(tx, scope);
    return { state, expectedHash: reportEventDigest(state), newEvents: fresh.length };
  });
}
/** Consistent bounded interval read; endpoint exhaustion alone does not qualify parent joins. */
export async function readReportEventSnapshot(
  scope: ReportEventScope,
  start: Date,
  endExclusive: Date,
  agentIds: number[],
  options: { capAtWatermark?: boolean; includeChannels?: boolean } = {}
) {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(endExclusive.getTime()) ||
    start >= endExclusive ||
    endExclusive.getTime() - start.getTime() > 32 * 86400000 ||
    !agentIds.length ||
    agentIds.length > 500 ||
    agentIds.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(agentIds).size !== agentIds.length
  )
    throw Error("Invalid report snapshot scope");
  return db.transaction(
    async (tx) => {
      await validateSource(tx, scope);
      await tx.execute(sql`select set_config('statement_timeout','20000',true)`);
      const [row] = await tx
        .select()
        .from(sourceRecords)
        .where(filter(scope.dataSourceId, CHECKPOINT, "stream"));
      if (!row) return { status: "collecting" as const, snapshot: null };
      const state = stateOf(row, scope);
      const end = options.capAtWatermark
        ? new Date(Math.min(endExclusive.getTime(), state.cursor.watermark * 1000))
        : endExclusive;
      if (
        state.cursor.status !== "exhausted" ||
        state.cursor.bootstrapStart * 1000 > start.getTime() ||
        state.cursor.watermark * 1000 < end.getTime() ||
        end <= start
      )
        return { status: "collecting" as const, snapshot: null };
      const rows = await tx
        .select()
        .from(sourceRecords)
        .where(
          and(
            eq(sourceRecords.dataSourceId, scope.dataSourceId),
            eq(sourceRecords.externalRecordType, EVENT),
            sql`(${sourceRecords.payloadJson}->>'created_at')::timestamptz>=${start.toISOString()}::timestamptz`,
            sql`(${sourceRecords.payloadJson}->>'created_at')::timestamptz<${end.toISOString()}::timestamptz`,
            sql`(${sourceRecords.payloadJson}->>'updater_id')::bigint in (${sql.join(
              agentIds.map((id) => sql`${id}`),
              sql`,`
            )})`
          )
        )
        .limit(100001);
      if (rows.length > 100000) throw Error("Report event snapshot capacity exceeded");
      const events: ReportEvent[] = [];
      for (const record of rows) {
        const event = parseReportEventPage({
          ticket_events: [record.payloadJson],
          count: 1,
          end_time: state.cursor.watermark,
          end_of_stream: true,
          next_page: null,
        }).ticket_events[0]!;
        if (
          String(event.id) !== record.externalRecordId ||
          reportEventDigest(event) !== record.payloadHash
        )
          throw Error("Invalid retained report event identity or digest");
        events.push(event);
      }
      // Existing solved readers do not need channels and incur no extra query.
      let channels;
      if (options.includeChannels) {
        const channelRows = events.length
          ? await tx
              .select()
              .from(sourceRecords)
              .where(
                and(
                  eq(sourceRecords.dataSourceId, scope.dataSourceId),
                  eq(sourceRecords.externalRecordType, CHANNEL),
                  sql`${sourceRecords.externalRecordId} in (select jsonb_array_elements_text(${JSON.stringify(events.map((event) => String(event.id)))}::jsonb))`
                )
              )
              .limit(100001)
          : [];
        const evidence = channelRows.map((record) => {
          const value = reportEventChannelSchema.parse(record.payloadJson);
          if (
            String(value.eventId) !== record.externalRecordId ||
            reportEventDigest(value) !== record.payloadHash
          )
            throw Error("Invalid retained report channel identity or digest");
          return value;
        });
        channels = reportChannelCoverage(events, evidence);
      }
      return {
        status: "ready" as const,
        snapshot: {
          events,
          ...(channels ? { channels } : {}),
          state,
          coverage: {
            start: start.toISOString(),
            endExclusive: end.toISOString(),
            complete: true,
          },
        },
      };
    },
    { accessMode: "read only", isolationLevel: "repeatable read" }
  );
}
