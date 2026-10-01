/** Bounded production diagnostics. No vendor requests, writes, identities or raw errors. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

const output = path.resolve(process.argv[2] ?? "");
assert.equal(path.dirname(output), path.resolve("docs/audits"));
assert(output.endsWith(".json"));
const url = new URL(process.env.DATABASE_URL ?? "");
assert.equal(url.hostname, "metro.proxy.rlwy.net");
assert.equal(url.port, "57223");
assert.equal(url.pathname, "/railway");
const sql = postgres(url.toString(), {
  max: 1,
  ssl: "require",
  connection: { default_transaction_read_only: true, statement_timeout: 15_000 },
});
try {
  const report = await sql.begin("read only isolation level repeatable read", async (tx) => {
    const [mode] = await tx`select current_setting('transaction_read_only') as mode`;
    assert.equal(mode.mode, "on");
    await tx`set local timezone='UTC'`;
    const runs = await tx`select r.status, r.started_at, r.completed_at,
      round(extract(epoch from r.completed_at-r.started_at)::numeric,2) as duration_seconds,
      r.records_ingested, r.records_normalized, r.error_count,
      r.metadata_json->'weekOffset' as week_offset,
      (select jsonb_agg(p) from (select s.period_start,s.period_end,count(*)::int as records
        from source_records s where s.sync_run_id=r.id
        group by s.period_start,s.period_end) p) as published_intervals,
      (select jsonb_agg(e) from (select
        case when message ~* '429|rate.?limit' then 'rate_limited'
          when message ~* 'parent|coverage' then 'source_coverage'
          when message ~* 'timeout|timed out' then 'timeout'
          when message ~* 'identity|mapping' then 'identity'
          else 'other' end as category, count(*)::int as errors
        from sync_errors where sync_run_id=r.id group by 1) e) as errors
      from sync_runs r where started_at >= now()-interval '24 hours'
      order by started_at desc limit 50`;
    const inventory = await tx`select count(*)::int as assignments,
      count(distinct a.metric_definition_id)::int as metric_keys
      from metric_assignments a
      where (effective_from is null or effective_from<=current_date-extract(dow from current_date)::int)
        and (effective_to is null or effective_to>current_date-extract(dow from current_date)::int)`;
    const coverage = await tx`select d.key,v.period_start,v.period_end,
      v.quality_status,count(*)::int as stored_rows,
      count(v.numeric_value)::int as numeric_rows,
      count(*) filter(where v.numeric_value=0)::int as zero_rows,
      min(v.data_freshness_at) as oldest_observation,
      max(v.data_freshness_at) as newest_observation,
      count(*) filter(where v.provenance_json->>'sourceContract' is not null)::int as versioned_rows
      from metric_values v join metric_definitions d on d.id=v.metric_definition_id
      where v.period_start>=current_date-21
      group by d.key,v.period_start,v.period_end,v.quality_status
      order by d.key,v.period_start desc,v.quality_status`;
    return {
      observedAt: new Date().toISOString(),
      readOnly: true,
      databaseWrites: 0,
      vendorRequests: 0,
      inventory: inventory[0],
      runs,
      coverage,
      limitations: [
        "Persisted run evidence is not scheduler attribution; correlate hosting invocation logs.",
        "Stored numeric rows can be withheld by manager read policies; coverage is not certification.",
        "Observation age alone does not make a closed historical observation stale.",
      ],
    };
  });
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      observedAt: report.observedAt,
      inventory: report.inventory,
      runs: report.runs,
      coverageGroups: report.coverage.length,
    })
  );
} catch {
  console.error("Read-only operational census failed; no source rows or credentials logged.");
  process.exitCode = 1;
} finally {
  await sql.end();
}
