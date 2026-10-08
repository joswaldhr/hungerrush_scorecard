/** Explicit additive migration only. Never called by the application build. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { readBaselineEntries } from "./migration-baseline";

async function main() {
  const target = process.argv[2];
  assert(target === "preview" || target === "production");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(
    url.host,
    target === "preview" ? "nozomi.proxy.rlwy.net:24570" : "metro.proxy.rlwy.net:57223"
  );
  assert.equal(url.pathname, "/railway");
  if (target === "production") {
    const backup = JSON.parse(
      await readFile("docs/audits/2026-10-08-manager-archive-restore.json", "utf8")
    );
    assert(
      backup.restored &&
        backup.allTableDigestsMatch &&
        backup.existingApplicationDataUnchangedAfterMigration
    );
    assert.equal(backup.restoredCopyMigrationsThrough, "0018_manager_roster_archives");
    const age = Date.now() - Date.parse(backup.observedAt);
    assert(age >= 0 && age < 3600000, "Fresh validated backup required");
  }
  const entries = await readBaselineEntries("drizzle");
  const next = entries.at(-1)!;
  assert.equal(next.tag, "0018_manager_roster_archives");
  const statements = (await readFile(`drizzle/${next.tag}.sql`, "utf8")).split(
    "--> statement-breakpoint"
  );
  const client = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    const result = await client.begin(async (tx) => {
      await tx`set local lock_timeout = '5s'`;
      await tx`set local statement_timeout = '60s'`;
      await tx`lock table drizzle.__drizzle_migrations in share row exclusive mode`;
      const applied =
        await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
      const expected = applied.length === entries.length ? entries : entries.slice(0, -1);
      assert.equal(applied.length, expected.length);
      applied.forEach((row, index) => {
        assert.equal(Number(row.created_at), expected[index]!.when);
        assert([expected[index]!.lfHash, expected[index]!.crlfHash].includes(row.hash));
      });
      if (applied.length === entries.length) {
        const [present] =
          await tx`select to_regclass('public.manager_roster_archives') is not null as present`;
        assert(present?.present);
        return { applied: false, alreadyApplied: true };
      }
      for (const statement of statements) await tx.unsafe(statement);
      await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${next.lfHash},${next.when})`;
      const [count] = await tx`select count(*)::int as count from manager_roster_archives`;
      assert.equal(count?.count, 0);
      return { applied: true, alreadyApplied: false };
    });
    const receipt = {
      observedAt: new Date().toISOString(),
      target,
      migration: next.tag,
      ...result,
      existingApplicationRowsWritten: 0,
      vendorRequests: 0,
    };
    await writeFile(
      `docs/audits/2026-10-08-manager-archive-${target}-migration.json`,
      JSON.stringify(receipt, null, 2) + "\n"
    );
    console.log(JSON.stringify(receipt));
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error("Archive migration refused or failed; no source details logged.");
  process.exitCode = 1;
});
