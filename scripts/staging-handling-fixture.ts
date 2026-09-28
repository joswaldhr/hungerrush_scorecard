/** Explicit isolated Preview fixture; never runs as part of the normal build. */
import assert from "node:assert/strict";
import postgres from "postgres";

async function main() {
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/audit-reliability-checkpoints");
  for (const key of [
    "ZENDESK_API_KEY",
    "ZENDESK_EMAIL",
    "ZENDESK_CSAT_POLICY",
    "ZENDESK_FIRST_REPLY_POLICY",
  ])
    assert(!process.env[key]);
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  url.search = "?sslmode=require";
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  try {
    await sql.begin(async (tx) => {
      const orgs = await tx`select id,name from organizations`;
      assert.equal(orgs.length, 1);
      assert.equal(orgs[0]!.name, "Synthetic staging rehearsal");
      const org = orgs[0]!.id;
      const staff = await tx`select id,display_name,primary_team_id from employees`;
      assert.equal(staff.length, 1);
      assert.equal(staff[0]!.display_name, "Synthetic employee");
      const employee = staff[0]!.id,
        team = staff[0]!.primary_team_id;
      assert(team);
      const sources = await tx`select id,type from data_sources`;
      assert(sources.length === 1 && sources[0]!.type === "staging");
      const definition = "f9280000-0928-4000-8000-000000000001";
      await tx`insert into metric_definitions (id,organization_id,key,name,category,unit,value_type,direction,source_strategy)
        values (${definition},${org},'avg_handle_time','Avg Handle Time (synthetic)','Staging handling','min','duration','lower_is_better','zendesk')
        on conflict (id) do nothing`;
      const [def] =
        await tx`select organization_id,key,source_strategy from metric_definitions where id=${definition}`;
      assert.deepEqual(def, {
        organization_id: org,
        key: "avg_handle_time",
        source_strategy: "zendesk",
      });
      await tx`insert into metric_assignments (metric_definition_id,team_id,display_order,is_primary,effective_from)
        select ${definition},${team},30,true,'2026-09-01' where not exists
        (select 1 from metric_assignments where metric_definition_id=${definition} and team_id=${team})`;
      await tx`insert into metric_targets (metric_definition_id,team_id,target_type,target_value,effective_from)
        select ${definition},${team},'maximum',12,'2026-09-01' where not exists
        (select 1 from metric_targets where metric_definition_id=${definition} and team_id=${team})`;
      for (const [start, end, value] of [
        ["2026-09-27", "2026-10-03", 0],
        ["2026-09-20", "2026-09-26", 137.8],
      ] as const) {
        await tx`insert into metric_values (metric_definition_id,employee_id,team_id,period_start,period_end,numeric_value,quality_status,calculation_version,data_freshness_at)
          values (${definition},${employee},${team},${start},${end},${value},'complete',999,'2026-09-28T18:00:00Z')
          on conflict (metric_definition_id,employee_id,period_start,period_end) do nothing`;
        const [saved] =
          await tx`select numeric_value,calculation_version from metric_values where metric_definition_id=${definition} and employee_id=${employee} and period_start=${start} and period_end=${end}`;
        assert.equal(saved!.numeric_value, value);
        assert.equal(saved!.calculation_version, 999);
      }
      const [current] =
        await tx`select id from metric_values where metric_definition_id=${definition} and period_start='2026-09-27' and employee_id=${employee}`;
      const run = "f9280000-0928-4000-8000-000000000002",
        revision = "f9280000-0928-4000-8000-000000000003";
      await tx`insert into sync_runs (id,data_source_id,status,metadata_json) values (${run},${sources[0]!.id},'completed','{"syntheticFixture":"handling-containment"}') on conflict (id) do nothing`;
      const [savedRun] =
        await tx`select data_source_id,metadata_json from sync_runs where id=${run}`;
      assert.equal(savedRun!.data_source_id, sources[0]!.id);
      assert.equal(savedRun!.metadata_json.syntheticFixture, "handling-containment");
      const snapshot = {
        employee_id: employee,
        metric_definition_id: definition,
        period_start: "2026-09-27",
        period_end: "2026-10-03",
        numeric_value: 60,
        quality_status: "complete",
        data_freshness_at: "2026-09-28T17:00:00Z",
        calculation_version: 999,
      };
      await tx`insert into sync_revisions (id,sync_run_id,entity_type,entity_id,snapshot_json) values (${revision},${run},'metric_value',${current!.id},${tx.json(snapshot)}) on conflict (id) do nothing`;
      const [savedRevision] =
        await tx`select sync_run_id,snapshot_json from sync_revisions where id=${revision}`;
      assert.equal(savedRevision!.sync_run_id, run);
      assert.deepEqual(savedRevision!.snapshot_json, snapshot);
    });
    console.log(
      JSON.stringify({
        syntheticOnly: true,
        definitions: 1,
        values: 2,
        revisions: 1,
        expected: "unavailable",
        productionAccess: false,
        vendorAccess: false,
      })
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error("Synthetic handling fixture failed; details withheld");
  process.exitCode = 1;
});
