/** Windows-only, read-only source backup; restore into a disposable private loopback cluster. */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

async function run(file: string, args: string[], env = process.env) {
  await new Promise<void>((resolve, reject) => {
    // Never forward libpq errors: they can include connection details or row values.
    const child = spawn(file, args, { env, stdio: "ignore", windowsHide: true });
    child.once("error", () => reject(new Error(`${path.basename(file)} could not start`)));
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`${path.basename(file)} failed (${code})`))
    );
  });
}

async function powershell(script: string, env = process.env) {
  const childEnv = { ...env };
  // A parent PowerShell 7 module path cannot be loaded by Windows PowerShell 5.
  delete childEnv.PSModulePath;
  await run(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-EncodedCommand",
      Buffer.from(script, "utf16le").toString("base64"),
    ],
    childEnv
  );
}

type Inventory = { table: string; count: number; digest: string | null }[];
async function inventory(
  tx: postgres.TransactionSql,
  omitNewRosterLine = false,
  normalizeNumericWidening = false
): Promise<Inventory> {
  await tx`set local timezone = 'UTC'`;
  const tables = await tx`select schemaname, tablename from pg_tables
    where schemaname not in ('pg_catalog','information_schema')
    order by schemaname, tablename`;
  const result: Inventory = [];
  for (const table of tables) {
    const omit =
      omitNewRosterLine && table.tablename === "roster_candidates" ? ["suggested_line"] : [];
    // Exact source/restore comparison remains unchanged. Only migration comparisons
    // normalize the JSON representation of the same widened numeric value.
    const value =
      normalizeNumericWidening && ["metric_values", "normalized_facts"].includes(table.tablename)
        ? tx`(to_jsonb(t) || jsonb_build_object('numeric_value', t.numeric_value::double precision))`
        : tx`to_jsonb(t)`;
    const [row] = await tx`select count(*)::int as count,
      md5(string_agg(md5((${value} - ${omit}::text[])::text), '' order by md5((${value} - ${omit}::text[])::text))) as digest
      from ${tx(table.schemaname)}.${tx(table.tablename)} t`;
    result.push({
      table: `${table.schemaname}.${table.tablename}`,
      count: row!.count,
      digest: row!.digest,
    });
  }
  return result;
}

