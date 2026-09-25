import { db } from "@/lib/db";
import { dataSources, syncRuns, syncErrors } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

type Connection = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Longer than the 300-second hosted invocation budget. Multi-week local jobs
// renew between connector pages. Database time owns expiry across instances.
const expiry = sql`clock_timestamp() + interval '10 minutes'`;

export async function createLeasedSyncRun(dataSourceId: string, weekOffset?: number) {
  const scope = weekOffset === undefined ? "all" : `week:${weekOffset}`;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select id from ${dataSources} where id = ${dataSourceId} for update`);
    const expired = await tx.execute<{ id: string }>(sql`
      update ${syncRuns} set status = 'failed', completed_at = clock_timestamp(),
        error_count = error_count + 1,
        metadata_json = coalesce(metadata_json, '{}'::jsonb) || '{"leaseExpired":true}'::jsonb
      where data_source_id = ${dataSourceId} and status = 'running'
        and coalesce((metadata_json->>'leaseExpiresAt')::timestamptz,
          started_at + interval '10 minutes') <= clock_timestamp()
      returning id
    `);
    if (expired.length)
      await tx.insert(syncErrors).values(
        expired.map((run) => ({
          syncRunId: run.id,
          errorType: "lease_expired",
          message: "Sync lease expired before completion",
          retryable: true,
        }))
      );
    const active = await tx.execute(sql`
      select id from ${syncRuns} where data_source_id = ${dataSourceId} and status = 'running'
        and (${scope} = 'all' or coalesce(metadata_json->>'leaseScope', 'all') in ('all', ${scope}))
      limit 1
    `);
    const [run] = await tx
      .insert(syncRuns)
      .values({
        dataSourceId,
        status: active.length ? "skipped" : "running",
        completedAt: active.length ? new Date() : null,
        metadataJson: active.length
          ? { reason: "An overlapping sync is already running", leaseScope: scope }
          : sql`jsonb_build_object('leaseScope', ${scope}::text, 'leaseExpiresAt', ${expiry})`,
      })
      .returning();
    if (!run) throw new Error("Failed to create sync run");
    return run;
  });
}

export async function renewSyncLease(syncRunId: string, connection: Connection | typeof db = db) {
  const renewed = await connection.execute(sql`
    update ${syncRuns} set metadata_json = jsonb_set(metadata_json, '{leaseExpiresAt}', to_jsonb(${expiry}))
    where id = ${syncRunId} and status = 'running'
      and (metadata_json->>'leaseExpiresAt')::timestamptz > clock_timestamp()
    returning id
  `);
  if (!renewed.length) throw new Error("Sync lease expired or was superseded");
}
