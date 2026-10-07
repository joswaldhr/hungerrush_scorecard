import { createHash } from "node:crypto";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { sourceRecords } from "@/lib/db/schema";
import { sevenDayPeriodEnd } from "@/lib/domain/metrics/effective-dates";
import { advanceTalkCursor, initialTalkCursor } from "./zendesk-talk-cursor";
import { legacyTalkCallSchema, type LegacyTalkCall } from "./zendesk-talk-legacy-schema";
import {
  talkCheckpointSchema,
  withTalkCollectionLease,
  type TalkOwnedScope,
} from "./zendesk-talk-store";

// Separate namespaces preserve existing participation checkpoints and payload hashes.
const CHECKPOINT = "zendesk_legacy_talk_checkpoint_v1";
const RECORD = "zendesk_legacy_talk_record_v1";
const REVISION = "zendesk_legacy_talk_revision_v1";
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const stateSchema = talkCheckpointSchema.extend({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
});
type State = z.infer<typeof stateSchema>;
type Tx = Parameters<Parameters<typeof withTalkCollectionLease>[1]>[0];
const filter = (scope: TalkOwnedScope, type: string, key: string) =>
  and(
    eq(sourceRecords.dataSourceId, scope.dataSourceId),
    eq(sourceRecords.externalRecordType, type),
    eq(sourceRecords.externalRecordId, key)
  );
