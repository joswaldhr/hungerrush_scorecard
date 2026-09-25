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
  assert.equal(journal.entries.at(-1).tag, "0014_roster_candidate_line");
  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    const fingerprint = () =>
      client.begin("read only", async (tx) => {
        await tx`set local timezone = 'UTC'`;
        const tables = await tx`select schemaname, tablename from pg_tables
        where schemaname='public' order by tablename`;
        const result = [];
        for (const table of tables) {
          // The new nullable field is the only permitted row-shape change.
          const omit = table.tablename === "roster_candidates" ? ["suggested_line"] : [];
          const [row] = await tx`select count(*)::int as count,
          md5(string_agg(md5((to_jsonb(t) - ${omit}::text[])::text), ''
          order by md5((to_jsonb(t) - ${omit}::text[])::text))) as digest
          from ${tx(table.schemaname)}.${tx(table.tablename)} t`;
          result.push({ table: table.tablename, count: row!.count, digest: row!.digest });
        }
        return result;
      });
    const before = await fingerprint();
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
    console.log(
      JSON.stringify({
        event: "staging_migration_verified",
        through: "0014_roster_candidate_line",
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
