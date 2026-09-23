/** Extend only the approved synthetic hosted rehearsal for Preview UI validation. */
import assert from "node:assert/strict";
import postgres from "postgres";

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
    await sql.begin(async (tx) => {
      const orgs = await tx`select id, name from organizations`;
      assert.equal(orgs.length, 1);
      assert.equal(orgs[0]!.name, "Synthetic staging rehearsal");
      const org = orgs[0]!.id;
      const sources = await tx`select type from data_sources`;
      assert(sources.length === 1 && sources[0]!.type === "staging");
      const staff = await tx`select id, display_name from employees`;
      assert.equal(staff.length, 1);
      assert.equal(staff[0]!.display_name, "Synthetic employee");
      const employee = staff[0]!.id;
      assert.equal(
        (await tx`select id from users`).length,
        0,
        "Fixture already mapped; inspect rather than resetting"
      );
      const [team] =
        await tx`insert into teams (organization_id,name,slug) values (${org},'Synthetic staging team','synthetic-staging') returning id`;
      const [user] =
        await tx`insert into users (organization_id,email,display_name) values (${org},'james.oswald@hungerrush.com','Staging manager') returning id`;
      await tx`update employees set primary_team_id=${team!.id} where id=${employee}`;
      await tx`insert into team_memberships (employee_id,team_id,effective_from) values (${employee},${team!.id},'2026-09-01')`;
      await tx`insert into manager_assignments (manager_user_id,team_id,assignment_type,effective_from) values (${user!.id},${team!.id},'team','2026-09-01')`;
      const [zero] =
        await tx`select id from metric_definitions where organization_id=${org} and key='stage_metric'`;
      assert(zero);
      const [missing] =
        await tx`insert into metric_definitions (organization_id,key,name,category,unit,source_strategy) values (${org},'stage_missing','Synthetic missing value','Staging','count','staging') returning id`;
      await tx`insert into metric_assignments (metric_definition_id,team_id,display_order,is_primary,effective_from) values (${zero.id},${team!.id},0,true,'2026-09-01'),(${missing!.id},${team!.id},1,true,'2026-09-01')`;
      await tx`insert into metric_values (metric_definition_id,employee_id,period_start,period_end,numeric_value,quality_status) values (${zero.id},${employee},'2026-09-13','2026-09-19',0,'valid'),(${missing!.id},${employee},'2026-09-13','2026-09-19',null,'missing'),(${missing!.id},${employee},'2026-09-20','2026-09-26',null,'missing')`;
      console.log(
        JSON.stringify({
          syntheticEmployeeId: employee,
          managerMapped: true,
          platformAdmin: false,
          periods: ["2026-09-13", "2026-09-20"],
        })
      );
    });
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Preview fixture failed");
  process.exitCode = 1;
});
