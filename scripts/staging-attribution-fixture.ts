/** Synthetic-only hosted fixture for the approved human-attribution availability policy. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
let stage = "configuration";

async function main() {
  assert.equal(process.env.STAGING_RAILWAY_ENVIRONMENT_ID, "4e86528b-7329-4d73-a651-9f0fb3d07755");
  const url = new URL(process.env.STAGING_DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  assert(url.password);
  url.search = "?sslmode=require";
  const sql = postgres(url.toString(), { max: 1 });
  try {
    const report = await sql.begin(async (tx) => {
      stage = "synthetic_scope";
      const orgs = await tx`select id, name from organizations`;
      assert.equal(orgs.length, 1);
      assert.equal(orgs[0]!.name, "Synthetic staging rehearsal");
      const org = orgs[0]!.id;
      const sources = await tx`select type from data_sources`;
      assert(sources.length === 1 && sources[0]!.type === "staging");
      const staff = await tx`select id, display_name, primary_team_id from employees`;
      assert.equal(staff.length, 1);
      assert.equal(staff[0]!.display_name, "Synthetic employee");
      const employee = staff[0]!.id,
        team = staff[0]!.primary_team_id;
      assert(team);
      for (const [index, key] of ["tickets_updated", "tickets_resolved"].entries()) {
        stage = "definition";
        const name = index === 0 ? "Tickets Updated (synthetic)" : "Tickets Resolved (synthetic)";
        await tx`insert into metric_definitions (organization_id,key,name,category,unit,value_type,direction,source_strategy)
          values (${org},${key},${name},'Staging attribution','tickets','count','higher_is_better','zendesk')
          on conflict (organization_id,key,version) do nothing`;
        const [definition] =
          await tx`select id,name,source_strategy from metric_definitions where organization_id=${org} and key=${key} and version=1`;
        assert.equal(definition!.name, name);
        assert.equal(definition!.source_strategy, "zendesk");
        const definitionId = definition!.id;
        stage = "assignment";
        await tx`insert into metric_assignments (metric_definition_id,team_id,display_order,is_primary,effective_from)
          select ${definitionId},${team},${index + 2},true,'2026-09-01' where not exists
          (select 1 from metric_assignments where metric_definition_id=${definitionId} and team_id=${team})`;
        for (const [start, end, value] of [
          ["2026-09-20", "2026-09-26", index ? 42 : 0],
          ["2026-09-13", "2026-09-19", 17],
        ] as const) {
          stage = "value";
          await tx`insert into metric_values (metric_definition_id,employee_id,team_id,period_start,period_end,numeric_value,quality_status,calculation_version,data_freshness_at)
            values (${definitionId},${employee},${team},${start},${end},${value},'complete',1,'2026-09-24T17:00:00Z')
            on conflict (metric_definition_id,employee_id,period_start,period_end) do nothing`;
          const [stored] =
            await tx`select numeric_value,quality_status from metric_values where metric_definition_id=${definitionId} and employee_id=${employee} and period_start=${start} and period_end=${end}`;
          assert.equal(stored!.numeric_value, value);
          assert.equal(stored!.quality_status, "complete");
        }
      }
      return {
        verifiedAt: new Date().toISOString(),
        syntheticOnly: true,
        definitions: 2,
        storedValues: [0, 42, 17, 17],
        expectedManagerValues: "unavailable: human attribution unverified",
        productionAccess: false,
      };
    });
    if (process.argv[2]) await writeFile(process.argv[2], JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch((error: unknown) => {
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : "unknown";
  console.error(
    JSON.stringify({ status: "failed", stage, code: /^[A-Z0-9_]+$/.test(code) ? code : "unknown" })
  );
  process.exitCode = 1;
});
