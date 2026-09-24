/** Explicitly targeted staging rehearsal. Never loads .env or contacts a vendor. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../src/lib/db/schema";
import type { Connector } from "../src/lib/connectors/types";

async function main() {
  const hosted =
    process.env.STAGING_RAILWAY_ENVIRONMENT_ID === "4e86528b-7329-4d73-a651-9f0fb3d07755";
  const adminUrl = new URL(
    (hosted ? process.env.STAGING_DATABASE_URL : process.env.STAGING_ADMIN_DATABASE_URL) ?? ""
  );
  let database: string;
  if (hosted) {
    assert.equal(adminUrl.protocol, "postgresql:");
    assert.equal(
      adminUrl.hostname,
      "nozomi.proxy.rlwy.net",
      "Only the approved staging endpoint is allowed"
    );
    assert.equal(adminUrl.port, "24570");
    assert.equal(adminUrl.pathname, "/railway");
    assert(adminUrl.password, "Password required");
    // Do not let URL query options override the endpoint validated above.
    adminUrl.search = "";
    adminUrl.searchParams.set("sslmode", "require");
    database = "railway";
  } else {
    assert(
      ["127.0.0.1", "localhost", "[::1]"].includes(adminUrl.hostname),
      "Staging rehearsal requires loopback"
    );
    assert.equal(
      adminUrl.pathname,
      "/postgres",
      "Supply the local postgres administration database"
    );
    database = `cadence_stage_${Date.now()}`;
    const admin = postgres(adminUrl.toString(), { max: 1 });
    await admin.unsafe(`CREATE DATABASE "${database}"`);
    await admin.end();
    adminUrl.pathname = `/${database}`;
  }
  process.env.DATABASE_URL = adminUrl.toString();
  const client = postgres(adminUrl.toString(), { max: 1 });
  const connection = drizzle(client, { schema });
  if (hosted) {
    const tables =
      await client`select tablename from pg_tables where schemaname not in ('pg_catalog', 'information_schema')`;
    assert.equal(
      tables.length,
      0,
      "Hosted rehearsal requires an empty database; never reset populated data automatically"
    );
    const tls = await client`select ssl from pg_stat_ssl where pid = pg_backend_pid()`;
    assert.equal(tls[0]?.ssl, true, "Hosted connection must use TLS");
  }
  const migrationFolder = path.resolve("drizzle");
  const journal = JSON.parse(
    await readFile(path.join(migrationFolder, "meta/_journal.json"), "utf8")
  );
  assert.equal(
    journal.entries.at(-1).tag,
    "0013_visibility_scope_uniqueness",
    "Review the rehearsal when adding another migration"
  );
  const previousFolder = await mkdtemp(path.join(tmpdir(), "cadence-stage-migrations-"));
  await mkdir(path.join(previousFolder, "meta"));
  const entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 12);
  await writeFile(
    path.join(previousFolder, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries })
  );
  for (const entry of entries)
    await copyFile(
      path.join(migrationFolder, `${entry.tag}.sql`),
      path.join(previousFolder, `${entry.tag}.sql`)
    );
  await migrate(connection, { migrationsFolder: previousFolder });

  const org = randomUUID(),
    employee = randomUUID(),
    source = randomUUID(),
    metric = randomUUID(),
    recordId = randomUUID();
  const observed = new Date("2026-09-21T07:30:00Z");
  await connection
    .insert(schema.organizations)
    .values({ id: org, name: "Synthetic staging rehearsal" });
  await connection
    .insert(schema.employees)
    .values({ id: employee, organizationId: org, displayName: "Synthetic employee" });
  await connection
    .insert(schema.dataSources)
    .values({ id: source, organizationId: org, type: "staging", displayName: "Synthetic source" });
  await connection.insert(schema.externalIdentities).values({
    employeeId: employee,
    dataSourceId: source,
    externalId: "stage-agent",
    externalEntityType: "user",
    matchMethod: "manual",
  });
  await connection.insert(schema.metricDefinitions).values({
    id: metric,
    organizationId: org,
    key: "stage_metric",
    name: "Staging metric",
    sourceStrategy: "staging",
    calculationType: "latest",
  });
  await connection.insert(schema.sourceRecords).values({
    id: recordId,
    dataSourceId: source,
    externalRecordType: "summary",
    externalRecordId: "stage-summary",
    employeeId: employee,
    periodStart: "2026-09-20",
    periodEnd: "2026-09-26",
    payloadJson: { value: 42 },
    payloadHash: "legacy",
    sourceUpdatedAt: observed,
  });
  await connection.insert(schema.normalizedFacts).values({
    organizationId: org,
    employeeId: employee,
    factType: "stage_metric",
    numericValue: 42,
    periodStart: "2026-09-20",
    periodEnd: "2026-09-26",
    dataSourceId: source,
    sourceRecordId: recordId,
    sourceObservedAt: observed,
  });
  await connection.insert(schema.metricValues).values({
    metricDefinitionId: metric,
    employeeId: employee,
    periodStart: "2026-09-20",
    periodEnd: "2026-09-26",
    numericValue: 42,
    dataFreshnessAt: observed,
  });
  const readValue = async () =>
    (
      await connection
        .select()
        .from(schema.metricValues)
        .where(eq(schema.metricValues.metricDefinitionId, metric))
    )[0]!;
  const before = await readValue();
  const actor = randomUUID(),
    originalRule = randomUUID(),
    duplicateRule = randomUUID();
  await connection
    .insert(schema.users)
    .values({
      id: actor,
      organizationId: org,
      email: "synthetic-stage@example.test",
      displayName: "Synthetic admin",
    });
  const rule = {
    scope: "global_default",
    metricDefinitionId: metric,
    hidden: true,
    hiddenBy: actor,
  };
  await connection.insert(schema.metricVisibilityOverrides).values([
    { ...rule, id: originalRule },
    { ...rule, id: duplicateRule },
  ]);
  // Legacy NULL uniqueness permits these two rows. The upgrade must refuse rather than discard data.
  await assert.rejects(migrate(connection, { migrationsFolder: migrationFolder }));
  assert.equal((await connection.select().from(schema.metricVisibilityOverrides)).length, 2);
  const indexAfterFailure =
    await client`SELECT indexname FROM pg_indexes WHERE indexname = 'metric_visibility_overrides_unique_idx'`;
  assert.equal(indexAfterFailure.length, 1, "Failed migration must restore the legacy index");
  await connection
    .delete(schema.metricVisibilityOverrides)
    .where(eq(schema.metricVisibilityOverrides.id, duplicateRule));
  const started = Date.now();
  await migrate(connection, { migrationsFolder: migrationFolder });
  const migrationMs = Date.now() - started;
  assert.deepEqual(await readValue(), before, "Migration must preserve existing data");
  assert.equal(
    (await connection.select().from(schema.metricVisibilityOverrides))[0]?.id,
    originalRule
  );
  await assert.rejects(connection.insert(schema.metricVisibilityOverrides).values(rule));
  await connection.insert(schema.metricVisibilityOverrides).values({ ...rule, line: "" });
  assert.equal(
    (await connection.select().from(schema.metricVisibilityOverrides)).length,
    2,
    "Empty line and null must remain distinct"
  );

  const { runSync } = await import("../src/lib/connectors/sync-engine");
  let numericValue: number | null = null;
  let fail = false;
  const connector: Connector = {
    sourceType: "staging",
    healthCheck: async () => ({ connected: true, message: "synthetic", lastSyncAt: null }),
    fetchRecords: async () => {
      if (fail) throw new Error("Synthetic staging outage");
      return {
        records: [
          {
            externalRecordType: "summary",
            externalRecordId: "stage-summary",
            employeeExternalId: "stage-agent",
            occurredAt: observed,
            sourceUpdatedAt: observed,
            periodStart: "2026-09-20",
            periodEnd: "2026-09-26",
            payload: { value: numericValue },
          },
        ],
        cursor: null,
        hasMore: false,
      };
    },
    normalizeRecords: (_rows, employeeId, teamId, periodStart, periodEnd) => [
      {
        employeeId,
        teamId,
        periodStart,
        periodEnd,
        factType: "stage_metric",
        numericValue,
        textValue: null,
        booleanValue: null,
        unit: "count",
        dimensionsJson: null,
      },
    ],
    resolveIdentities: async () => [],
    discoverRoster: async () => [],
  };
  const config = { organizationId: org, dataSourceId: source };
  const corrected = await runSync(connector, config);
  assert.equal(corrected.success, true);
  assert.equal((await readValue()).numericValue, null);
  assert.equal((await readValue()).qualityStatus, "missing");
  const revisions = await connection
    .select()
    .from(schema.syncRevisions)
    .where(eq(schema.syncRevisions.syncRunId, corrected.syncRunId));
  assert.equal(revisions.length, 3);
  assert.equal(
    (
      revisions.find((r) => r.entityType === "metric_value")!.snapshotJson as {
        numeric_value: number;
      }
    ).numeric_value,
    42
  );
  numericValue = 0;
  assert.equal((await runSync(connector, config)).success, true);
  assert.equal((await readValue()).numericValue, 0);
  assert.equal((await readValue()).dataFreshnessAt?.getTime(), observed.getTime());
  fail = true;
  const beforeFailure = await readValue();
  assert.equal((await runSync(connector, config)).success, false);
  assert.deepEqual(await readValue(), beforeFailure);
  await migrate(connection, { migrationsFolder: migrationFolder });
  assert.deepEqual(await readValue(), beforeFailure, "Re-running migration must be a no-op");
  const versionRows = await client<{ version: string }[]>`select version()`;
  const version = versionRows[0]!.version;
  const report = {
    timestamp: new Date().toISOString(),
    database,
    postgres: version,
    scope: hosted
      ? "isolated Railway staging; synthetic data; no vendor calls; not Vercel runtime validation"
      : "isolated local staging; synthetic data; no vendor calls; not hosted production parity",
    ...(hosted
      ? {
          railwayEnvironmentId: process.env.STAGING_RAILWAY_ENVIRONMENT_ID,
          tlsEncrypted: true,
          tlsCertificateValidation: "Railway self-signed certificate; sslmode=require",
        }
      : {}),
    migration: "0011 -> 0013",
    duplicateScopeUpgradeRejectedWithoutDataLoss: true,
    failedUpgradeRestoredLegacyIndex: true,
    nullableDuplicateRejected: true,
    emptyLineRemainsDistinctFromNull: true,
    migrationMs,
    preservedExistingValue: 42,
    correctedValue: null,
    priorMetricRevision: 42,
    correctionRevisions: revisions.length,
    confirmedZero: 0,
    failedSyncPreservedValues: true,
    migrationRerunPreservedValues: true,
  };
  await writeFile(
    hosted
      ? "docs/audits/2026-09-24-hosted-staging-rehearsal.json"
      : "docs/audits/2026-09-24-staging-rehearsal.json",
    JSON.stringify(report, null, 2) + "\n"
  );
  console.log(JSON.stringify(report, null, 2));
  await client.end();
}
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(
      error instanceof Error ? `${error.name}: ${error.message}` : "Staging rehearsal failed"
    );
    process.exit(1);
  });