function period(start: string, end: string) {
  if (
    !z.iso.date().safeParse(start).success ||
    new Date(`${start}T00:00:00Z`).getUTCDay() !== 0 ||
    end !== sevenDayPeriodEnd(start)
  )
    throw Error("Invalid legacy Talk reporting week");
  return Date.parse(`${start}T00:00:00Z`) / 1000;
}
function checked(
  payload: unknown,
  hash: string | null,
  scope: TalkOwnedScope,
  start: string,
  end: string
) {
  const state = stateSchema.parse(payload);
  const bootstrap = period(start, end);
  const cursor = initialTalkCursor(
    `https://${scope.accountReference.slice("zendesk-account:".length)}.zendesk.com`,
    "calls",
    bootstrap
  );
  if (
    hash !== digest(state) ||
    state.accountReference !== scope.accountReference ||
    state.periodStart !== start ||
    state.periodEnd !== end ||
    state.bootstrapStart !== bootstrap ||
    state.cursor.origin !== cursor.origin ||
    state.cursor.resource !== "calls" ||
    state.cursor.initialStartTime < bootstrap ||
    state.cursor.watermark < state.cursor.initialStartTime ||
    state.cursor.pages !== state.cursor.visited.length ||
    (state.cursor.pages === 0) !== (state.lastPageAt === null) ||
    (state.lastPageAt !== null &&
      Date.parse(state.lastPageAt) < Date.parse(state.observationStartedAt))
  )
    throw Error("Invalid legacy Talk checkpoint binding or digest");
  return state;
}
async function write(
  tx: Tx,
  scope: TalkOwnedScope,
  type: string,
  rows: Array<{ key: string; payload: unknown }>
) {
  for (let offset = 0; offset < rows.length; offset += 200) {
    await tx
      .insert(sourceRecords)
      .values(
        rows.slice(offset, offset + 200).map((row) => ({
          dataSourceId: scope.dataSourceId,
          externalRecordType: type,
          externalRecordId: row.key,
          payloadJson: row.payload,
          payloadHash: digest(row.payload),
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

/** Pending work resumes exactly; completed weeks refresh from a five-minute overlap. */
export async function beginLegacyTalkCycle(scope: TalkOwnedScope, start: string, end: string) {
  const bootstrapStart = period(start, end);
  return withTalkCollectionLease(scope, async (tx, now) => {
    if (bootstrapStart > Math.floor(now / 1000) - 120)
      throw Error("Legacy Talk week precedes source availability");
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope, CHECKPOINT, start));
    const before = row ? checked(row.payloadJson, row.payloadHash, scope, start, end) : null;
    if (before?.cursor.status === "pending")
      return { state: before, expectedHash: row!.payloadHash! };
    const state: State = stateSchema.parse({
      accountReference: scope.accountReference,
      bootstrapStart,
      periodStart: start,
      periodEnd: end,
      cycle: (before?.cycle ?? 0) + 1,
      observationStartedAt: new Date(now).toISOString(),
      lastPageAt: null,
      cursor: initialTalkCursor(
        `https://${scope.accountReference.slice("zendesk-account:".length)}.zendesk.com`,
        "calls",
        before ? Math.max(bootstrapStart, before.cursor.watermark - 300) : bootstrapStart
      ),
    });
    await write(tx, scope, CHECKPOINT, [{ key: start, payload: state }]);
    return { state, expectedHash: digest(state) };
  });
}

/** Records, predecessor versions and cursor commit together, under the shared account fence. */
export async function commitLegacyTalkPage(
  scope: TalkOwnedScope,
  start: string,
  end: string,
  expectedHash: string,
  response: unknown
) {
  period(start, end);
  const page = z.object({ calls: z.array(legacyTalkCallSchema).max(1000) }).parse(response);
  const keys = [...new Set(page.calls.map((c) => `${start}:${c.id}`))];
  const versionKeys = [...new Set(page.calls.map((c) => `${start}:${c.id}:${c.updated_at}`))];
  return withTalkCollectionLease(scope, async (tx, now) => {
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope, CHECKPOINT, start));
    if (!row || row.payloadHash !== expectedHash)
      throw Error("Legacy Talk checkpoint changed before commit");
    const before = checked(row.payloadJson, row.payloadHash, scope, start, end);
    const rows = async (type: string, ids: string[]) =>
      ids.length
        ? tx
            .select()
            .from(sourceRecords)
            .where(
              and(
                eq(sourceRecords.dataSourceId, scope.dataSourceId),
                eq(sourceRecords.externalRecordType, type),
                inArray(sourceRecords.externalRecordId, ids)
              )
            )
        : [];
    const latest = await rows(RECORD, keys);
    const versions = await rows(REVISION, versionKeys);
    const next = advanceTalkCursor(
      before.cursor,
      response,
      latest.map((r) => {
        const call = legacyTalkCallSchema.parse(r.payloadJson);
        if (r.externalRecordId !== `${start}:${call.id}` || r.payloadHash !== digest(call))
          throw Error("Invalid retained legacy Talk record");
        return call;
      }),
      versions.map((r) => {
        const revision = z
          .object({ record: legacyTalkCallSchema, digest: z.string() })
          .parse(r.payloadJson);
        if (
          r.externalRecordId !== `${start}:${revision.record.id}:${revision.record.updated_at}` ||
          r.payloadHash !== digest(revision) ||
          revision.digest !== digest(revision.record)
        )
          throw Error("Invalid retained legacy Talk revision");
        return {
          id: revision.record.id,
          updatedAt: revision.record.updated_at,
          digest: revision.digest,
        };
      }),
      "legacy"
    );
    const [population] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(sourceRecords)
      .where(
        and(
          eq(sourceRecords.dataSourceId, scope.dataSourceId),
          eq(sourceRecords.externalRecordType, RECORD),
          sql`${sourceRecords.externalRecordId} like ${`${start}:%`}`
        )
      );
    const existing = new Set(latest.map((r) => r.externalRecordId));
    if (
      population!.count + next.records.filter((c) => !existing.has(`${start}:${c.id}`)).length >
      250000
    )
      throw Error("Legacy Talk retained population exceeds snapshot capacity");
    await write(
      tx,
      scope,
      REVISION,
      next.revisions.map((revision) => ({
        key: `${start}:${revision.record.id}:${revision.record.updated_at}`,
        payload: revision,
      }))
    );
    await write(
      tx,
      scope,
      RECORD,
      next.records.map((call) => ({ key: `${start}:${call.id}`, payload: call }))
    );
    const state = { ...before, cursor: next.cursor, lastPageAt: new Date(now).toISOString() };
    await write(tx, scope, CHECKPOINT, [{ key: start, payload: state }]);
    return { state, expectedHash: digest(state) };
  });
}

/** Only a freshly exhausted cycle can feed the existing whole-call calculation. */
export async function readLegacyTalkWeek(
  scope: TalkOwnedScope,
  start: string,
  end: string,
  expectedHash: string
) {
  const first = period(start, end) * 1000;
  const last = Date.parse(`${end}T00:00:00Z`) + 86400000;
  return withTalkCollectionLease(scope, async (tx, now) => {
    const [row] = await tx
      .select()
      .from(sourceRecords)
      .where(filter(scope, CHECKPOINT, start));
    if (!row || row.payloadHash !== expectedHash)
      throw Error("Legacy Talk checkpoint changed before read");
    const state = checked(row.payloadJson, row.payloadHash, scope, start, end);
    if (
      state.cursor.status !== "exhausted" ||
      !state.lastPageAt ||
      now - Date.parse(state.lastPageAt) > 300000 ||
      Date.parse(state.lastPageAt) > now
    )
      throw Error("Legacy Talk observation incomplete or no longer fresh");
    const rows = await tx
      .select()
      .from(sourceRecords)
      .where(
        and(
          eq(sourceRecords.dataSourceId, scope.dataSourceId),
          eq(sourceRecords.externalRecordType, RECORD),
          sql`${sourceRecords.externalRecordId} like ${`${start}:%`}`
        )
      )
      .limit(250001);
    if (rows.length > 250000)
      throw Error("Legacy Talk retained population exceeds snapshot capacity");
    const calls: LegacyTalkCall[] = [];
    for (const record of rows) {
      const call = legacyTalkCallSchema.parse(record.payloadJson);
      if (record.externalRecordId !== `${start}:${call.id}` || record.payloadHash !== digest(call))
        throw Error("Invalid legacy Talk snapshot record");
      const created = Date.parse(call.created_at);
      if (created >= first && created < last) calls.push(call);
    }
    return {
      calls,
      observationStartedAt: state.observationStartedAt,
      observationEndedAt: state.lastPageAt,
    };
  });
}
