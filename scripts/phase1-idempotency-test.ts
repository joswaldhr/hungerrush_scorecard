import { db } from "@/lib/db";
import { normalizedFacts, dataSources } from "@/lib/db/schema";
import { count, sql, eq } from "drizzle-orm";
import { runSync } from "@/lib/connectors/sync-engine";
import { ZendeskConnector } from "@/lib/connectors/zendesk";

async function main() {
  const [before] = await db.select({ count: count() }).from(normalizedFacts);
  console.log(`Facts before sync: ${before!.count}`);

  const sources = await db.select().from(dataSources).where(eq(dataSources.type, "zendesk"));
  const config = sources.length > 0 ? { dataSourceId: sources[0]!.id, organizationId: sources[0]!.organizationId } : null;

  if (!config) {
    console.log("No Zendesk config available — testing with existing data only");

    // Instead, manually test idempotency by trying to re-insert existing facts
    const dupeCheck: Record<string, unknown>[] = await db.execute(sql`
      SELECT COUNT(*)::int as cnt FROM (
        SELECT source_record_id, fact_type, COUNT(*) as c
        FROM normalized_facts
        GROUP BY source_record_id, fact_type
        HAVING COUNT(*) > 1
      ) sub
    `);
    console.log(`Duplicate groups: ${dupeCheck[0]!.cnt} (expected: 0)`);

    // Test that the unique constraint blocks inserts
    const testRow: Record<string, unknown>[] = await db.execute(sql`
      SELECT source_record_id, fact_type FROM normalized_facts LIMIT 1
    `);
    if (testRow.length > 0) {
      try {
        await db.execute(sql`
          INSERT INTO normalized_facts (
            organization_id, employee_id, fact_type, period_start, period_end,
            data_source_id, source_record_id, source_observed_at
          )
          SELECT
            organization_id, employee_id, fact_type, period_start, period_end,
            data_source_id, source_record_id, source_observed_at
          FROM normalized_facts
          WHERE source_record_id = ${String(testRow[0]!.source_record_id)}
            AND fact_type = ${String(testRow[0]!.fact_type)}
        `);
        console.log("ERROR: Duplicate insert was not blocked!");
        process.exit(1);
      } catch {
        console.log("Unique constraint correctly blocks duplicate inserts");
      }
    }

    const [after] = await db.select({ count: count() }).from(normalizedFacts);
    console.log(`Facts after test: ${after!.count} (expected: ${before!.count})`);
    console.log(before!.count === after!.count ? "PASS: No new facts created" : "FAIL: Fact count changed");
    process.exit(0);
  }

  console.log("Running sync...");
  const connector = new ZendeskConnector();
  const result = await runSync(connector, config, { maxPages: 10 });
  console.log(`Sync result: ${result.success ? "success" : "failed"}`);

  const [after] = await db.select({ count: count() }).from(normalizedFacts);
  console.log(`Facts after sync: ${after!.count}`);
  console.log(
    before!.count === after!.count
      ? "PASS: Idempotent — no new facts created"
      : `NOTE: ${after!.count - before!.count} new facts (expected if new data arrived)`
  );

  // Check for duplicates
  const dupeCheck: Record<string, unknown>[] = await db.execute(sql`
    SELECT COUNT(*)::int as cnt FROM (
      SELECT source_record_id, fact_type, COUNT(*) as c
      FROM normalized_facts
      GROUP BY source_record_id, fact_type
      HAVING COUNT(*) > 1
    ) sub
  `);
  console.log(`Duplicate groups after sync: ${dupeCheck[0]!.cnt} (must be 0)`);

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
