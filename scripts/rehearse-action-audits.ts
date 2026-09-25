/** Capture three audit samples against a retained loopback observation. Vendor GETs only. */
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, sql } from "drizzle-orm";
import { actionRehearsalScope } from "../src/lib/fixtures/action-rehearsal-scope";
import { z } from "zod";

let stage = "configuration";

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
  process.env.AUTH_SECRET = "local-audit-evidence-only";
  const schema = await import("../src/lib/db/schema");
  const client = postgres(localUrl, { max: 2, connection: { statement_timeout: 15_000 } });
  const db = drizzle(client, { schema });
  (globalThis as unknown as { _cadenceDb: typeof db })._cadenceDb = db;
  try {
    stage = "source binding";
    const { zendeskAccountReference } =
      await import("../src/lib/connectors/zendesk-account-binding");
    const accountReference = zendeskAccountReference(vendor.ZENDESK_SUBDOMAIN!);
    const [source] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.id, dataSourceId));
    const [organization] = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId));
    if (
      organization?.name !== "Local action rehearsal" ||
      source?.organizationId !== organizationId ||
      source.type !== "staging" ||
      source.status !== "configured" ||
      source.displayName !== "Local action rehearsal" ||
      source.configurationReference !== accountReference
    )
      throw new Error("Require owned bound rehearsal source");
    const scope = { organizationId, dataSourceId, accountReference, start, endExclusive };
    const { readTicketActionExport } =
      await import("../src/lib/connectors/ticket-action-checkpoint");
    const retained = await readTicketActionExport(scope);
    if (!retained.cohort || retained.state.accountReference !== accountReference)
      throw new Error("Require complete account-bound retained export");
    const eligible = retained.cohort.events
      .filter(
        (event) =>
          event.updater_id !== null &&
          event.updater_id > 0 &&
          event.child_events.some((child) => child.event_type === "Change" || child.comment_present)
      )
      .sort((a, b) => a.id - b.id);
    if (eligible.length < 3) throw new Error("Require at least three candidate events");
    const samples = [
      eligible[0],
      eligible[Math.floor(eligible.length / 2)],
      eligible[eligible.length - 1],
    ];
    const { captureActionAuditEvidence } =
      await import("../src/lib/connectors/action-audit-evidence");
    const { zendeskGet } = await import("../src/lib/connectors/zendesk-shared");
    const stats = { requests: 0, retries429: 0, backoffWaitMs: 0 };
    const captures = [];
    for (const event of samples) {
      if (!event) throw new Error("Missing bounded sample");
      stage = "audit capture";
      const saved = await captureActionAuditEvidence(scope, event.id, (path) => {
        if (stats.requests >= 3) throw new Error("Audit sample request bound exceeded");
        return zendeskGet(path, stats, { deferRateLimit: true });
      });
      const replay = await captureActionAuditEvidence(scope, event.id, async () => {
        throw new Error("Retained evidence unexpectedly refetched");
      });
      if (replay.evidenceHash !== saved.evidenceHash) throw new Error("Replay evidence changed");
      captures.push({
        parentChannel: saved.audit.via?.channel ?? "missing",
        actorMatchesUpdater: saved.audit.actorMatchesUpdater,
        candidateChildren: saved.audit.children.length,
        childViaOverrides: saved.audit.children.filter((child) => child.hasViaOverride).length,
        ruleLinkedChildren: saved.audit.children.filter(
          (child) =>
            child.via?.channel === "rule" ||
            child.via?.relation === "automation" ||
            child.via?.relation === "trigger" ||
            child.via?.sourceType === "rule"
        ).length,
        historicalEligibility: saved.historicalEligibility,
        humanActivityAttribution: saved.humanActivityAttribution,
        replayWithoutFetch: true,
      });
    }
    const [factCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.normalizedFacts)
      .where(eq(schema.normalizedFacts.organizationId, organizationId));
    const [afterSource] = await db
      .select()
      .from(schema.dataSources)
      .where(eq(schema.dataSources.id, dataSourceId));
    if (!factCount || !afterSource) throw new Error("Missing rehearsal inventory");
    const facts = factCount.count;
    const report = {
      observedAt: new Date().toISOString(),
      day,
      inclusiveEndDay,
      mode: "Offline retained audit evidence; loopback writes and vendor GETs only",
      selection:
        "First, middle and last positive-actor candidate by event ID; not a representative attribution estimate",
      retainedTicketEvents: retained.cohort.events.length,
      candidateEvents: eligible.length,
      capturedAudits: captures.length,
      captures,
      requests: stats,
      normalizedFacts: facts,
      sourcePublicationTimestamp: afterSource.lastSuccessfulSyncAt,
      metricsPublished: false,
    };
    if (facts !== 0 || afterSource.lastSuccessfulSyncAt !== null)
      throw new Error("Unexpected rehearsal publication state");
    await writeFile(output, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    await client.end();
  }
}
main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      stage,
      schemaIssues:
        error instanceof z.ZodError
          ? error.issues.map((issue) => ({ path: issue.path, code: issue.code }))
          : undefined,
      mismatch:
        error instanceof Error &&
        (/^Audit does not match the retained event: (event|ticket|actor|timestamp|duplicate child)(, (event|ticket|actor|timestamp|duplicate child))*$/.test(
          error.message
        ) ||
          [
            "Audit child does not match retained activity",
            "Retained event does not match the observation",
            "Require owned bound rehearsal source",
            "Require complete account-bound retained export",
          ].includes(error.message))
          ? error.message
          : undefined,
    })
  );
  console.error("Audit evidence rehearsal failed; no IDs, payloads or credentials logged.");
  process.exitCode = 1;
});
