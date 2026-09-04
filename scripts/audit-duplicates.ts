import { db } from "@/lib/db";
import { normalizedFacts } from "@/lib/db/schema";
import { count, sql } from "drizzle-orm";

async function main() {
  const totalFacts = await db.select({ count: count() }).from(normalizedFacts);
  console.log(`Total normalizedFacts: ${totalFacts[0]!.count}`);

  // Duplicate groups by fact type
  const dupeResult: Record<string, unknown>[] = await db.execute(sql`
    SELECT fact_type, COUNT(*)::int as group_count, SUM(cnt - 1)::int as excess_rows
    FROM (
      SELECT employee_id, fact_type, period_start, period_end, data_source_id, COUNT(*) as cnt
      FROM normalized_facts
      GROUP BY employee_id, fact_type, period_start, period_end, data_source_id
      HAVING COUNT(*) > 1
    ) sub
    GROUP BY fact_type
    ORDER BY excess_rows DESC
  `);
  console.log("\n=== DUPLICATE GROUPS BY FACT TYPE ===");
  if (dupeResult.length === 0) {
    console.log("  No duplicates found");
  }
  for (const row of dupeResult) {
    console.log(`  ${row.fact_type}: ${row.group_count} groups, ${row.excess_rows} excess rows`);
  }

  // Unique groups vs total
  const uniqueResult: Record<string, unknown>[] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM (
      SELECT DISTINCT employee_id, fact_type, period_start, period_end, data_source_id
      FROM normalized_facts
    ) sub
  `);
  const uniqueCount = uniqueResult[0]!.cnt;
  console.log(`\nUnique fact groups: ${uniqueCount}`);
  console.log(`Excess rows: ${totalFacts[0]!.count - Number(uniqueCount)}`);

  // Sample duplicates for tickets_resolved
  const sampleDupes: Record<string, unknown>[] = await db.execute(sql`
    SELECT employee_id, period_start, period_end, COUNT(*)::int as cnt,
           array_agg(numeric_value) as vals,
           array_agg(source_record_id) as source_ids
    FROM normalized_facts
    WHERE fact_type = 'tickets_resolved'
    GROUP BY employee_id, fact_type, period_start, period_end, data_source_id
    HAVING COUNT(*) > 1
    LIMIT 5
  `);
  console.log("\n=== SAMPLE DUPLICATE tickets_resolved GROUPS ===");
  if (sampleDupes.length === 0) {
    console.log("  No duplicates for tickets_resolved");
  }
  for (const row of sampleDupes) {
    console.log(`  emp:${String(row.employee_id).slice(0,8)} ${row.period_start}/${row.period_end} count:${row.cnt} values:${JSON.stringify(row.vals)}`);
  }

  // Check if dupes come from same or different source records
  const dupeAnalysis: Record<string, unknown>[] = await db.execute(sql`
    SELECT dupe_type, COUNT(*)::int as group_count FROM (
      SELECT
        CASE
          WHEN COUNT(DISTINCT source_record_id) = 1 THEN 'same_source'
          ELSE 'different_sources'
        END as dupe_type
      FROM normalized_facts
      GROUP BY employee_id, fact_type, period_start, period_end, data_source_id
      HAVING COUNT(*) > 1
    ) sub
    GROUP BY dupe_type
  `);
  console.log("\n=== DUPLICATE SOURCE ANALYSIS ===");
  for (const row of dupeAnalysis) {
    console.log(`  ${row.dupe_type}: ${row.group_count} groups`);
  }

  // Impact on SUM metrics
  const impactResult: Record<string, unknown>[] = await db.execute(sql`
    WITH deduped AS (
      SELECT DISTINCT ON (employee_id, fact_type, period_start, period_end, data_source_id)
        employee_id, fact_type, period_start, period_end, numeric_value
      FROM normalized_facts
      ORDER BY employee_id, fact_type, period_start, period_end, data_source_id, created_at DESC
    ),
    current_sums AS (
      SELECT employee_id, fact_type, period_start, period_end, SUM(numeric_value) as current_sum
      FROM normalized_facts
      WHERE fact_type IN ('tickets_resolved', 'tickets_updated')
      GROUP BY employee_id, fact_type, period_start, period_end
    ),
    deduped_sums AS (
      SELECT employee_id, fact_type, period_start, period_end, SUM(numeric_value) as deduped_sum
      FROM deduped
      WHERE fact_type IN ('tickets_resolved', 'tickets_updated')
      GROUP BY employee_id, fact_type, period_start, period_end
    )
    SELECT c.fact_type, c.employee_id, c.period_start,
           c.current_sum, d.deduped_sum,
           c.current_sum - d.deduped_sum as inflation
    FROM current_sums c
    JOIN deduped_sums d USING (employee_id, fact_type, period_start, period_end)
    WHERE c.current_sum != d.deduped_sum
    ORDER BY c.current_sum - d.deduped_sum DESC
    LIMIT 10
  `);
  console.log("\n=== INFLATED SUM METRICS (top 10) ===");
  if (impactResult.length === 0) {
    console.log("  No inflation detected — all SUM values match deduped calculation");
  }
  for (const row of impactResult) {
    console.log(`  ${row.fact_type} emp:${String(row.employee_id).slice(0,8)} ${row.period_start} | current:${row.current_sum} deduped:${row.deduped_sum} inflation:${row.inflation}`);
  }

  // Sync run count
  const syncCount: Record<string, unknown>[] = await db.execute(sql`SELECT COUNT(*)::int as cnt FROM sync_runs`);
  console.log(`\nTotal sync runs: ${syncCount[0]!.cnt}`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
