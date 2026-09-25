/** One reviewed production migration and account binding, gated by an exact fresh restore. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { parseZendeskCsatPolicy } from "../src/lib/connectors/zendesk-csat-policy";

let stage = "preflight",
  applied = false;
type Inventory = Array<{ table: string; count: number; digest: string | null }>;
async function inventory(tx: postgres.TransactionSql, normalize = false): Promise<Inventory> {
  await tx`set local timezone='UTC'`;
  const tables =
    await tx`select schemaname,tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') order by schemaname,tablename`;
  const result: Inventory = [];
  for (const table of tables) {
    const value =
      normalize && ["metric_values", "normalized_facts"].includes(table.tablename)
        ? tx`(to_jsonb(t)||jsonb_build_object('numeric_value',t.numeric_value::double precision))`
        : tx`to_jsonb(t)`;
    const [row] =
      await tx`select count(*)::int as count,md5(string_agg(md5((${value})::text),'' order by md5((${value})::text))) as digest from ${tx(table.schemaname)}.${tx(table.tablename)} t`;
    result.push({
      table: `${table.schemaname}.${table.tablename}`,
      count: row!.count,
      digest: row!.digest,
    });
  }
  return result;
}
async function main() {
  const mode = process.argv[2];
  assert(mode === "check" || mode === "apply");
  const candidate = execFileSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
  assert.equal(candidate, process.env.CADENCE_RELEASE_CANDIDATE);
  assert.equal(
    execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", windowsHide: true }).trim(),
    ""
  );
  const backupPath = path.resolve(process.env.CADENCE_RELEASE_BACKUP ?? "");
  assert.equal(
    path.dirname(path.dirname(backupPath)),
    path.join(os.homedir(), ".codex", "private-backups", "cadence")
  );
  assert.equal(path.basename(backupPath), "manifest.json");
  const backup = JSON.parse(await readFile(backupPath, "utf8"));
  assert(
    backup.restored &&
      backup.encryptedRoundTrip &&
      backup.existingApplicationDataUnchangedAfterMigration &&
      backup.allTableDigestsMatch
  );
  assert.equal(backup.restoredCopyMigrationsThrough, "0015_metric_numeric_precision");
  const age = Date.now() - Date.parse(backup.observedAt);
  assert(age >= 0 && age < 3600000);
  assert((await stat(path.join(path.dirname(backupPath), "database.dump.dpapi"))).size > 0);
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "metro.proxy.rlwy.net:57223");
  assert.equal(url.pathname, "/railway");
  url.search = "?sslmode=require";
  const policy = parseZendeskCsatPolicy(
    process.env.ZENDESK_CSAT_POLICY,
    process.env.ZENDESK_SUBDOMAIN ?? ""
  );
  assert(policy);
  assert.equal(policy.effectivePeriodStart, "2026-09-20");
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  const latest = journal.entries.at(-1);
  assert.equal(latest.tag, "0015_metric_numeric_precision");
  const migration = await readFile(`drizzle/${latest.tag}.sql`, "utf8");
  const sql = postgres(url.toString(), {
    max: 1,
    ssl: "require",
    onnotice: () => {},
    connection: { lock_timeout: 10000, statement_timeout: 120000 },
  });
  try {
    const report = await sql.begin(
      mode === "check" ? "isolation level repeatable read read only" : "",
      async (tx) => {
        if (mode === "apply") {
          // Block new leases and existing publishers before checking for active work.
          await tx`select id from data_sources order by id for update`;
        }
        assert.equal((await tx`select id from sync_runs where status='running'`).length, 0);
        const migrations =
          await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
        const expected = journal.entries.filter((e: { idx: number }) => e.idx <= 14 && e.idx !== 9);
        assert.equal(migrations.length, expected.length);
        for (let i = 0; i < expected.length; i++) {
          assert.equal(Number(migrations[i]!.created_at), expected[i].when);
          assert.equal(
            migrations[i]!.hash,
            createHash("sha256")
              .update(await readFile(`drizzle/${expected[i].tag}.sql`))
              .digest("hex")
          );
        }
        const [source] =
          await tx`select organization_id,type,status,configuration_reference from data_sources where id=${policy.dataSourceId}`;
        assert(source);
        assert.equal(source.organization_id, policy.organizationId);
        assert.equal(source.type, "zendesk");
        assert.equal(source.status, "configured");
        assert.equal(source.configuration_reference, null);
        const exact = await inventory(tx);
        assert.deepEqual(exact, backup.tables);
        if (mode === "check")
          return {
            preflightPassed: true,
            databaseWrites: 0,
            candidate,
            existingRowsMatchRestoredBackup: true,
          };
        const before = await inventory(tx, true);
        stage = "precision_migration";
        // Execute only the reviewed 0015 statements inside this already guarded transaction.
        // The older intentional 0009 journal gap is never replayed.
        for (const statement of migration.split("--> statement-breakpoint"))
          if (statement.trim()) await tx.unsafe(statement);
        await tx`insert into drizzle.__drizzle_migrations (hash,created_at) values (${createHash("sha256").update(migration).digest("hex")},${latest.when})`;
        const after = await inventory(tx, true);
        for (const table of before.filter((t) => t.table !== "drizzle.__drizzle_migrations"))
          assert.deepEqual(
            after.find((t) => t.table === table.table),
            table
          );
        const columns =
          await tx`select data_type from information_schema.columns where table_schema='public' and table_name in ('metric_values','normalized_facts') and column_name='numeric_value'`;
        assert.equal(columns.length, 2);
        assert(columns.every((c) => c.data_type === "double precision"));
        stage = "account_binding";
        const bound =
          await tx`update data_sources set configuration_reference=${policy.accountReference},updated_at=clock_timestamp() where id=${policy.dataSourceId} and configuration_reference is null returning id`;
        assert.equal(bound.length, 1);
        return {
          observedAt: new Date().toISOString(),
          candidate,
          migration: latest.tag,
          backupSha256: backup.sha256,
          existingApplicationDataUnchangedByMigration: true,
          accountBindingAdded: true,
          legacyJournalGapPreserved: true,
          revisionRows: before.find((t) => t.table === "public.sync_revisions")?.count ?? 0,
          policyActivated: false,
        };
      }
    );
    applied = mode === "apply";
    if (applied)
      await writeFile(
        "docs/audits/2026-09-25-csat-production-migration.json",
        JSON.stringify(report, null, 2) + "\n",
        { flag: "wx" }
      );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    JSON.stringify({
      error: "CSAT migration refused or failed",
      stage,
      transactionCommitted: applied,
      detailsRedacted: true,
    })
  );
  process.exitCode = 1;
});
