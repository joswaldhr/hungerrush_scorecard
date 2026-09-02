import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  const sr: Record<string, unknown>[] = await db.execute(sql`
    SELECT id, payload_json FROM source_records WHERE id::text LIKE 'df1c9b58%'
  `);
  if (sr.length > 0) {
    console.log("Source record payload:");
    console.log(JSON.stringify(sr[0]!.payload_json, null, 2));
  }

  // Also check: what are the most recent fact values (the ones that should survive)?
  const newest: Record<string, unknown>[] = await db.execute(sql`
    SELECT DISTINCT ON (source_record_id, fact_type)
      fact_type, numeric_value, created_at
    FROM normalized_facts
    WHERE source_record_id::text LIKE 'df1c9b58%'
    ORDER BY source_record_id, fact_type, created_at DESC
  `);
  console.log("\nNewest facts (survivors):");
  for (const row of newest) {
    console.log(`  ${row.fact_type}: ${row.numeric_value} (created ${row.created_at})`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
