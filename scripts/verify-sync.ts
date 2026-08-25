import { db } from "@/lib/db";
import { syncRuns, syncErrors, normalizedFacts, metricValues, dataSources } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
  const runs = await db.select().from(syncRuns);
  console.log("Sync runs:");
  for (const r of runs) {
    console.log(
      `  ${r.id} status=${r.status} ingested=${r.recordsIngested} normalized=${r.recordsNormalized} skipped=${r.recordsSkipped} errors=${r.errorCount}`
    );
  }

  const errors = await db.select().from(syncErrors);
  console.log(`\nSync errors: ${errors.length}`);
  for (const e of errors.slice(0, 20)) {
    console.log(`  [${e.errorType}] ${e.message}`);
  }

  const factCount = await db.select({ count: sql<number>`count(*)` }).from(normalizedFacts);
  console.log(`\nNormalized facts: ${factCount[0]?.count}`);

  const factsByType = await db
    .select({ factType: normalizedFacts.factType, count: sql<number>`count(*)` })
    .from(normalizedFacts)
    .groupBy(normalizedFacts.factType);
  for (const f of factsByType) {
    console.log(`  ${f.factType}: ${f.count}`);
  }

  const valueCount = await db.select({ count: sql<number>`count(*)` }).from(metricValues);
  console.log(`\nMetric values (derived): ${valueCount[0]?.count}`);

  const sources = await db.select().from(dataSources);
  console.log("\nData sources:");
  for (const s of sources) {
    console.log(`  ${s.type}: lastSuccessfulSyncAt=${s.lastSuccessfulSyncAt}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
