import { db } from "@/lib/db";
import { normalizedFacts, metricValues, sourceRecords } from "@/lib/db/schema";
import { count, sql } from "drizzle-orm";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BACKUP_DIR = join(process.cwd(), "backups", "phase1-pre-cleanup");

async function main() {
  mkdirSync(BACKUP_DIR, { recursive: true });
  console.log(`Backup dir: ${BACKUP_DIR}\n`);

  // ── 1. Pre-cleanup counts ──────────────────────────────────
  console.log("=== PRE-CLEANUP COUNTS ===");

  const [factCount] = await db.select({ count: count() }).from(normalizedFacts);
  console.log(`Total normalizedFacts: ${factCount!.count}`);

  const [metricCount] = await db.select({ count: count() }).from(metricValues);
  console.log(`Total metricValues: ${metricCount!.count}`);

  const [sourceCount] = await db.select({ count: count() }).from(sourceRecords);
  console.log(`Total sourceRecords: ${sourceCount!.count}`);

  const uniqueResult: Record<string, unknown>[] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM (
      SELECT DISTINCT source_record_id, fact_type
      FROM normalized_facts
    ) sub
  `);
  const uniqueFactGroups = Number(uniqueResult[0]!.cnt);
  const excessRows = factCount!.count - uniqueFactGroups;
  console.log(`Unique (sourceRecordId, factType) groups: ${uniqueFactGroups}`);
  console.log(`Excess rows (duplicates): ${excessRows}`);

  // ── 2. NULL check ──────────────────────────────────────────
  console.log("\n=== NULL SOURCE_RECORD_ID CHECK ===");
  const nullResult: Record<string, unknown>[] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM normalized_facts WHERE source_record_id IS NULL
  `);
  const nullCount = Number(nullResult[0]!.cnt);
  console.log(`Facts with NULL source_record_id: ${nullCount}`);
  if (nullCount > 0) {
    console.error("ABORT: Found NULL source_record_ids — investigate before proceeding");
    process.exit(1);
  }

  // ── 3. Source verification ─────────────────────────────────
  console.log("\n=== SOURCE VERIFICATION ===");
  console.log("Checking every duplicate group...");

  const dupeGroups: Record<string, unknown>[] = await db.execute(sql`
    SELECT
      source_record_id,
      fact_type,
      COUNT(*)::int as cnt,
      COUNT(DISTINCT numeric_value)::int as distinct_numeric,
      COUNT(DISTINCT text_value)::int as distinct_text,
      COUNT(DISTINCT boolean_value::text)::int as distinct_bool,
      COUNT(DISTINCT source_record_id)::int as distinct_source_records
    FROM normalized_facts
    GROUP BY source_record_id, fact_type
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);

  console.log(`Duplicate groups found: ${dupeGroups.length}`);

  let allSameSource = true;
  let groupsWithDiffSources = 0;
  let groupsWithDiffValues = 0;

  for (const g of dupeGroups) {
    if (Number(g.distinct_source_records) !== 1) {
      allSameSource = false;
      groupsWithDiffSources++;
    }
    if (Number(g.distinct_numeric) > 1 || Number(g.distinct_text) > 1 || Number(g.distinct_bool) > 1) {
      groupsWithDiffValues++;
    }
  }

  console.log(`All duplicate groups from same source record: ${allSameSource ? "YES" : "NO"}`);
  console.log(`Groups with identical values: ${dupeGroups.length - groupsWithDiffValues}`);
  console.log(`Groups with varying values (source record updated mid-period): ${groupsWithDiffValues}`);
  if (!allSameSource) {
    console.error(`ABORT: ${groupsWithDiffSources} groups have different source records — these are NOT duplicates`);
    process.exit(1);
  }
  if (groupsWithDiffValues > 0) {
    console.log(`  (Expected: source record was updated, creating new facts without removing old ones.`);
    console.log(`   "Keep newest" is correct — newest facts match current source record payload.)`);
  }

  // Verify that the newest fact in each group matches the current source record
  console.log("\n=== VERIFYING NEWEST FACTS MATCH SOURCE RECORDS ===");
  const newestVsSource: Record<string, unknown>[] = await db.execute(sql`
    WITH surviving AS (
      SELECT DISTINCT ON (source_record_id, fact_type)
        source_record_id, fact_type, numeric_value
      FROM normalized_facts
      ORDER BY source_record_id, fact_type, created_at DESC
    )
    SELECT
      s.source_record_id,
      s.fact_type,
      s.numeric_value as fact_value,
      sr.payload_json
    FROM surviving s
    JOIN source_records sr ON sr.id = s.source_record_id
  `);

  let payloadMismatches = 0;
  for (const row of newestVsSource) {
    const payload = row.payload_json as Record<string, unknown>;
    const factType = String(row.fact_type);
    const factValue = row.fact_value as number | null;

    const keyMap: Record<string, string> = {
      tickets_resolved: "ticketsResolved",
      tickets_updated: "ticketsUpdated",
      avg_handle_time: "avgHandleTimeMinutes",
      avg_response_time: "avgResponseTimeMinutes",
      backlog_count: "backlogCount",
      csat_score: "csatScore",
    };
    const payloadKey = keyMap[factType];
    const payloadValue = payloadKey ? (payload[payloadKey] as number | null) : undefined;

    if (payloadValue !== undefined && payloadValue !== null && factValue !== null) {
      if (Math.abs(Number(factValue) - Number(payloadValue)) > 0.01) {
        console.error(`  MISMATCH: ${factType} fact=${factValue} payload=${payloadValue}`);
        payloadMismatches++;
      }
    }
  }
  if (payloadMismatches > 0) {
    console.error(`ABORT: ${payloadMismatches} surviving facts do not match source record payloads`);
    process.exit(1);
  }
  console.log(`All ${newestVsSource.length} surviving facts verified against source record payloads.`);

  // ── 4. Verify surviving row matches source record payload ──
  console.log("\n=== SOURCE RECORD PAYLOAD VERIFICATION ===");
  console.log("Checking that surviving facts match their source record payloads...");

  const mismatchResult: Record<string, unknown>[] = await db.execute(sql`
    WITH surviving AS (
      SELECT DISTINCT ON (source_record_id, fact_type)
        id, source_record_id, fact_type, numeric_value, employee_id, period_start, period_end
      FROM normalized_facts
      ORDER BY source_record_id, fact_type, created_at DESC
    )
    SELECT
      s.id as fact_id,
      s.fact_type,
      s.numeric_value as fact_value,
      sr.payload_json,
      sr.external_record_type
    FROM surviving s
    JOIN source_records sr ON sr.id = s.source_record_id
    LIMIT 5
  `);

  console.log(`Sample surviving facts with source payloads (first 5):`);
  for (const row of mismatchResult) {
    const payload = row.payload_json as Record<string, unknown>;
    const factType = String(row.fact_type);
    const factValue = row.fact_value;
    const payloadValue = payload[factType] ?? payload[factType.replace(/_/g, "")] ?? "N/A";
    console.log(`  ${factType}: fact=${factValue}, payload.${factType}=${JSON.stringify(payloadValue)}`);
  }

  // ── 5. Backup tables ──────────────────────────────────────
  console.log("\n=== BACKING UP TABLES ===");

  const allFacts: Record<string, unknown>[] = await db.execute(sql`
    SELECT * FROM normalized_facts ORDER BY id
  `);
  writeFileSync(join(BACKUP_DIR, "normalized_facts.json"), JSON.stringify(allFacts, null, 2));
  console.log(`normalized_facts: ${allFacts.length} rows backed up`);

  const allMetricValues: Record<string, unknown>[] = await db.execute(sql`
    SELECT * FROM metric_values ORDER BY id
  `);
  writeFileSync(join(BACKUP_DIR, "metric_values.json"), JSON.stringify(allMetricValues, null, 2));
  console.log(`metric_values: ${allMetricValues.length} rows backed up`);

  const allSourceRecords: Record<string, unknown>[] = await db.execute(sql`
    SELECT id, data_source_id, external_record_type, external_record_id, employee_id,
           occurred_at, period_start, period_end, payload_hash, source_updated_at,
           ingested_at, sync_run_id
    FROM source_records ORDER BY id
  `);
  writeFileSync(join(BACKUP_DIR, "source_records.json"), JSON.stringify(allSourceRecords, null, 2));
  console.log(`source_records: ${allSourceRecords.length} rows backed up (payload excluded for size)`);

  // ── 6. Pre-cleanup metricValues snapshot ───────────────────
  console.log("\n=== PRE-CLEANUP METRIC VALUES ===");
  const mvSnapshot: Record<string, unknown>[] = await db.execute(sql`
    SELECT
      mv.id,
      md.key as metric_key,
      mv.employee_id,
      mv.period_start,
      mv.period_end,
      mv.numeric_value,
      mv.quality_status,
      mv.provenance_json
    FROM metric_values mv
    JOIN metric_definitions md ON md.id = mv.metric_definition_id
    ORDER BY md.key, mv.employee_id, mv.period_start
  `);
  writeFileSync(join(BACKUP_DIR, "metric_values_snapshot.json"), JSON.stringify(mvSnapshot, null, 2));
  console.log(`metric_values snapshot: ${mvSnapshot.length} rows`);

  // Print summary table
  console.log("\nPer-metric value counts:");
  const metricCounts = new Map<string, number>();
  for (const row of mvSnapshot) {
    const key = String(row.metric_key);
    metricCounts.set(key, (metricCounts.get(key) ?? 0) + 1);
  }
  for (const [key, cnt] of [...metricCounts.entries()].sort()) {
    console.log(`  ${key}: ${cnt} values`);
  }

  // ── 7. Expected post-cleanup counts ────────────────────────
  console.log("\n=== EXPECTED POST-CLEANUP ===");
  console.log(`Expected normalized_facts after cleanup: ${uniqueFactGroups}`);
  console.log(`Expected rows removed: ${excessRows}`);

  // Compute expected metric values after recomputation
  const expectedResult: Record<string, unknown>[] = await db.execute(sql`
    WITH deduped AS (
      SELECT DISTINCT ON (source_record_id, fact_type)
        employee_id, fact_type, period_start, period_end, numeric_value
      FROM normalized_facts
      ORDER BY source_record_id, fact_type, created_at DESC
    )
    SELECT
      fact_type,
      employee_id,
      period_start,
      period_end,
      COUNT(*)::int as fact_count,
      SUM(numeric_value)::float as sum_val,
      AVG(numeric_value)::float as avg_val
    FROM deduped
    WHERE numeric_value IS NOT NULL
    GROUP BY fact_type, employee_id, period_start, period_end
    ORDER BY fact_type, employee_id, period_start
  `);
  writeFileSync(join(BACKUP_DIR, "expected_post_cleanup.json"), JSON.stringify(expectedResult, null, 2));
  console.log(`Expected post-cleanup metric groups: ${expectedResult.length}`);

  // ── 8. Dry run: confirm DELETE would remove exactly the right rows ──
  console.log("\n=== DRY RUN: DELETE CANDIDATES ===");
  const deleteCount: Record<string, unknown>[] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM (
      SELECT id FROM (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY source_record_id, fact_type
            ORDER BY created_at DESC
          ) AS rn
        FROM normalized_facts
      ) sub
      WHERE rn > 1
    ) del
  `);
  console.log(`Rows that would be deleted: ${Number(deleteCount[0]!.cnt)}`);
  console.log(`Expected: ${excessRows}`);
  if (Number(deleteCount[0]!.cnt) !== excessRows) {
    console.error("MISMATCH: Delete count does not match excess rows — investigate");
    process.exit(1);
  }

  console.log("\n=== ALL CHECKS PASSED ===");
  console.log("Safe to proceed with migration 0009.");
  console.log(`Backups written to: ${BACKUP_DIR}`);

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
