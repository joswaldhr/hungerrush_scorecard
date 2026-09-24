/** Guarded hosted observation namespace; never creates employees, facts or metric values. */
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import postgres from "postgres";
import { zendeskAccountReference } from "../src/lib/connectors/zendesk-account-binding";

const organizationId = "f24ea900-0924-4000-8000-000000000001";
const sourceId = "f24ea900-0924-4000-8000-000000000002";
let stage = "configuration";
async function main() {
  const [mode, output] = process.argv.slice(2);
  assert(mode && ["provision", "report", "disable"].includes(mode) && output);
  assert.equal(process.env.STAGING_RAILWAY_ENVIRONMENT_ID, "4e86528b-7329-4d73-a651-9f0fb3d07755");
  const url = new URL(process.env.STAGING_DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  assert(url.password);
  url.search = "?sslmode=require";
  const reference = zendeskAccountReference(process.env.STAGING_ZENDESK_SUBDOMAIN ?? "");
  const sql = postgres(url.toString(), { max: 1, connect_timeout: 15 });
  try {
    const report = await sql.begin(async (tx) => {
      stage = "isolated_organization";
      const orgs = await tx`select id,name from organizations`;
      assert(orgs.some((org) => org.name === "Synthetic staging rehearsal"));
      assert(
        orgs.every(
          (org) =>
            org.name === "Synthetic staging rehearsal" ||
            (org.id === organizationId && org.name === "Staging source observation (shadow only)")
        )
      );
      if (mode === "provision") {
        await tx`insert into organizations (id,name) values (${organizationId},'Staging source observation (shadow only)') on conflict (id) do nothing`;
        await tx`insert into data_sources (id,organization_id,type,display_name,status,configuration_reference)
          values (${sourceId},${organizationId},'zendesk','Zendesk shadow observation','configured',${reference}) on conflict (id) do nothing`;
      }
      const [source] =
        await tx`select organization_id,type,display_name,status,configuration_reference,last_successful_sync_at from data_sources where id=${sourceId} for update`;
      assert(source);
      assert.equal(source.organization_id, organizationId);
      assert.equal(source.type, "zendesk");
      assert.equal(source.display_name, "Zendesk shadow observation");
      assert.equal(source.configuration_reference, reference);
      assert.equal(source.last_successful_sync_at, null);
      stage = "publication_isolation";
      const [counts] = await tx`select
        (select count(*)::int from employees where organization_id=${organizationId}) employees,
        (select count(*)::int from users where organization_id=${organizationId}) users,
        (select count(*)::int from metric_definitions where organization_id=${organizationId}) definitions,
        (select count(*)::int from normalized_facts where data_source_id=${sourceId}) facts,
        (select count(*)::int from sync_runs where data_source_id=${sourceId}) publishing_runs`;
      assert(Object.values(counts!).every((value) => value === 0));
      if (mode === "disable")
        await tx`update data_sources set status='disabled' where id=${sourceId}`;
      else if (mode === "provision") assert.equal(source.status, "configured");
      const types =
        await tx`select external_record_type type,count(*)::int count from source_records where data_source_id=${sourceId} group by external_record_type order by external_record_type`;
      assert(
        types.every((row) =>
          /^zendesk_(ticket_action_(checkpoint|event)|agent_leg_(checkpoint|record|revision)|action_worker_lease)_v2_shadow$/.test(
            row.type
          )
        )
      );
      const checkpoints =
        await tx`select external_record_type type,payload_json payload from source_records where data_source_id=${sourceId} and external_record_type in ('zendesk_ticket_action_checkpoint_v2_shadow','zendesk_agent_leg_checkpoint_v2_shadow') order by external_record_type,external_record_id`;
      const periods = checkpoints.map((row) => {
        assert.equal(row.payload.accountReference, reference);
        return {
          stream: row.type.includes("ticket") ? "tickets" : "legs",
          start: row.payload.start,
          endExclusive: row.payload.endExclusive,
          pages: row.payload.pages,
          status: row.payload.status,
          notBefore: row.payload.notBefore,
        };
      });
      return {
        observedAt: new Date().toISOString(),
        mode,
        stagingOnly: true,
        accountBindingMatched: true,
        sourceStatus: mode === "disable" ? "disabled" : source.status,
        publication: counts,
        records: types,
        checkpoints: periods,
      };
    });
    await writeFile(output!, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report));
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(
    JSON.stringify({
      status: "staging_shadow_observation_failed",
      stage,
      credentialsAndPayloadsOmitted: true,
    })
  );
  process.exitCode = 1;
});
