/** Synthetic-only publication rehearsal; never loads .env or requests vendor data. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import type { Connector, IngestedRecord } from "../src/lib/connectors/types";
import type { fetchSolvedCsatCandidate } from "../src/lib/connectors/zendesk-solved-csat";

let stage = "configuration";
async function main() {
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/audit-reliability-checkpoints");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  url.search = "?sslmode=require";
  process.env.DATABASE_URL = url.toString();
  process.env.AUTH_SECRET = "synthetic-local-rehearsal-not-a-hosted-sign-in-secret";
  for (const key of [
    "ZENDESK_EMAIL",
    "ZENDESK_API_KEY",
    "ZENDESK_CSAT_POLICY",
    "ASSEMBLED_API_KEY",
  ])
    assert(!process.env[key], "Vendor credentials must not be supplied to synthetic rehearsal");
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const globalDb = globalThis as unknown as {
    _cadenceDb?: ReturnType<typeof drizzle<typeof schema>>;
  };
  globalDb._cadenceDb = drizzle(sql, { schema });
  try {
    stage = "synthetic_scope";
    const orgs =
      await sql`select id,name from organizations where name='Synthetic staging rehearsal'`;
    assert.equal(orgs.length, 1);
    assert.equal(orgs[0]!.name, "Synthetic staging rehearsal");
    const org = orgs[0]!.id;
    const staff =
      await sql`select id,display_name,primary_team_id from employees where organization_id=${org}`;
    assert.equal(staff.length, 1);
    assert.equal(staff[0]!.display_name, "Synthetic employee");
    const employee = staff[0]!.id,
      team = staff[0]!.primary_team_id;
    assert(team);
    const sources = await sql`select id,type,status from data_sources where organization_id=${org}`;
    assert.equal(sources.length, 1);
    assert.equal(sources[0]!.type, "staging");
    assert.equal(sources[0]!.status, "configured");
    const source = sources[0]!.id;
    assert.equal((await sql`select id from sync_runs where status='running'`).length, 0);
    const identities =
      await sql`select external_id from external_identities where data_source_id=${source} and employee_id=${employee}`;
    assert.equal(identities.length, 1);
    const externalId = identities[0]!.external_id;
    stage = "fixture_definitions";
    await sql.begin(async (tx) => {
      for (const [index, key] of ["csat_score", "csat_response_rate"].entries()) {
        const name = index ? "CSAT Response Rate (synthetic)" : "CSAT Score (synthetic)";
        await tx`insert into metric_definitions (organization_id,key,name,category,unit,value_type,source_strategy,calculation_type)
          values (${org},${key},${name},'Staging CSAT','%','percentage','staging','latest')
          on conflict (organization_id,key,version) do nothing`;
        const [definition] =
          await tx`select id,name,source_strategy from metric_definitions where organization_id=${org} and key=${key} and version=1`;
        assert.equal(definition!.name, name);
        assert.equal(definition!.source_strategy, "staging");
        await tx`insert into metric_assignments (metric_definition_id,team_id,display_order,is_primary,effective_from)
          select ${definition!.id},${team},${index + 20},true,'2026-09-01' where not exists
          (select 1 from metric_assignments where metric_definition_id=${definition!.id} and team_id=${team})`;
      }
    });
    const { ZendeskConnector } = await import("../src/lib/connectors/zendesk");
    const { buildSolvedCsatRecord } =
      await import("../src/lib/connectors/zendesk-solved-csat-record");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const normalizer = new ZendeskConnector();
    const publish = (record: IngestedRecord) => {
      const connector: Connector = {
        sourceType: "staging",
        healthCheck: async () => ({ connected: true, message: "Synthetic", lastSyncAt: null }),
        fetchRecords: async () => ({ records: [record], cursor: null, hasMore: false }),
        normalizeRecords: normalizer.normalizeRecords.bind(normalizer),
        resolveIdentities: async () => {
          throw new Error("Synthetic identity must already exist");
        },
        discoverRoster: async () => [],
      };
      return runSync(connector, { organizationId: org, dataSourceId: source });
    };
    const snapshot: Awaited<ReturnType<typeof fetchSolvedCsatCandidate>> = {
      tickets: (["good", "bad", "bad", "offered"] as const).map((score, i) => ({
        id: i + 1,
        assignee_id: 7,
        group_id: 20,
        brand_id: 30,
        satisfaction_rating: { score },
      })),
      metrics: [1, 2, 3, 4].map((ticket_id) => ({ ticket_id, solved_at: "2026-09-22T12:00:00Z" })),
      coverage: {
        complete: true,
        population: "all-solved-satisfaction-states",
        requests: 0,
        query: "synthetic-local-replay",
        observationStartedAt: new Date().toISOString(),
        observationEndedAt: new Date().toISOString(),
        timeZone: "America/Chicago",
        periodStart: "2026-09-20",
        periodEnd: "2026-09-26",
        groupIds: [20],
        brandIds: [30],
        agentIds: [7],
      },
    };
    const identity = {
      agentId: 7,
      externalId,
      accountReference: "zendesk-account:synthetic",
      subdomain: "synthetic",
      employeeContext: { employeeId: employee, teamId: team },
    };
    const candidate = buildSolvedCsatRecord(snapshot, identity);
    const read = () =>
      sql`select d.key,v.numeric_value,v.calculation_version,v.provenance_json,v.id from metric_values v join metric_definitions d on d.id=v.metric_definition_id where v.employee_id=${employee} and v.period_start='2026-09-20' and v.period_end='2026-09-26' and d.key in ('csat_score','csat_response_rate') order by d.key`;
    stage = "legacy_baseline";
    assert(
      (
        await publish({
          ...candidate,
          payload: { csatScore: 99, csatResponseRate: 98 },
          sourceUpdatedAt: new Date(Date.now() - 1000),
        })
      ).success
    );
    stage = "candidate_publication";
    assert.equal((await publish(candidate)).valuesWritten, 2);
    const stored = await read();
    assert.equal(stored.find((r) => r.key === "csat_score")!.numeric_value, 100 / 3);
    assert.equal(stored.find((r) => r.key === "csat_response_rate")!.numeric_value, 75);
    assert(
      stored.every(
        (r) =>
          r.calculation_version === 2 && r.provenance_json.reportingTimeZone === "America/Chicago"
      )
    );
    const scoreId = stored.find((r) => r.key === "csat_score")!.id;
    const retained =
      await sql`select count(*)::int as count from sync_revisions where entity_id=${scoreId} and snapshot_json->>'numeric_value'='99'`;
    assert(retained[0]!.count > 0);
    stage = "idempotence";
    assert.equal((await publish(candidate)).valuesWritten, 0);
    stage = "null_correction";
    const empty = {
      ...snapshot,
      tickets: [],
      metrics: [],
      coverage: {
        ...snapshot.coverage,
        observationStartedAt: new Date().toISOString(),
        observationEndedAt: new Date().toISOString(),
      },
    };
    assert.equal((await publish(buildSolvedCsatRecord(empty, identity))).valuesWritten, 2);
    assert((await read()).every((r) => r.numeric_value === null));
    stage = "final_screen_fixture";
    snapshot.coverage.observationStartedAt = new Date().toISOString();
    snapshot.coverage.observationEndedAt = new Date().toISOString();
    assert.equal((await publish(buildSolvedCsatRecord(snapshot, identity))).valuesWritten, 2);
    assert.equal((await read()).find((r) => r.key === "csat_score")!.numeric_value, 100 / 3);
    const report = {
      observedAt: new Date().toISOString(),
      environment: "hosted-synthetic-staging",
      vendorRequests: 0,
      productionAccess: false,
      values: 2,
      score: 100 / 3,
      responseRate: 75,
      legacyRevisionPreserved: true,
      identicalReplayWrites: 0,
      nullCorrection: true,
      finalFixtureRestored: true,
      hostedUiAndExportVerified: false,
    };
    await writeFile(
      "docs/audits/2026-09-25-csat-hosted-publication.json",
      JSON.stringify(report, null, 2) + "\n",
      { flag: "wx" }
    );
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
    delete globalDb._cadenceDb;
  }
}
main().catch(() => {
  console.error(`Synthetic CSAT rehearsal failed at ${stage}; no private values logged`);
  process.exitCode = 1;
});
