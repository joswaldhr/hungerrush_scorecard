/** Explicit, disposable synthetic UI rehearsal on the isolated main Preview only. */
import assert from "node:assert/strict";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import * as schema from "../src/lib/db/schema";

async function main() {
  const mode = process.argv[2];
  assert(mode === "--setup" || mode === "--cleanup");
  await import("./assert-main-preview.mjs");
  const connection = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  globalThis.fetch = async () => {
    throw Error("Network requests forbidden in synthetic rehearsal");
  };
  (globalThis as unknown as { _cadenceDb: unknown })._cadenceDb = drizzle(connection, { schema });
  const source = "60000000-0000-4000-8000-000000000050";
  const first = "60000000-0000-4000-8000-000000000051",
    second = "60000000-0000-4000-8000-000000000052";
  const ids = [
    "60000000-0000-4000-8000-000000000053",
    "60000000-0000-4000-8000-000000000054",
    "60000000-0000-4000-8000-000000000055",
  ];
  try {
    const orgs =
      await connection`select id from organizations where name='Synthetic staging rehearsal'`;
    assert.equal(orgs.length, 1);
    const org = orgs[0]!.id;
    const reviewers =
      await connection`select id,is_platform_admin from users where organization_id=${org} and email='james.oswald@hungerrush.com'`;
    assert.equal(reviewers.length, 1);
    if (mode === "--setup") {
      assert.equal(reviewers[0]!.is_platform_admin, false, "Do not overwrite existing admin state");
      assert.equal(
        (await connection`select id from data_sources where id=${source}`).length,
        0,
        "Fixture already exists; inspect before resetting"
      );
      await migrate(drizzle(connection), { migrationsFolder: "drizzle" });
      await connection.begin(async (tx) => {
        await tx`insert into data_sources(id,organization_id,type,display_name,configuration_reference) values(${source},${org},'zendesk','Synthetic lifecycle rehearsal','zendesk-account:synthetic-lifecycle')`;
        for (const [i, id] of [first, second].entries())
          await tx`insert into teams(id,organization_id,name,slug) values(${id},${org},${i === 0 ? "Synthetic lifecycle original" : "Synthetic lifecycle destination"},${id})`;
        for (const [i, team] of [first, second].entries())
          await tx`insert into roster_source_team_mappings(data_source_id,team_id,external_group_id,external_group_label) values(${source},${team},${String(i + 1)},'Synthetic group')`;
        for (const [i, id] of ids.entries()) {
          const name = ["Synthetic transfer", "Synthetic return", "Synthetic departure"][i]!;
          const email = `lifecycle-${i}@example.invalid`;
          await tx`insert into employees(id,organization_id,display_name,email,primary_team_id,employment_status) values(${id},${org},${name},${email},${first},${i === 1 ? "inactive" : "active"})`;
          await tx`insert into external_identities(employee_id,data_source_id,external_entity_type,external_id,match_method) values(${id},${source},'agent',${email},'synthetic')`;
          await tx`insert into team_memberships(employee_id,team_id,effective_from,effective_to) values(${id},${first},'2026-01-01',${i === 1 ? "2026-09-01" : null})`;
        }
      });
      const { discoverRosterCandidates } = await import("../src/lib/domain/roster/reconcile");
      await discoverRosterCandidates(
        {
          discoverRoster: async () => [
            {
              externalId: "lifecycle-0@example.invalid",
              externalEmail: "lifecycle-0@example.invalid",
              externalDisplayName: "Synthetic transfer",
              teamId: second,
            },
            {
              externalId: "lifecycle-1@example.invalid",
              externalEmail: "lifecycle-1@example.invalid",
              externalDisplayName: "Synthetic return",
              teamId: first,
            },
          ],
        } as unknown as import("../src/lib/connectors/types").Connector,
        source,
        { reviewOnly: true }
      );
      // Only this existing synthetic staging login; restore immediately after UI checks.
      await connection`update users set is_platform_admin=true where id=${reviewers[0]!.id} and organization_id=${org}`;
      console.log(
        JSON.stringify({
          syntheticFixtureReady: true,
          proposals: 3,
          temporaryStagingAdmin: true,
          vendorRequests: 0,
        })
      );
    } else {
      const owned =
        await connection`select organization_id,display_name from data_sources where id=${source}`;
      assert.equal(owned.length, 1);
      assert.equal(owned[0]!.organization_id, org);
      assert.equal(owned[0]!.display_name, "Synthetic lifecycle rehearsal");
      const results =
        await connection`select change_type,status from roster_candidates where data_source_id=${source} order by change_type`;
      console.log(JSON.stringify({ syntheticReviewResults: results }));
      await connection.begin(async (tx) => {
        await tx`update users set is_platform_admin=false where id=${reviewers[0]!.id} and organization_id=${org}`;
        await tx`delete from roster_candidates where data_source_id=${source}`;
        await tx`delete from roster_observations where data_source_id=${source}`;
        await tx`delete from external_identities where data_source_id=${source}`;
        await tx`delete from team_memberships where employee_id=any(${ids}::uuid[])`;
        await tx`delete from employees where id=any(${ids}::uuid[]) and organization_id=${org}`;
        await tx`delete from roster_source_team_mappings where data_source_id=${source}`;
        await tx`delete from data_sources where id=${source} and organization_id=${org}`;
        await tx`delete from teams where id=any(${[first, second]}::uuid[]) and organization_id=${org}`;
      });
      console.log(
        JSON.stringify({
          syntheticFixtureRemoved: true,
          temporaryStagingAdmin: false,
          vendorRequests: 0,
        })
      );
    }
  } finally {
    await connection.end();
  }
}
main().catch(() => {
  console.error(
    "Synthetic lifecycle rehearsal failed; inspect private staging state before retrying."
  );
  process.exitCode = 1;
});
