/** Read retained loopback exports and source account roles; no database or vendor writes. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { inspectActionActorBatch } from "../src/lib/connectors/zendesk-action-actors";

async function main() {
  const [day, output] = process.argv.slice(2);
  const localUrl = process.env.LOCAL_SHADOW_DATABASE_URL;
  if (!localUrl || !day || !output) throw new Error("Require loopback URL, day and report path");
  const target = new URL(localUrl);
  if (
    target.protocol !== "postgresql:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
    !/^[a-z0-9_]+_test$/.test(target.pathname.slice(1)) ||
    target.search
  )
    throw new Error("Require loopback test database");
  const start = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day)
    throw new Error("Invalid day");
  const endExclusive = new Date(start.getTime() + 86_400_000);
  if (endExclusive.getTime() > Date.now() - 120_000) throw new Error("Require a closed day");
  const vendor = parseEnv(await readFile(".env", "utf8"));
  for (const key of ["ZENDESK_SUBDOMAIN", "ZENDESK_EMAIL", "ZENDESK_API_KEY"])
    if (vendor[key]) process.env[key] = vendor[key];
    else throw new Error("Missing vendor configuration");
  process.env.DATABASE_URL = localUrl;
  process.env.AUTH_SECRET = "local-actor-probe-only";
  const schema = await import("../src/lib/db/schema");
  const client = postgres(localUrl, {
    max: 1,
    connection: { default_transaction_read_only: true, statement_timeout: 15_000 },
  });
  const db = drizzle(client, { schema });
  (globalThis as unknown as { _cadenceDb: typeof db })._cadenceDb = db;
  try {
    const id = (kind: string) => {
      const hex = createHash("sha256")
        .update(`local-action-rehearsal:${day}:${kind}`)
        .digest("hex");
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
    };
    const scope = {
      organizationId: id("organization"),
      dataSourceId: id("source"),
      start,
      endExclusive,
    };
    const { readTicketActionExport } =
      await import("../src/lib/connectors/ticket-action-checkpoint");
    const { readAgentLegExport } = await import("../src/lib/connectors/agent-leg-checkpoint");
    const tickets = await readTicketActionExport(scope),
      legs = await readAgentLegExport(scope);
    if (!tickets.cohort || !legs.cohort) throw new Error("Require completed retained exports");
    const ids = [
      ...new Set(
        [
          ...tickets.cohort.events.map((event) => event.updater_id),
          ...legs.cohort.legs.filter((leg) => leg.type === "agent").map((leg) => leg.agent_id),
        ].filter((id): id is number => id !== null && id > 0)
      ),
    ].sort((a, b) => a - b);
    if (ids.length > 2000) throw new Error("Actor census exceeds bounded request budget");
    const { zendeskGet } = await import("../src/lib/connectors/zendesk-shared");
    const stats = { requests: 0, retries429: 0, backoffWaitMs: 0 };
    const batches = [];
    const began = Date.now();
    for (let i = 0; i < ids.length; i += 100) {
      if (Date.now() - began > 170_000) throw new Error("Actor census budget exhausted");
      const batch = ids.slice(i, i + 100),
        path = `/users/show_many.json?ids=${batch.join(",")}`;
      const result = inspectActionActorBatch(
        batch,
        await zendeskGet(path, stats, { deferRateLimit: true })
      );
      // Optional vendor-supported diagnostic includes inactive/deleted accounts. It does
      // not establish which cause applies, historical roles, employee mapping or human activity.
      let inclusive;
      if (result.status === "incomplete") {
        if (Date.now() - began > 170_000) throw new Error("Actor census budget exhausted");
        const expanded = inspectActionActorBatch(
          batch,
          await zendeskGet(`${path}&include_deleted=true`, stats, { deferRateLimit: true })
        );
        inclusive = { status: expanded.status, counts: expanded.counts };
      }
      batches.push({
        batch: batches.length + 1,
        status: result.status,
        counts: result.counts,
        includingInactiveOrDeleted: inclusive,
      });
      console.log(JSON.stringify(batches[batches.length - 1]));
    }
    const report = {
      observedAt: new Date().toISOString(),
      day,
      mode: "GET-only actor diagnostic from retained local exports; no employee totals or publication",
      ticketEvents: tickets.cohort.events.length,
      callLegs: legs.cohort.legs.length,
      requestedActors: ids.length,
      ticketOrCallExportRequests: 0,
      batches,
      requests: stats,
      defaultLookupComplete: batches.every((batch) => batch.status === "complete"),
      historicalRoleAndHumanAttribution: "unverified",
    };
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(
      JSON.stringify({
        report: output,
        requests: stats.requests,
        complete: report.defaultLookupComplete,
      })
    );
  } finally {
    await client.end();
  }
}
main().catch(() => {
  console.error("Retained actor diagnostic failed; no source IDs, payloads or credentials logged.");
  process.exitCode = 1;
});
