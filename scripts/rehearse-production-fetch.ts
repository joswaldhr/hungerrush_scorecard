/** Candidate current-week fetch only. No sync run, normalization or publication. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";

async function main() {
  const output = path.resolve(process.argv[2] ?? "");
  assert.equal(path.dirname(output), path.resolve("docs/audits"));
  assert(output.endsWith(".json"));
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "metro.proxy.rlwy.net");
  assert.equal(url.port, "57223");
  assert.equal(url.pathname, "/railway");
  assert(process.env.ZENDESK_SUBDOMAIN);
  const origin = new URL(`https://${process.env.ZENDESK_SUBDOMAIN}.zendesk.com`).origin;
  const client = postgres(url.toString(), {
    max: 1,
    ssl: "require",
    connection: { default_transaction_read_only: true, statement_timeout: 15_000 },
  });
  const originalFetch = globalThis.fetch;
  const started = Date.now();
  const budgetMs = 240_000;
  const stop = new AbortController();
  const budget = AbortSignal.timeout(budgetMs);
  const deadline = AbortSignal.any([budget, stop.signal]);
  let requests = 0;
  let rateLimits = 0;
  let completed = false;
  let recordCount = 0;
  let identityCount: number | null = null;
  let failure: string | null = null;
  try {
    const sources = await client`select id, organization_id from data_sources
      where type = 'zendesk' and status = 'configured'`;
    assert.equal(sources.length, 1, "Require an unambiguous configured source");
    const [readOnly] = await client`show default_transaction_read_only`;
    assert.equal(readOnly!.default_transaction_read_only, "on");
    const database = drizzle(client, { schema });
    (globalThis as unknown as { _cadenceDb: typeof database })._cadenceDb = database;
    globalThis.fetch = async (input, init) => {
      const target = new URL(input instanceof Request ? input.url : input.toString());
      assert.equal(target.origin, origin);
      assert.equal(init?.method ?? (input instanceof Request ? input.method : "GET"), "GET");
      assert(target.pathname.startsWith("/api/v2/"));
      assert(++requests <= 500, "Read-only request budget exceeded");
      deadline.throwIfAborted();
      const response = await originalFetch(input, {
        ...init,
        signal: init?.signal ? AbortSignal.any([init.signal, deadline]) : deadline,
        redirect: "error",
      });
      if (response.status === 429) rateLimits++;
      return response;
    };
    const { ZendeskConnector } = await import("../src/lib/connectors/zendesk");
    const source = sources[0]!;
    const scope = {
      dataSourceId: source.id as string,
      organizationId: source.organization_id as string,
    };
    const result = await new ZendeskConnector().fetchRecords(scope, {
      ...scope,
      // The connector does not persist or use this diagnostic ID.
      syncRunId: "00000000-0000-4000-8000-000000000000",
      cursor: "0",
    });
    completed = true;
    recordCount = result.records.length;
    identityCount =
      typeof result.diagnostics?.identityCount === "number"
        ? result.diagnostics.identityCount
        : null;
  } catch {
    // Driver/vendor errors may contain source details. Only the classified outcome leaves memory.
    failure = budget.aborted ? "fetch_budget_exceeded" : "fetch_or_preflight_failed";
    process.exitCode = 1;
  } finally {
    // This is a standalone process. Leave the guarded wrapper installed so sibling requests
    // from a rejected concurrency batch cannot escape the budget while cleanup is running.
    stop.abort();
    await client.end();
  }
  const report = {
    observedAt: new Date().toISOString(),
    scope: "Candidate current-week fetch only, production read-only database and vendor GETs",
    databaseWrites: 0,
    weekOffset: 0,
    completed,
    elapsedMs: Date.now() - started,
    fetchBudgetMs: budgetMs,
    requests,
    rateLimits,
    recordCount,
    identityCount,
    failure,
    limitations:
      "One current-week local-process timing sample; excludes publication and hosted latency. Does not certify source semantics or worst-case execution time.",
  };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  console.log(JSON.stringify(report));
}

main().then(
  () => process.exit(process.exitCode ?? 0),
  () => {
    console.error("Read-only fetch rehearsal failed; no credentials or row values logged.");
    process.exit(1);
  }
);
