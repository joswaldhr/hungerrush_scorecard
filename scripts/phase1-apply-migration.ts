import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("=== APPLYING MIGRATION 0009: FACT IDENTITY ===\n");

  // Step 1: Delete duplicates
  console.log("Step 1: Deleting duplicate facts...");
  await db.execute(sql`
    DELETE FROM normalized_facts
    WHERE id IN (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY source_record_id, fact_type
            ORDER BY created_at DESC
          ) AS rn
        FROM normalized_facts
      ) sub
      WHERE rn > 1
    )
  `);
  const postDelete: Record<string, unknown>[] = await db.execute(
    sql`SELECT COUNT(*)::int as cnt FROM normalized_facts`
  );
  console.log(`  Facts remaining: ${postDelete[0]!.cnt}`);

  // Step 2: Add source_observed_at column
  console.log("Step 2: Adding source_observed_at column...");
  await db.execute(
    sql`ALTER TABLE normalized_facts ADD COLUMN IF NOT EXISTS source_observed_at timestamptz`
  );

  // Step 3: Backfill from source records
  console.log("Step 3: Backfilling source_observed_at...");
  await db.execute(sql`
    UPDATE normalized_facts nf
    SET source_observed_at = COALESCE(sr.source_updated_at, sr.occurred_at, sr.ingested_at)
    FROM source_records sr
    WHERE sr.id = nf.source_record_id
  `);

  // Verify no NULLs before making NOT NULL
  const nullCheck: Record<string, unknown>[] = await db.execute(
    sql`SELECT COUNT(*)::int as cnt FROM normalized_facts WHERE source_observed_at IS NULL`
  );
  if (Number(nullCheck[0]!.cnt) > 0) {
    console.error(`  ABORT: ${nullCheck[0]!.cnt} rows still have NULL source_observed_at`);
    process.exit(1);
  }
  console.log("  All rows have source_observed_at populated");

  // Step 4: NOT NULL constraint
  console.log("Step 4: Setting source_observed_at NOT NULL...");
  await db.execute(
    sql`ALTER TABLE normalized_facts ALTER COLUMN source_observed_at SET NOT NULL`
  );

  // Step 5: source_record_id NOT NULL
  console.log("Step 5: Setting source_record_id NOT NULL...");
  await db.execute(
    sql`ALTER TABLE normalized_facts ALTER COLUMN source_record_id SET NOT NULL`
  );

  // Step 6: Unique index
  console.log("Step 6: Creating unique index...");
  await db.execute(
    sql`CREATE UNIQUE INDEX IF NOT EXISTS normalized_facts_identity_idx ON normalized_facts (source_record_id, fact_type)`
  );

  // Step 7: team_aggregation column
  console.log("Step 7: Adding team_aggregation to metric_definitions...");
  await db.execute(
    sql`ALTER TABLE metric_definitions ADD COLUMN IF NOT EXISTS team_aggregation text NOT NULL DEFAULT 'simple_average'`
  );

  // Verification
  console.log("\n=== POST-MIGRATION VERIFICATION ===");

  const factCount: Record<string, unknown>[] = await db.execute(
    sql`SELECT COUNT(*)::int as cnt FROM normalized_facts`
  );
  console.log(`Fact count: ${factCount[0]!.cnt} (expected: 354)`);

  const dupeCheck: Record<string, unknown>[] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM (
      SELECT source_record_id, fact_type, COUNT(*) as c
      FROM normalized_facts
      GROUP BY source_record_id, fact_type
      HAVING COUNT(*) > 1
    ) sub
  `);
  console.log(`Remaining duplicate groups: ${dupeCheck[0]!.cnt} (expected: 0)`);

  const indexCheck: Record<string, unknown>[] = await db.execute(sql`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'normalized_facts' AND indexname = 'normalized_facts_identity_idx'
  `);
  console.log(`Unique index exists: ${indexCheck.length > 0 ? "YES" : "NO"}`);

  const colCheck: Record<string, unknown>[] = await db.execute(sql`
    SELECT column_name, is_nullable FROM information_schema.columns
    WHERE table_name = 'normalized_facts' AND column_name IN ('source_record_id', 'source_observed_at')
    ORDER BY column_name
  `);
  for (const col of colCheck) {
    console.log(`Column ${col.column_name}: nullable=${col.is_nullable}`);
  }

  const teamAggCheck: Record<string, unknown>[] = await db.execute(sql`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'metric_definitions' AND column_name = 'team_aggregation'
  `);
  console.log(`team_aggregation column exists: ${teamAggCheck.length > 0 ? "YES" : "NO"}`);

  console.log("\n=== MIGRATION 0009 COMPLETE ===");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
