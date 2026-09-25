/** Explicit staging-only operator command. Never part of the ordinary build command. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/audit-reliability-checkpoints");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.hostname, "nozomi.proxy.rlwy.net");
  assert.equal(url.port, "24570");
  assert.equal(url.pathname, "/railway");
  url.search = "";
  url.searchParams.set("sslmode", "require");
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  assert.equal(journal.entries.at(-1).tag, "0015_metric_numeric_precision");
  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    const fingerprint = () =>
      client.begin("read only", async (tx) => {
        await tx`set local timezone = 'UTC'`;
        const tables = await tx`select schemaname, tablename from pg_tables
        where schemaname='public' order by tablename`;
        const result = [];
        for (const table of tables) {
          // Compare the original real values after the same widening cast used by 0015.
          const omit = table.tablename === "roster_candidates" ? ["suggested_line"] : [];
          const value = ["metric_values", "normalized_facts"].includes(table.tablename)
            ? tx`(to_jsonb(t) || jsonb_build_object('numeric_value', t.numeric_value::double precision))`
            : tx`to_jsonb(t)`;
          const [row] = await tx`select count(*)::int as count,
          md5(string_agg(md5((${value} - ${omit}::text[])::text), ''
          order by md5((${value} - ${omit}::text[])::text))) as digest
          from ${tx(table.schemaname)}.${tx(table.tablename)} t`;
          result.push({ table: table.tablename, count: row!.count, digest: row!.digest });
        }
        return result;
      });
    const before = await fingerprint();
    await client`set lock_timeout = '10s'`;
    await client`set statement_timeout = '120s'`;
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    const after = await fingerprint();
    for (const original of before)
      assert.deepEqual(
        after.find((table) => table.table === original.table),
        original
      );
    const columns = await client`select column_name from information_schema.columns
      where table_schema='public' and table_name='roster_candidates' and column_name='suggested_line'`;
    assert.equal(columns.length, 1);
    const numericColumns = await client`select table_name, data_type from information_schema.columns
      where table_schema='public' and table_name in ('metric_values','normalized_facts') and column_name='numeric_value'`;
    assert.equal(numericColumns.length, 2);
    assert(numericColumns.every((column) => column.data_type === "double precision"));
    console.log(
      JSON.stringify({
        event: "staging_migration_verified",
        through: "0015_metric_numeric_precision",
        existingTableContentsPreserved: true,
        tables: before.length,
        rows: before.reduce((sum, table) => sum + table.count, 0),
        productionAccess: false,
      })
    );
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error("Staging migration refused or failed; no credentials or row values logged.");
  process.exitCode = 1;
});
