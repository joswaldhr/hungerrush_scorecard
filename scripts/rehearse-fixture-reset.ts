/** Creates and removes its own loopback database; never loads .env. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function main() {
  const adminUrl = new URL(process.env.FIXTURE_ADMIN_DATABASE_URL ?? "");
  assert.equal(adminUrl.protocol, "postgresql:");
  assert.equal(adminUrl.hostname, "127.0.0.1");
  assert.equal(adminUrl.pathname, "/postgres");
  assert.equal(adminUrl.search, "");
  assert.equal(adminUrl.hash, "");
  const database = `cadence_seed_${randomUUID().replaceAll("-", "")}_test`;
  const admin = postgres(adminUrl.toString(), { max: 1 });
  let created = false;
  let client: ReturnType<typeof postgres> | undefined;
  const seed = (url: string) =>
    spawnSync(process.execPath, ["--import", "tsx", "src/lib/fixtures/seed.ts"], {
      env: { ...process.env, DATABASE_URL: url },
      encoding: "utf8",
      timeout: 60_000,
    });
  try {
    const refused = seed("postgresql://fixture:synthetic-secret@blocked.invalid/railway");
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr, /Fixture reset requires a loopback/);
    assert(!refused.stderr.includes("synthetic-secret"));
    await admin.unsafe(`CREATE DATABASE "${database}"`);
    created = true;
    adminUrl.pathname = `/${database}`;
    client = postgres(adminUrl.toString(), { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: "drizzle" });
    assert.equal(seed(adminUrl.toString()).status, 0, "Initial local seed failed");
    const before = await client`select count(*)::int as count from employees`;
    const [run] =
      await client`insert into sync_runs (data_source_id) select id from data_sources limit 1 returning id`;
    assert(run);
    await client`insert into sync_revisions (sync_run_id, entity_type, entity_id, snapshot_json) values (${run.id}, 'fixture', ${randomUUID()}, '{}')`;
    await client`insert into metric_visibility_overrides (scope, metric_definition_id, hidden, hidden_by) select 'global_default', m.id, true, u.id from metric_definitions m cross join users u limit 1`;
    assert.equal(seed(adminUrl.toString()).status, 0, "Repeated local seed failed");
    const after = await client`select count(*)::int as count from employees`;
    assert(before[0] && before[0].count > 0);
    assert(after[0]);
    assert.deepEqual(after, before);
    for (const table of ["sync_revisions", "metric_visibility_overrides", "sync_runs"]) {
      const rows: { count: number }[] = await client.unsafe<{ count: number }[]>(
        `select count(*)::int as count from "${table}"`
      );
      assert(rows[0]);
      assert.equal(rows[0].count, 0);
    }
    console.log(
      JSON.stringify({
        hostedUrlRefused: true,
        repeatedResetPassed: true,
        employees: after[0].count,
      })
    );
  } finally {
    await client?.end();
    if (created) {
      assert(/^cadence_seed_[a-f0-9]{32}_test$/.test(database));
      await admin.unsafe(`DROP DATABASE "${database}"`);
    }
    await admin.end();
  }
}

main().catch(() => {
  console.error("Local fixture reset rehearsal failed; no connection details logged.");
  process.exitCode = 1;
});
