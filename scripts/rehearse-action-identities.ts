/** Reads three production mapping emails; vendor GETs and loopback-only fixture writes. */
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";

async function main() {
  const localUrl = process.env.LOCAL_SHADOW_DATABASE_URL,
    output = process.argv[2];
  if (!localUrl || !output) throw new Error("Require loopback database URL and report path");
  const target = new URL(localUrl);
  if (
    target.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !/^[a-z0-9_]+_test$/.test(target.pathname.slice(1)) ||
    target.search
  )
    throw new Error("Writes require a loopback database ending in _test");
  const configured = parseEnv(await readFile(".env", "utf8"));
  if (!configured.DATABASE_URL) throw new Error("Read-only source database is required");
  const remote = postgres(configured.DATABASE_URL, { max: 1 });
  const emails = await remote
    .begin("read only", async (tx) => {
      await tx`SET LOCAL statement_timeout = '15s'`;
      return tx<{ email: string }[]>`SELECT i.external_id AS email FROM external_identities i
      JOIN employees e ON e.id = i.employee_id JOIN data_sources s ON s.id = i.data_source_id
      WHERE s.type = 'zendesk' AND e.organization_id = s.organization_id
        AND e.employment_status = 'active' ORDER BY i.id LIMIT 3`;
    })
    .finally(() => remote.end());
  if (emails.length !== 3) throw new Error("Require three sample mappings");
  for (const key of ["ZENDESK_SUBDOMAIN", "ZENDESK_EMAIL", "ZENDESK_API_KEY"])
    if (configured[key]) process.env[key] = configured[key];
    else throw new Error("Missing source configuration");
  process.env.DATABASE_URL = localUrl;
  process.env.AUTH_SECRET = "local-snapshot-rehearsal-only";
  const schema = await import("../src/lib/db/schema");
  const client = postgres(localUrl),
    db = drizzle(client, { schema });
  (globalThis as unknown as { _cadenceDb: typeof db })._cadenceDb = db;
  const organizationId = randomUUID(),
    sourceId = randomUUID(),
    observationId = randomUUID();
  try {
    await db
      .insert(schema.organizations)
      .values({ id: organizationId, name: "Local identity rehearsal" });
    await db
      .insert(schema.dataSources)
      .values({
        id: sourceId,
        organizationId,
        type: "staging",
        displayName: "Local identity rehearsal",
      });
    for (const { email } of emails) {
      const employeeId = randomUUID();
      await db
        .insert(schema.employees)
        .values({ id: employeeId, organizationId, displayName: "Local identity fixture" });
      await db
        .insert(schema.externalIdentities)
        .values({
          employeeId,
          dataSourceId: sourceId,
          externalEntityType: "user",
          externalId: email,
          matchMethod: "email",
        });
    }
    const { captureActionIdentitySnapshot, readActionIdentitySnapshot } =
      await import("../src/lib/connectors/action-identity-snapshot");
    const { zendeskGet } = await import("../src/lib/connectors/zendesk-shared");
    let requests = 0;
    const snapshot = await captureActionIdentitySnapshot(
      organizationId,
      sourceId,
      observationId,
      (path) => {
        requests++;
        return zendeskGet(path, undefined, { deferRateLimit: true });
      }
    );
    if (snapshot.members.some((member) => member.match !== "matched"))
      throw new Error("Sample match failed");
    await db
      .update(schema.employees)
      .set({ employmentStatus: "inactive" })
      .where(eq(schema.employees.organizationId, organizationId));
    const retained = await captureActionIdentitySnapshot(
      organizationId,
      sourceId,
      observationId,
      async () => {
        throw new Error("Frozen observation must not refetch");
      }
    );
    if (retained.members.some((member) => member.employmentStatus !== "active"))
      throw new Error("Snapshot changed with roster");
    // Keep the minimal snapshot and synthetic employees, not the sampled email-address rows.
    await db
      .delete(schema.externalIdentities)
      .where(eq(schema.externalIdentities.dataSourceId, sourceId));
    const stored = await readActionIdentitySnapshot(organizationId, sourceId, observationId);
    if (!stored || stored.members.length !== 3) throw new Error("Missing stored evidence");
    const report = {
      observedAt: new Date().toISOString(),
      sampleMappings: 3,
      vendorRequests: requests,
      matched: snapshot.members.length,
      writes: "loopback synthetic fixtures only",
      productionWrites: 0,
      retainedAfterRosterChange: true,
      refetchOnRetry: false,
      rawEmailFixtureRowsRemoved: true,
      historicalEligibility: stored.historicalEligibility,
      humanActivityAttribution: stored.humanActivityAttribution,
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  } finally {
    await db
      .delete(schema.externalIdentities)
      .where(eq(schema.externalIdentities.dataSourceId, sourceId));
    await client.end();
  }
}
main().catch(() => {
  console.error("Identity rehearsal failed; no credentials or identity values logged.");
  process.exitCode = 1;
});
