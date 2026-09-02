import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const diffGroups: Record<string, unknown>[] = await db.execute(sql`
    SELECT
      nf.source_record_id,
      nf.fact_type,
      nf.employee_id,
      nf.period_start,
      nf.period_end,
      COUNT(*)::int as cnt,
      COUNT(DISTINCT numeric_value)::int as distinct_numeric,
      array_agg(numeric_value ORDER BY created_at) as values_by_time,
      array_agg(created_at ORDER BY created_at) as created_ats,
      MIN(numeric_value) as min_val,
      MAX(numeric_value) as max_val
    FROM normalized_facts nf
    GROUP BY nf.source_record_id, nf.fact_type, nf.employee_id, nf.period_start, nf.period_end
    HAVING COUNT(DISTINCT numeric_value) > 1
    ORDER BY nf.fact_type, nf.employee_id
  `);

  console.log(`=== GROUPS WITH DIFFERENT VALUES: ${diffGroups.length} ===\n`);

  for (const g of diffGroups) {
    console.log(`fact_type: ${g.fact_type}`);
    console.log(`  employee: ${String(g.employee_id).slice(0, 8)}...`);
    console.log(`  period: ${g.period_start} to ${g.period_end}`);
    console.log(`  source_record: ${String(g.source_record_id).slice(0, 8)}...`);
    console.log(`  count: ${g.cnt}`);
    console.log(`  values (by time): ${JSON.stringify(g.values_by_time)}`);
    console.log(`  min: ${g.min_val}, max: ${g.max_val}`);
    console.log();
  }

  // Also check the source record payloads for these groups
  if (diffGroups.length > 0) {
    console.log("=== SOURCE RECORD PAYLOADS FOR AFFECTED GROUPS ===\n");
    for (const g of diffGroups) {
      const sr: Record<string, unknown>[] = await db.execute(sql`
        SELECT id, payload_json, payload_hash, source_updated_at, ingested_at
        FROM source_records
        WHERE id = ${String(g.source_record_id)}
      `);
      if (sr.length > 0) {
        const payload = sr[0]!.payload_json as Record<string, unknown>;
        const factType = String(g.fact_type);
        console.log(`source_record ${String(g.source_record_id).slice(0, 8)}...`);
        console.log(`  payload.${factType} = ${JSON.stringify(payload[factType])}`);
        console.log(`  ingested_at: ${sr[0]!.ingested_at}`);
        console.log(`  source_updated_at: ${sr[0]!.source_updated_at}`);
        console.log(`  payload_hash: ${String(sr[0]!.payload_hash).slice(0, 16)}...`);
        console.log();
      }
    }
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
