/** One real-source batch per process; all writes are restricted to a loopback test DB. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";

async function main() {
  const [day, output] = process.argv.slice(2);
  const localUrl = process.env.LOCAL_SHADOW_DATABASE_URL;
  if (!localUrl || !day || !output || !/^\d{4}-\d{2}-\d{2}$/.test(day))
    throw new Error("Require LOCAL_SHADOW_DATABASE_URL and arguments YYYY-MM-DD report.json");
  const target = new URL(localUrl);
  if (
    target.protocol !== "postgresql:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname) ||
    !/^[a-z0-9_]+_test$/.test(target.pathname.slice(1)) ||
    target.search
  )
    throw new Error("Rehearsal writes require a loopback PostgreSQL database ending in _test");
  const start = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day)
    throw new Error("Invalid day");
  const endExclusive = new Date(start.getTime() + 86_400_000);
  if (endExclusive.getTime() > Date.now() - 120_000) throw new Error("Require a closed day");

  // Read only vendor keys. Never import the production database URL or auth credentials.
  const vendor = parseEnv(await readFile(".env", "utf8"));
  for (const key of ["ZENDESK_SUBDOMAIN", "ZENDESK_EMAIL", "ZENDESK_API_KEY"])
    if (vendor[key]) process.env[key] = vendor[key];
    else throw new Error("Zendesk credentials are required");
  process.env.DATABASE_URL = localUrl;
  process.env.AUTH_SECRET = "local-shadow-rehearsal-only";
  const schema = await import("../src/lib/db/schema");
  const client = postgres(localUrl);
  const db = drizzle(client, { schema });
  (globalThis as unknown as { _cadenceDb: typeof db })._cadenceDb = db;
  try {
    const { runActionShadowBatch } = await import("../src/lib/connectors/action-shadow-worker");
    const { readTicketActionExport } =
      await import("../src/lib/connectors/ticket-action-checkpoint");
    const { readAgentLegExport } = await import("../src/lib/connectors/agent-leg-checkpoint");
    const { zendeskGet } = await import("../src/lib/connectors/zendesk-shared");
    // Deterministic rehearsal-only IDs allow subsequent processes to find the same checkpoint.
    const id = (kind: string) => {
      const hex = createHash("sha256")
        .update(`local-action-rehearsal:${day}:${kind}`)
        .digest("hex");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    };
    const organizationId = id("organization"),
      dataSourceId = id("source");
    await db
      .insert(schema.organizations)
      .values({ id: organizationId, name: "Local action rehearsal" })
      .onConflictDoNothing();
    await db
      .insert(schema.dataSources)
      .values({
        id: dataSourceId,
        organizationId,
        type: "staging",
        displayName: "Local action rehearsal",
      })
      .onConflictDoNothing();
    const scope = {
      organizationId,
      dataSourceId,
      start,
      endExclusive,
      observationId: process.argv[4],
    };
    const before = {
      tickets: (await readTicketActionExport(scope)).state.pages,
      legs: (await readAgentLegExport(scope)).state.pages,
    };
    let requests = 0;
    const batch = await runActionShadowBatch(scope, (path) => {
      requests++;
      return zendeskGet(path, undefined, { deferRateLimit: true });
    });
    const tickets = await readTicketActionExport(scope),
      legs = await readAgentLegExport(scope);
    const [facts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.normalizedFacts)
      .where(eq(schema.normalizedFacts.dataSourceId, dataSourceId));
    const [source] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.id, dataSourceId));
    if (facts!.count !== 0 || source!.lastSuccessfulSyncAt !== null)
      throw new Error("Shadow rehearsal unexpectedly published data");
    let comparison;
    if (scope.observationId && batch.completed) {
      const { compareActionObservation } =
        await import("../src/lib/connectors/action-observation-comparison");
      const result = await compareActionObservation(scope, scope.observationId);
      const counts = (changes: { added: number[]; removed: number[]; changed: number[] } | null) =>
        changes && {
          added: changes.added.length,
          removed: changes.removed.length,
          changed: changes.changed.length,
        };
      comparison = {
        status: result.status,
        tickets: counts(result.tickets),
        legs: counts(result.legs),
      };
    }
    const report = {
      observedAt: new Date().toISOString(),
      day,
      localWritesOnly: true,
      resumedPages: before,
      requests,
      ...batch,
      ticketEvents: tickets.cohort?.events.length ?? null,
      callLegs: legs.cohort?.legs.length ?? null,
      normalizedFacts: facts!.count,
      successfulSyncUnchanged: true,
      comparison,
    };
    await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report));
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error(
    "Local shadow rehearsal failed; checkpoint retained. No credentials or payloads logged."
  );
  process.exitCode = 1;
});
