/** Aggregate-only EXPLAIN comparison. Database connection is read-only; no source payloads leave it. */
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import postgres from "postgres";

async function main() {
  const output = process.argv[2];
  if (!output) throw new Error("Report path required");
  const url = parseEnv(await readFile(".env", "utf8")).DATABASE_URL;
  if (!url) throw new Error("Missing database configuration");
  const sql = postgres(url, {
    max: 1,
    connection: { default_transaction_read_only: true, statement_timeout: 10_000 },
  });
  try {
    const report = await sql.begin("read only isolation level repeatable read", async (tx) => {
      const [sample] = await tx`
        select organization_id, data_source_id, fact_type, employee_id,
               period_start::text, period_end::text
        from normalized_facts order by source_observed_at desc, id limit 1`;
      if (!sample) throw new Error("No retained facts");
      const broad = await tx`explain (analyze, buffers, format json)
        select * from normalized_facts where organization_id = ${sample.organization_id}
          and data_source_id = ${sample.data_source_id} and fact_type = ${sample.fact_type}`;
      const scoped = await tx`explain (analyze, buffers, format json)
        select * from normalized_facts where organization_id = ${sample.organization_id}
          and data_source_id = ${sample.data_source_id} and fact_type = ${sample.fact_type}
          and employee_id = ${sample.employee_id} and period_start = ${sample.period_start}
          and period_end = ${sample.period_end}`;
      function summarize(rows: typeof broad) {
        const result = rows[0]!["QUERY PLAN"][0];
        return {
          rows: result.Plan["Actual Rows"],
          executionMs: result["Execution Time"],
          planningMs: result["Planning Time"],
          sharedHitBlocks: result.Plan["Shared Hit Blocks"],
          sharedReadBlocks: result.Plan["Shared Read Blocks"],
        };
      }
      return {
        observedAt: new Date().toISOString(),
        scenario:
          "One changed employee/interval group, selected from the latest retained fact; not a whole sync benchmark",
        databaseWrites: 0,
        broad: summarize(broad),
        scoped: summarize(scoped),
        limits:
          "One read-only sample; timings are cache/order sensitive and do not establish production end-to-end latency.",
      };
    });
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Read-scope probe failed; no database writes performed.");
  process.exitCode = 1;
});
