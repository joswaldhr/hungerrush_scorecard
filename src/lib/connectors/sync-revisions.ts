import type { db } from "@/lib/db";
import { sourceRecords, normalizedFacts, metricValues, syncRevisions } from "@/lib/db/schema";
import { sql, type SQL } from "drizzle-orm";

/** Preserve prior evidence before replacing rows, inside the publication transaction. */
export async function captureSyncRevisions(
  connection: typeof db,
  entity: "source_record" | "normalized_fact" | "metric_value",
  condition: SQL,
  syncRunId: string
) {
  const table = {
    source_record: sourceRecords,
    normalized_fact: normalizedFacts,
    metric_value: metricValues,
  }[entity];
  await connection.execute(sql`insert into ${syncRevisions}
    (sync_run_id, entity_type, entity_id, snapshot_json)
    select ${syncRunId}::uuid, ${entity}, ${table.id}, to_jsonb(${table})
    from ${table} where ${condition}`);
}
