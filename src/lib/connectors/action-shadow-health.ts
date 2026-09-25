import { and, asc, eq, inArray, notLike, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dataSources, sourceRecords } from "@/lib/db/schema";
import { isZendeskAccountReference } from "./zendesk-account-binding";

const DAY = 86_400_000;
// Three missed hourly opportunities merit investigation; this is an operator threshold,
// not a promise about vendor data latency or employee metric correctness.
const STALLED_AFTER = 3 * 60 * 60 * 1000;
const TYPES = [
  "zendesk_ticket_action_checkpoint_v2_shadow",
  "zendesk_agent_leg_checkpoint_v2_shadow",
] as const;
const checkpoint = z.object({
  key: z.string(),
  type: z.enum(TYPES),
  accountReference: z.string(),
  start: z.string().datetime(),
  endExclusive: z.string().datetime(),
  status: z.enum(["pending", "waiting", "complete"]),
  pages: z.number().int().nonnegative().safe(),
  watermark: z.number().int().nonnegative().safe(),
  notBefore: z.string().datetime().nullable(),
  updatedAt: z.date(),
});

export function summarizeActionShadowHealth(
  rows: unknown[],
  accountReference: string,
  now = new Date()
) {
  const instant = now.getTime();
  if (!Number.isFinite(instant) || !isZendeskAccountReference(accountReference))
    throw new Error("Invalid shadow health scope");
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const latestEnd = instant - midnight < 120_000 ? midnight - DAY : midnight;
  const base = {
    observedAt: now.toISOString(),
    expectedThrough: new Date(latestEnd).toISOString(),
    publicationVerified: false,
    stalledAfterHours: 3,
  };
  if (rows.length > 1000)
    return { ...base, status: "attention" as const, reason: "checkpoint_limit" };
  if (!rows.length) return { ...base, status: "not_started" as const, completedDays: 0 };
  const parsed = z.array(checkpoint).safeParse(rows);
  if (!parsed.success)
    return { ...base, status: "attention" as const, reason: "invalid_checkpoint" };
  const days = new Map<number, z.infer<typeof checkpoint>[]>();
  for (const row of parsed.data) {
    const start = Date.parse(row.start),
      end = Date.parse(row.endExclusive);
    if (
      row.accountReference !== accountReference ||
      row.key !== `${row.start}/${row.endExclusive}` ||
      start % DAY !== 0 ||
      end - start !== DAY ||
      end > latestEnd ||
      !Number.isFinite(row.updatedAt.getTime()) ||
      row.updatedAt.getTime() > instant + 60_000 ||
      (row.status === "complete" && row.watermark * 1000 < end)
    )
      return { ...base, status: "attention" as const, reason: "invalid_checkpoint" };
    const pair = days.get(start) ?? [];
    if (pair.some((other) => other.type === row.type))
      return { ...base, status: "attention" as const, reason: "duplicate_stream" };
    pair.push(row);
    days.set(start, pair);
  }
  const starts = [...days.keys()].sort((a, b) => a - b);
  let completedDays = 0;
  let oldestPending: number | null = null;
  let stalled = false;
  let retryAt: number | null = null;
  let lastProgress = 0;
  for (const [index, start] of starts.entries()) {
    if (index && start !== starts[index - 1]! + DAY)
      return {
        ...base,
        status: "attention" as const,
        reason: "missing_day",
        firstMissingDay: new Date(starts[index - 1]! + DAY).toISOString(),
      };
    const pair = days.get(start)!;
    const changed = Math.max(...pair.map((row) => row.updatedAt.getTime()));
    lastProgress = Math.max(lastProgress, changed);
    if (pair.length === 2 && pair.every((row) => row.status === "complete")) completedDays++;
    else if (oldestPending === null) {
      // The worker resumes the oldest unfinished day first. Later missing days
      // must not override that day's persisted retry deadline or progress clock.
      oldestPending = start;
      const pending = pair.filter((row) => row.status !== "complete");
      const due = pending.map((row) => (row.notBefore ? Date.parse(row.notBefore) : 0));
      if (pair.length !== 2) due.push(0); // A missing stream is ready to be initialized.
      const earliest = Math.min(...due);
      if (earliest > instant) retryAt = earliest;
      else {
        if (instant - Math.max(changed, start + DAY + 120_000) >= STALLED_AFTER) stalled = true;
      }
    }
  }
  const lastEnd = starts[starts.length - 1]! + DAY;
  if (lastEnd < latestEnd && oldestPending === null) {
    oldestPending = lastEnd;
    if (instant - Math.max(lastProgress, lastEnd + DAY + 120_000) >= STALLED_AFTER) stalled = true;
  }
  return {
    ...base,
    status: stalled
      ? ("attention" as const)
      : oldestPending !== null
        ? ("pending" as const)
        : ("current" as const),
    ...(stalled ? { reason: "no_progress" } : {}),
    completedDays,
    oldestPendingDay: oldestPending === null ? null : new Date(oldestPending).toISOString(),
    nextRetryAt: retryAt === null ? null : new Date(retryAt).toISOString(),
    lastProgressAt: new Date(lastProgress).toISOString(),
  };
}

/** Read checkpoint metadata only. Never creates a cursor, lease, source request or fact. */
export async function readActionShadowHealth(
  organizationId: string,
  dataSourceId: string,
  accountReference: string,
  now = new Date()
) {
  const [source] = await db
    .select()
    .from(dataSources)
    .where(and(eq(dataSources.id, dataSourceId), eq(dataSources.organizationId, organizationId)));
  if (
    !source ||
    !["zendesk", "staging"].includes(source.type) ||
    source.configurationReference !== accountReference ||
    !isZendeskAccountReference(accountReference)
  )
    throw new Error("Shadow health source binding does not match");
  if (source.status !== "configured")
    return { status: "disabled" as const, publicationVerified: false };
  const rows = await db
    .select({
      key: sourceRecords.externalRecordId,
      type: sourceRecords.externalRecordType,
      updatedAt: sourceRecords.ingestedAt,
      accountReference: sql<unknown>`${sourceRecords.payloadJson}->'accountReference'`,
      start: sql<unknown>`${sourceRecords.payloadJson}->'start'`,
      endExclusive: sql<unknown>`${sourceRecords.payloadJson}->'endExclusive'`,
      status: sql<unknown>`${sourceRecords.payloadJson}->'status'`,
      pages: sql<unknown>`${sourceRecords.payloadJson}->'pages'`,
      watermark: sql<unknown>`${sourceRecords.payloadJson}->'watermark'`,
      notBefore: sql<unknown>`${sourceRecords.payloadJson}->'notBefore'`,
    })
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        inArray(sourceRecords.externalRecordType, TYPES),
        notLike(sourceRecords.externalRecordId, "%/observation/%")
      )
    )
    .orderBy(asc(sourceRecords.externalRecordId))
    .limit(1001);
  return summarizeActionShadowHealth(rows, accountReference, now);
}
