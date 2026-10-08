import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { syncErrors, syncRuns } from "@/lib/db/schema";
import { readTalkCollectionSnapshot } from "./zendesk-talk-store";
import { validateTalkObservation } from "./zendesk-talk-observation";
import type { ZendeskTalkPolicy } from "./zendesk-talk-policy";

/** Resume only an observation that actually failed its parent join, within the
 * original freshness policy. Successful publications never hold legs indefinitely.
 * This chooses source collection only; the normal publisher still qualifies all data.
 */
export async function planOutboundRecovery(
  policy: ZendeskTalkPolicy,
  periodStart: string,
  periodEnd: string,
  now = new Date()
) {
  const stored = await readTalkCollectionSnapshot(policy);
  const snapshot = stored.snapshot;
  if (!snapshot) return { mode: "both" as const };
  const missing = new Set(snapshot.missingParentCallIds);
  if (
    !snapshot.legs.some(
      (leg) => ["agent", "supervisor"].includes(leg.type) && missing.has(leg.call_id)
    )
  )
    return { mode: "both" as const };
  // Leave room for the complete bounded collection and Support phase. A new
  // cycle is required when the held legs would exceed the joined-window limit.
  const started = Date.parse(snapshot.legsState.observationStartedAt);
  if (now.getTime() + 240000 - started > policy.observationLimits.maxSpanMs)
    return { mode: "both" as const };
  validateTalkObservation(
    snapshot,
    policy.accountReference,
    {
      periodStart,
      periodEnd,
      timeZone: policy.reportingTimeZone,
    },
    policy.observationLimits,
    now
  );
  const [failedObservation] = await db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .innerJoin(syncErrors, eq(syncErrors.syncRunId, syncRuns.id))
    .where(
      and(
        eq(syncRuns.dataSourceId, policy.dataSourceId),
        eq(syncRuns.status, "failed"),
        eq(syncErrors.message, "Incomplete outbound parent-call coverage"),
        // A relative offset can identify a different interval after Sunday. Old
        // offset-only runs safely collect both streams instead of holding legs.
        sql`${syncRuns.metadataJson}->'period'->>'periodStart' = ${periodStart}`,
        sql`${syncRuns.metadataJson}->'period'->>'periodEnd' = ${periodEnd}`,
        sql`${syncRuns.startedAt} <= ${snapshot.legsState.observationStartedAt}::timestamptz`,
        sql`${syncRuns.completedAt} >= ${snapshot.legsState.lastPageAt}::timestamptz`,
        sql`not exists (
        select 1 from sync_runs published
        where published.data_source_id = ${policy.dataSourceId}
          and published.status = 'completed'
          and published.started_at >= ${syncRuns.startedAt}
          and published.metadata_json->'fetch'->>'family' = 'outbound_call_participation'
          and published.metadata_json->'period'->>'periodStart' = ${periodStart}
          and published.metadata_json->'period'->>'periodEnd' = ${periodEnd}
      )`
      )
    )
    .limit(1);
  return failedObservation
    ? { mode: "calls-only" as const, legsState: snapshot.legsState }
    : { mode: "both" as const };
}
