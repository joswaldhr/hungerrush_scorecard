/** Read-only, aggregate-only release census. This does not authorize a deployment. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";

async function main() {
  const output = path.resolve(process.argv[2] ?? "");
  assert.equal(path.dirname(output), path.resolve("docs/audits"));
  assert(output.endsWith(".json"), "Require a new aggregate report path");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "metro.proxy.rlwy.net");
  assert.equal(url.port, "57223");
  assert.equal(url.pathname, "/railway");
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8")) as {
    entries: { tag: string; when: number }[];
  };
  const expected = await Promise.all(
    journal.entries.map(async (entry) => {
      const text = await readFile(`drizzle/${entry.tag}.sql`, "utf8");
      const lf = text.replaceAll("\r\n", "\n");
      const hash = (value: string) => createHash("sha256").update(value).digest("hex");
      return {
        ...entry,
        hash: hash(text),
        lfHash: hash(lf),
        crlfHash: hash(lf.replaceAll("\n", "\r\n")),
      };
    })
  );
  const client = postgres(url.toString(), {
    max: 1,
    ssl: "require",
    connection: { default_transaction_read_only: true, statement_timeout: 15_000 },
  });
  try {
    const result = await client.begin("read only isolation level repeatable read", async (tx) => {
      const [server] = await tx`select current_setting('server_version_num')::int as version,
        current_setting('transaction_read_only') = 'on' as read_only`;
      assert.equal(server!.read_only, true);
      const applied = await tx`select hash, created_at from drizzle.__drizzle_migrations
        order by created_at, id`;
      const migrationsMatch = applied.every(
        (row, index) =>
          expected[index]?.hash === row.hash && expected[index]?.when === Number(row.created_at)
      );
      const latestApplied = Math.max(0, ...applied.map((row) => Number(row.created_at)));
      const appliedEvidence = applied.map((row) => {
        const entry = expected.find((item) => item.when === Number(row.created_at));
        return {
          tag: entry?.tag ?? "unknown_timestamp",
          exactHashMatches: entry?.hash === row.hash,
          knownLineEndingHashMatches: entry?.lfHash === row.hash || entry?.crlfHash === row.hash,
        };
      });
      const [visibility] = await tx`select count(*)::int as duplicate_scopes from (
        select 1 from metric_visibility_overrides
        group by scope, manager_user_id, target_employee_id, metric_definition_id, team_id, line
        having count(*) > 1
      ) duplicates`;
      const [workers] = await tx`select
        count(*) filter (where status = 'running')::int as running_rows,
        count(*) filter (where status = 'running' and started_at >= clock_timestamp() - interval '10 minutes')::int as recent_running_rows,
        count(*) filter (where status = 'running' and started_at < clock_timestamp() - interval '10 minutes')::int as older_running_rows,
        max(started_at) filter (where status = 'running') as latest_running_started_at,
        count(*) filter (where status = 'completed' and started_at >= clock_timestamp() - interval '24 hours')::int as completed_last_24h,
        count(*) filter (where status = 'failed' and started_at >= clock_timestamp() - interval '24 hours')::int as failed_last_24h
        from sync_runs`;
      const [sources] = await tx`select count(*)::int as total,
        count(*) filter (where type = 'zendesk' and status = 'configured')::int as configured_zendesk,
        count(*) filter (where type = 'zendesk' and status = 'configured' and configuration_reference is null)::int as configured_zendesk_without_account_reference,
        count(*) filter (where type = 'zendesk' and status = 'configured' and last_successful_sync_at is null)::int as configured_zendesk_never_published
        from data_sources`;
      const [legacySchema] = await tx`select
        (select count(*) = 2 from information_schema.columns where table_schema = 'public'
          and table_name = 'normalized_facts' and column_name in ('source_record_id', 'source_observed_at')
          and is_nullable = 'NO') as fact_identity_columns_not_null,
        exists(select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relname = 'normalized_facts_identity_idx'
          and i.indisunique and i.indisvalid
          and i.indpred is null and i.indexprs is null
          and pg_get_indexdef(i.indexrelid, 1, true) = 'source_record_id'
          and pg_get_indexdef(i.indexrelid, 2, true) = 'fact_type'
          and i.indnkeyatts = 2) as fact_identity_unique_index,
        exists(select 1 from information_schema.columns where table_schema = 'public'
          and table_name = 'metric_definitions' and column_name = 'team_aggregation'
          and data_type = 'text' and is_nullable = 'NO'
          and column_default = '''simple_average''::text') as team_aggregation_column`;
      return {
        serverVersion: server!.version,
        migrations: {
          appliedCount: applied.length,
          matchesCandidatePrefix: migrationsMatch,
          pending: migrationsMatch
            ? expected.slice(applied.length).map((entry) => entry.tag)
            : null,
          appliedEvidence,
          missingJournalEntriesBeforeLatest: expected
            .filter(
              (entry) =>
                entry.when <= latestApplied &&
                !applied.some((row) => Number(row.created_at) === entry.when)
            )
            .map((entry) => entry.tag),
          newerCandidateEntries: expected
            .filter((entry) => entry.when > latestApplied)
            .map((entry) => entry.tag),
        },
        visibility,
        workers,
        sources,
        legacyMigration0009Schema: legacySchema,
      };
    });
    const report = {
      observedAt: new Date().toISOString(),
      databaseWrites: 0,
      transactionReadOnly: true,
      ...result,
      limitations: [
        "Point-in-time census; repeat immediately before migration and rollout.",
        "A running row's age does not prove its worker has stopped; drain legacy workers separately.",
        "This census does not verify deployment environment, recoverability, source semantics or metric correctness.",
      ],
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify(report));
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error("Release census failed; no credentials, queries or row values logged.");
  process.exitCode = 1;
});
