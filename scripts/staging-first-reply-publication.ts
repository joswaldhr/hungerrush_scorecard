/** Synthetic-only publication rehearsal; never loads .env or requests vendor data. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import type { Connector, IngestedRecord } from "../src/lib/connectors/types";
import type { fetchFirstReplyCandidate } from "../src/lib/connectors/zendesk-first-reply";

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
    "ZENDESK_FIRST_REPLY_POLICY",
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
    stage = "fixture_definition";
    await sql.begin(async (tx) => {
      await tx`insert into metric_definitions (organization_id,key,name,category,unit,value_type,source_strategy,calculation_type)
        values (${org},'avg_response_time','Avg Response Time (synthetic)','Staging duration','min','duration','staging','average')
        on conflict (organization_id,key,version) do nothing`;
      const [d] =
        await tx`select id,source_strategy,unit,value_type,calculation_type from metric_definitions where organization_id=${org} and key='avg_response_time' and version=1`;
      assert.equal(d!.source_strategy, "staging");
      assert.equal(d!.unit, "min");
      assert.equal(d!.value_type, "duration");
      assert.equal(d!.calculation_type, "average");
      await tx`insert into metric_assignments (metric_definition_id,team_id,display_order,is_primary,effective_from)
        select ${d!.id},${team},22,true,'2026-09-01' where not exists
        (select 1 from metric_assignments where metric_definition_id=${d!.id} and team_id=${team})`;
    });
    const { ZendeskConnector } = await import("../src/lib/connectors/zendesk");
    const { buildFirstReplyRecord } =
      await import("../src/lib/connectors/zendesk-first-reply-record");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const normalizer = new ZendeskConnector();
    const publish = (record: IngestedRecord) => {
      const connector: Connector = {
        sourceType: "staging",
        healthCheck: async () => ({ connected: true, message: "Synthetic", lastSyncAt: null }),
        fetchRecords: async () => ({ records: [record], cursor: null, hasMore: false }),
        normalizeRecords: (...args) =>
          normalizer.normalizeRecords(...args).filter((f) => f.factType === "avg_response_time"),
        resolveIdentities: async () => {
          throw new Error("Synthetic identity must already exist");
        },
        discoverRoster: async () => [],
      };
      return runSync(connector, { organizationId: org, dataSourceId: source });
    };
    const snapshot: Awaited<ReturnType<typeof fetchFirstReplyCandidate>> = {
      tickets: [1, 2, 3, 4].map((id) => ({
        id,
        assignee_id: 7,
        group_id: 20,
        created_at: "2026-09-21T12:00:00Z",
      })),
      metrics: [0, 1, 1, null].map((business, i) => ({
        ticket_id: i + 1,
        reply_time_in_minutes: { business, calendar: business },
      })),
      coverage: {
        complete: true,
        population: "all-created-tickets",
        requests: 0,
        query: "synthetic-local-replay",
        observationStartedAt: new Date().toISOString(),
        observationEndedAt: new Date().toISOString(),
        timeZone: "America/Chicago",
        periodStart: "2026-09-20",
        periodEnd: "2026-09-26",
        groupIds: [20],
        brandIds: null,
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
    const candidate = buildFirstReplyRecord(snapshot, identity);
    const read = async () => {
      const [row] =
        await sql`select v.* from metric_values v join metric_definitions d on d.id=v.metric_definition_id where v.employee_id=${employee} and v.period_start='2026-09-20' and v.period_end='2026-09-26' and d.key='avg_response_time'`;
      return row;
    };
    const siblings = () =>
      sql`select v.* from metric_values v join metric_definitions d on d.id=v.metric_definition_id where v.employee_id=${employee} and d.key<>'avg_response_time' order by v.id`;
    const before = await siblings();
    stage = "legacy_baseline";
    const legacy = {
      ...candidate,
      externalRecordType: "agent_stats",
      externalRecordId: "first-reply-rehearsal-legacy-" + candidate.periodStart,
      payload: { ticketsResolved: 0, avgResponseTimeMinutes: 999 },
    };
    assert((await publish(legacy)).success);
    assert.equal((await read())!.numeric_value, 999);
    stage = "candidate_publication";
    assert.equal((await publish(candidate)).valuesWritten, 1);
    const stored = await read();
    assert.equal(stored!.numeric_value, 2 / 3);
    assert.equal(stored!.calculation_version, 2);
    assert.equal(stored!.provenance_json.sampleCount, 3);
    assert.equal(stored!.provenance_json.cohortCount, 4);
    assert.equal(stored!.provenance_json.supersededFactIds.length, 1);
    assert.deepEqual(await siblings(), before);
    stage = "idempotence";
    assert.equal((await publish(candidate)).valuesWritten, 0);
    stage = "null_correction";
    const empty = structuredClone(snapshot);
    empty.metrics.forEach((m) => {
      m.reply_time_in_minutes = null;
    });
    assert.equal((await publish(buildFirstReplyRecord(empty, identity))).valuesWritten, 1);
    assert.equal((await read())!.numeric_value, null);
    stage = "final_fixture";
    snapshot.coverage.observationStartedAt = new Date().toISOString();
    snapshot.coverage.observationEndedAt = new Date().toISOString();
    assert.equal((await publish(buildFirstReplyRecord(snapshot, identity))).valuesWritten, 1);
    assert.equal((await read())!.numeric_value, 2 / 3);
    const revisions =
      await sql`select snapshot_json->>'numeric_value' as value from sync_revisions where entity_id=${stored!.id}`;
    assert(revisions.some((r) => r.value === "999"));
    assert(revisions.some((r) => r.value === null));
    assert.deepEqual(await siblings(), before);
    const report = {
      observedAt: new Date().toISOString(),
      environment: "hosted-synthetic-staging",
      vendorRequests: 0,
      productionAccess: false,
      values: 1,
      meanBusinessMinutes: 2 / 3,
      expectedDisplay: "0:00:40",
      sampleCount: 3,
      cohortCount: 4,
      unrelatedValuesUnchanged: true,
      legacyFactRetained: true,
      legacyRevisionPreserved: true,
      identicalReplayWrites: 0,
      nullCorrection: true,
      finalFixtureRestored: true,
      hostedUiAndExportVerified: false,
    };
    await writeFile(
      "docs/audits/2026-09-25-first-reply-hosted-publication.json",
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
  console.error(`Synthetic first-reply rehearsal failed at ${stage}; no private values logged`);
  process.exitCode = 1;
});