async function main() {
  assert.equal(process.platform, "win32");
  const reportPath = path.resolve(
    process.argv[2] ??
      `docs/audits/${new Date().toISOString().replaceAll(":", "-")}-production-restore-rehearsal.json`
  );
  assert.equal(path.dirname(reportPath), path.resolve("docs/audits"));
  assert(reportPath.endsWith(".json"));
  const bin = path.resolve(process.env.RESTORE_PG_BIN ?? "");
  assert(process.env.RESTORE_PG_BIN, "Explicit PostgreSQL 18 binary directory required");
  const sourceUrl = new URL(process.env.DATABASE_URL ?? "");
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  assert.equal(journal.entries.at(-1).tag, "0015_metric_numeric_precision");
  assert.equal(sourceUrl.hostname, "metro.proxy.rlwy.net");
  assert.equal(sourceUrl.port, "57223");
  assert.equal(sourceUrl.pathname, "/railway");
  const profile = os.homedir();
  // Reject a missing/relative launcher profile before creating any source backup.
  // Node coerces a null environment entry into the literal relative path "null".
  assert(path.isAbsolute(profile), "Absolute Windows profile directory required");
  const relativeProfile = path.relative(process.cwd(), profile);
  assert(
    relativeProfile.startsWith("..") || path.isAbsolute(relativeProfile),
    "Recovery profile must be outside the repository"
  );
  const base = path.join(profile, ".codex", "private-backups", "cadence");
  const root = path.join(base, `restore-${Date.now()}`);
  assert.equal(path.dirname(root), base);
  await mkdir(root, { recursive: true });
  await powershell(
    `$ErrorActionPreference='Stop'; $p=$env:CADENCE_RECOVERY_ROOT;
    $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User;
    $acl=Get-Acl -LiteralPath $p; $acl.SetAccessRuleProtection($true,$false);
    $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow');
    $acl.AddAccessRule($rule); Set-Acl -LiteralPath $p -AclObject $acl;`,
    { ...process.env, CADENCE_RECOVERY_ROOT: root }
  );
  const dump = path.join(root, "database.dump");
  const recovered = path.join(root, "recovered.dump");
  const cluster = path.join(root, "cluster");
  const passwordFile = path.join(root, "local-password.txt");
  const secret = randomBytes(32).toString("hex");
  const pg = (name: string) => path.join(bin, `${name}.exe`);
  const sourceEnv = {
    ...process.env,
    PGHOST: sourceUrl.hostname,
    PGPORT: sourceUrl.port,
    PGUSER: decodeURIComponent(sourceUrl.username),
    PGPASSWORD: decodeURIComponent(sourceUrl.password),
    PGDATABASE: "railway",
    PGSSLMODE: "require",
    PGOPTIONS: "-c default_transaction_read_only=on -c statement_timeout=120000",
  };
  const localEnv = {
    ...process.env,
    PGHOST: "127.0.0.1",
    PGPORT: "55440",
    PGUSER: "cadence_restore",
    PGPASSWORD: secret,
    PGDATABASE: "cadence_restore",
    PGSSLMODE: "disable",
    PGOPTIONS: "",
  };
  const source = postgres(sourceUrl.toString(), { max: 1, ssl: "require" });
  let started = false;
  let stage = "snapshot";
  try {
    const before = await source.begin("isolation level repeatable read read only", async (tx) => {
      await tx`set local statement_timeout = '120s'`;
      const [snapshot] = await tx`select pg_export_snapshot() as id`;
      stage = "pg_dump snapshot";
      await run(
        pg("pg_dump"),
        [
          "--format=custom",
          "--no-password",
          "--lock-wait-timeout=15s",
          `--snapshot=${snapshot!.id}`,
          `--file=${dump}`,
        ],
        sourceEnv
      );
      stage = "source inventory";
      return inventory(tx);
    });
    const bytes = await readFile(dump);
    const hash = createHash("sha256").update(bytes).digest("hex");
    stage = "encrypt";
    await powershell(
      `$ErrorActionPreference='Stop'; Add-Type -AssemblyName System.Security;
      $p=$env:CADENCE_RECOVERY_ROOT;
      $b=[IO.File]::ReadAllBytes((Join-Path $p 'database.dump'));
      $e=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);
      [IO.File]::WriteAllBytes((Join-Path $p 'database.dump.dpapi'),$e);
      $d=[Security.Cryptography.ProtectedData]::Unprotect($e,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);
      [IO.File]::WriteAllBytes((Join-Path $p 'recovered.dump'),$d);`,
      { ...process.env, CADENCE_RECOVERY_ROOT: root }
    );
    assert.equal(
      createHash("sha256")
        .update(await readFile(recovered))
        .digest("hex"),
      hash
    );
    stage = "initialize";
    await writeFile(passwordFile, secret);
    await run(pg("initdb"), [
      "-D",
      cluster,
      "-U",
      "cadence_restore",
      "--auth=scram-sha-256",
      `--pwfile=${passwordFile}`,
      "--encoding=UTF8",
      "--locale=C",
    ]);
    await run(pg("pg_ctl"), [
      "-D",
      cluster,
      "-l",
      path.join(root, "server.log"),
      "-o",
      "-h 127.0.0.1 -p 55440",
      "-w",
      "start",
    ]);
    started = true;
    stage = "restore";
    await run(pg("createdb"), ["--no-password", "cadence_restore"], {
      ...localEnv,
      PGDATABASE: "postgres",
    });
    await run(
      pg("pg_restore"),
      [
        "--no-password",
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        "--dbname=cadence_restore",
        recovered,
      ],
      localEnv
    );
    const local = postgres({
      host: "127.0.0.1",
      port: 55440,
      username: "cadence_restore",
      password: secret,
      database: "cadence_restore",
      max: 1,
    });
    try {
      stage = "compare";
      const after = await local.begin("read only", inventory);
      assert.deepEqual(after, before);
      stage = "migrate restored copy";
      const lineExists =
        await local`select 1 from information_schema.columns where table_schema='public'
        and table_name='roster_candidates' and column_name='suggested_line'`;
      const baseline = await local.begin("read only", (tx) =>
        inventory(tx, lineExists.length === 0, true)
      );
      await local`set lock_timeout = '10s'`;
      await local`set statement_timeout = '120s'`;
      await migrate(drizzle(local), { migrationsFolder: "drizzle" });
      const upgraded = await local.begin("read only", (tx) =>
        inventory(tx, lineExists.length === 0, true)
      );
      for (const original of baseline.filter(
        (table) => table.table !== "drizzle.__drizzle_migrations"
      )) {
        assert.deepEqual(
          upgraded.find((table) => table.table === original.table),
          original
        );
      }
      // After the first production sync, revisions are part of the recovery
      // snapshot too. Preserve their existing count rather than requiring empty.
      assert.equal(
        upgraded.find((table) => table.table === "public.sync_revisions")?.count,
        baseline.find((table) => table.table === "public.sync_revisions")?.count ?? 0
      );
    } finally {
      await local.end();
    }
    const report = {
      observedAt: new Date().toISOString(),
      sourceReadOnly: true,
      dumpFormat: "PostgreSQL custom",
      plaintextBytes: bytes.length,
      sha256: hash,
      encryption: "Windows DPAPI CurrentUser",
      encryptedRoundTrip: true,
      restored: true,
      tableCount: before.length,
      rowCount: before.reduce((n, t) => n + t.count, 0),
      allTableDigestsMatch: true,
      restoredCopyMigrationsThrough: "0015_metric_numeric_precision",
      existingApplicationDataUnchangedAfterMigration: true,
      globalsAndOriginalOwnershipRestored: false,
      limitation:
        "Recovery requires this Windows user profile; not a portable disaster-recovery copy or provider PITR.",
    };
    await writeFile(
      path.join(root, "manifest.json"),
      JSON.stringify({ ...report, tables: before }, null, 2)
    );
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify(report));
  } catch {
    throw new Error(
      `Backup rehearsal failed at ${stage}; private evidence retained without logging source data`
    );
  } finally {
    await source.end();
    if (started) await run(pg("pg_ctl"), ["-D", cluster, "-m", "fast", "-w", "stop"]);
    // Explicit, verified children of the newly created private recovery directory only.
    for (const target of [dump, recovered, passwordFile, cluster]) {
      assert.equal(path.dirname(path.resolve(target)), root);
      await rm(target, { recursive: target === cluster, force: true });
    }
  }
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Restore rehearsal failed");
  process.exitCode = 1;
});
