/** Synthetic records only. Runs local candidate code against the isolated hosted staging DB. */
import assert from "node:assert/strict";
import { access, writeFile } from "node:fs/promises";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import type { Connector, IngestedRecord } from "../src/lib/connectors/types";

let stage = "configuration";
async function main() {
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/audit-reliability-checkpoints");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  assert(url.password);
  url.search = "?sslmode=require";
  process.env.DATABASE_URL = url.toString();
  process.env.AUTH_SECRET = "synthetic-local-rehearsal-not-a-hosted-sign-in-secret";
  for (const key of [
    "ZENDESK_EMAIL",
    "ZENDESK_API_KEY",
    "ZENDESK_CSAT_POLICY",
    "ZENDESK_FIRST_REPLY_POLICY",
    "ZENDESK_TALK_COLLECTION_POLICY",
    "ZENDESK_OUTBOUND_POLICY",
    "ASSEMBLED_API_KEY",
  ])
    assert(!process.env[key], "No vendor credentials or active policy in synthetic rehearsal");
  const reportPath = "docs/audits/2026-09-26-outbound-hosted-publication.json";
  await access(reportPath).then(
    () => {
      throw Error("Inspect existing rehearsal before rerunning");
    },
    () => {}
  );
  // Defense in depth: this process has no reason to make HTTP requests.
  globalThis.fetch = async () => {
    throw Error("Network fetch forbidden in synthetic rehearsal");
  };
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
    const { outboundObservationFixture } =
      await import("../src/__tests__/fixtures/outbound-observation");
    const { buildOutboundRecord } = await import("../src/lib/connectors/zendesk-outbound-record");
    const { outboundTalkKeys } = await import("../src/lib/connectors/zendesk-talk-policy");
    const { ZendeskConnector } = await import("../src/lib/connectors/zendesk");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const f = outboundObservationFixture(
      { organizationId: org, dataSourceId: source },
      employee,
      team
    );
    f.identity.externalId = identities[0]!.external_id;
    // Synthetic observation times are explicit fixture data, never live source freshness.
    const replacement = () =>
      buildOutboundRecord(
        f.snapshot,
        f.tickets,
        f.policy,
        f.config,
        f.identity,
        f.periodStart,
        f.periodEnd,
        f.now
      );
    const normalizer = new ZendeskConnector();
    const publish = (records: IngestedRecord[]) => {
      const connector: Connector = {
        sourceType: "staging",
        healthCheck: async () => ({ connected: true, message: "Synthetic", lastSyncAt: null }),
        fetchRecords: async () => ({ records, cursor: null, hasMore: false }),
        normalizeRecords: (...args) =>
          normalizer
            .normalizeRecords(...args)
            .filter((fact) => outboundTalkKeys.some((key) => key === fact.factType)),
        resolveIdentities: async () => {
          throw Error("Synthetic identity must already exist");
        },
        discoverRoster: async () => [],
      };
      return runSync(connector, f.config);
    };
    stage = "fixture_definitions";
    await sql.begin(async (tx) => {
      for (const [index, key] of outboundTalkKeys.entries()) {
        const duration = key.startsWith("avg_");
        const name = key.replaceAll("_", " ") + " (synthetic)";
        await tx`insert into metric_definitions (organization_id,key,name,category,unit,value_type,source_strategy,calculation_type)
          values (${org},${key},${name},'Staging outbound',${duration ? "s" : "calls"},${duration ? "duration" : "count"},'staging',${duration ? "average" : "sum"})
          on conflict (organization_id,key,version) do nothing`;
        const [d] =
          await tx`select id,source_strategy,unit,value_type,calculation_type from metric_definitions where organization_id=${org} and key=${key} and version=1`;
        assert.equal(d!.source_strategy, "staging");
        assert.equal(d!.unit, duration ? "s" : "calls");
        assert.equal(d!.value_type, duration ? "duration" : "count");
        assert.equal(d!.calculation_type, duration ? "average" : "sum");
        await tx`insert into metric_assignments (metric_definition_id,team_id,display_order,is_primary,effective_from)
          select ${d!.id},${team},${30 + index},true,'2026-09-01' where not exists
          (select 1 from metric_assignments where metric_definition_id=${d!.id} and team_id=${team})`;
      }
    });
    const read =
      () => sql`select d.key,v.* from metric_values v join metric_definitions d on d.id=v.metric_definition_id
      where v.employee_id=${employee} and v.period_start='2026-09-20' and v.period_end='2026-09-26' and d.key=any(${[...outboundTalkKeys]}) order by d.key`;
    const unaffected =
      () => sql`select v.* from metric_values v join metric_definitions d on d.id=v.metric_definition_id
      where not (v.employee_id=${employee} and v.period_start='2026-09-20' and v.period_end='2026-09-26' and d.key=any(${[...outboundTalkKeys]})) order by v.id`;
    const baseline = await unaffected();
    const record = replacement();
    const legacy: IngestedRecord = {
      ...record,
      externalRecordType: "agent_stats",
      externalRecordId: "outbound-rehearsal-legacy-2026-09-20",
      payload: {
        outboundTotal: 99,
        outboundCompleted: 98,
        outboundNonAnswered: 1,
        avgTalkTimeOutbound: 120,
        avgHoldTimeOutbound: 120,
      },
    };
    stage = "legacy_baseline";
    assert((await publish([legacy])).success);
    assert.equal((await read()).find((r) => r.key === "outbound_calls")!.numeric_value, 99);
    stage = "candidate_publication";
    const result = await publish([record]);
    assert(result.success);
    assert.equal(result.valuesWritten, 5);
    const stored = await read();
    const expected: Record<string, number | null> = {
      outbound_calls: 2,
      outbound_calls_completed: 1,
      outbound_calls_non_answered: 1,
      avg_talk_time_outbound: 2 / 3,
      avg_hold_time_outbound: null,
    };
    assert.equal(stored.length, 5);
    for (const row of stored) {
      assert.equal(row.numeric_value, expected[row.key]);
      assert.equal(row.calculation_version, 2);
    }
    const talk = stored.find((r) => r.key === "avg_talk_time_outbound")!;
    assert.equal(talk.provenance_json.sampleCount, 3);
    assert.equal(talk.provenance_json.cohortCount, 3);
    assert.deepEqual(await unaffected(), baseline);
    stage = "idempotence";
    assert.equal((await publish([record])).valuesWritten, 0);
    stage = "null_correction";
    const original = structuredClone(f.snapshot.legs);
    f.snapshot.legs.forEach((leg) => {
      leg.talk_time = null;
    });
    assert((await publish([replacement()])).success);
    assert.equal(
      (await read()).find((r) => r.key === "avg_talk_time_outbound")!.numeric_value,
      null
    );
    stage = "final_fixture";
    f.snapshot.legs = original;
    assert((await publish([replacement()])).success);
    assert.equal(
      (await read()).find((r) => r.key === "avg_talk_time_outbound")!.numeric_value,
      2 / 3
    );
    const revisions =
      await sql`select snapshot_json->>'numeric_value' as value from sync_revisions where entity_id=${talk.id}`;
    assert(revisions.some((r) => r.value === "120"));
    assert(revisions.some((r) => r.value === null));
    assert.deepEqual(await unaffected(), baseline);
    const report = {
      observedAt: new Date().toISOString(),
      environment: "local-candidate-against-hosted-synthetic-staging",
      vendorRequests: 0,
      productionAccess: false,
      values: 5,
      expected,
      sampleCount: 3,
      cohortCount: 3,
      unrelatedAndEarlierValuesUnchanged: true,
      legacyRevisionPreserved: true,
      nullCorrection: true,
      identicalReplayWrites: 0,
      finalFixtureRestored: true,
      hostedUiAndExportVerified: false,
      realSourceCollectionAndRouteInvocationVerified: false,
    };
    await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
    delete globalDb._cadenceDb;
  }
}
main().catch(() => {
  console.error(`Synthetic outbound rehearsal failed at ${stage}; no private values logged`);
  process.exitCode = 1;
});
