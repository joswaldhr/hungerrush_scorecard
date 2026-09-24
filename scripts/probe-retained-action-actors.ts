import { actionRehearsalScope } from "../src/lib/fixtures/action-rehearsal-scope";
/** Read retained loopback exports and source account roles; no database or vendor writes. */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
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
  const inclusiveEndDay = process.env.LOCAL_SHADOW_END_DAY ?? day;
  const interval = actionRehearsalScope(day, inclusiveEndDay);
  const { start, endExclusive, organizationId, dataSourceId } = interval;
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
    const { zendeskAccountReference } =
      await import("../src/lib/connectors/zendesk-account-binding");
    const accountReference = zendeskAccountReference(vendor.ZENDESK_SUBDOMAIN!);
    const [source] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.id, dataSourceId));
    if (
      source?.organizationId !== organizationId ||
      source.type !== "staging" ||
      source.displayName !== "Local action rehearsal" ||
      (source.configurationReference !== null &&
        source.configurationReference !== accountReference) ||
      (interval.days > 1 && source.configurationReference !== accountReference)
    )
      throw new Error("Retained source inventory or account binding does not match");
    const scope = {
      organizationId,
      dataSourceId,
      start,
      endExclusive,
    };
    const { readTicketActionExport } =
      await import("../src/lib/connectors/ticket-action-checkpoint");
    const { readAgentLegExport } = await import("../src/lib/connectors/agent-leg-checkpoint");
    const tickets = await readTicketActionExport(scope),
      legs = await readAgentLegExport(scope);
    if (!tickets.cohort || !legs.cohort) throw new Error("Require completed retained exports");
    if (
      interval.days > 1 &&
      (tickets.state.accountReference !== accountReference ||
        legs.state.accountReference !== accountReference)
    )
      throw new Error("Retained checkpoints belong to a different account");
    const ids = [
      ...new Set(
        [
          ...tickets.cohort.events.map((event) => event.updater_id),
          ...legs.cohort.legs.filter((leg) => leg.type === "agent").map((leg) => leg.agent_id),
        ].filter((id): id is number => id !== null && id > 0)
      ),
    ].sort((a, b) => a - b);
    if (ids.length > 20_000) throw new Error("Actor inventory exceeds diagnostic size bound");
    const actorOffset = Number(process.env.LOCAL_SHADOW_ACTOR_OFFSET ?? 0);
    if (
      !Number.isSafeInteger(actorOffset) ||
      actorOffset < 0 ||
      actorOffset % 100 !== 0 ||
      (actorOffset >= ids.length && ids.length !== 0)
    )
      throw new Error("Invalid actor batch offset");
    const actorEnd = Math.min(ids.length, actorOffset + 2000);
    const { zendeskGet } = await import("../src/lib/connectors/zendesk-shared");
    const stats = { requests: 0, retries429: 0, backoffWaitMs: 0 };
    const batches = [];
    const began = Date.now();
    for (let i = actorOffset; i < actorEnd; i += 100) {
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
        batch: i / 100 + 1,
        status: result.status,
        counts: result.counts,
        includingInactiveOrDeleted: inclusive,
      });
      console.log(JSON.stringify(batches[batches.length - 1]));
    }
    const report = {
      observedAt: new Date().toISOString(),
      day,
      inclusiveEndDay,
      intervalDays: interval.days,
      actorOffset,
      actorEnd,
      nextActorOffset: actorEnd < ids.length ? actorEnd : null,
      coversEntireInventory: actorOffset === 0 && actorEnd === ids.length,
      mode: "GET-only actor diagnostic from retained local exports; no employee totals or publication",
      ticketEvents: tickets.cohort.events.length,
      callLegs: legs.cohort.legs.length,
      requestedActors: ids.length,
      actorInventoryHash: createHash("sha256").update(JSON.stringify(ids)).digest("hex"),
      ticketOrCallExportRequests: 0,
      batches,
      requests: stats,
      evaluatedBatchesComplete: batches.every((batch) => batch.status === "complete"),
      defaultLookupComplete:
        actorOffset === 0 &&
        actorEnd === ids.length &&
        batches.every((batch) => batch.status === "complete"),
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
