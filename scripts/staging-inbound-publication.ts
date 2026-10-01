/** Explicit hosted rehearsal: synthetic records, fixed staging destination, no vendor requests. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { weekDates } from "../src/lib/utils";
import { inboundReportKeys } from "../src/lib/connectors/zendesk-inbound-report";

let stage = "guard";
async function main() {
  assert.equal(process.argv[2], "--apply", "Explicit synthetic rehearsal required");
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/main-operational-upgrade");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  assert(url.password);
  for (const name of [
    "ZENDESK_EMAIL",
    "ZENDESK_API_KEY",
    "ASSEMBLED_API_KEY",
    "ENTRA_CLIENT_SECRET",
    "ZENDESK_TALK_COLLECTION_POLICY",
    "ZENDESK_OUTBOUND_POLICY",
    "ZENDESK_CSAT_POLICY",
    "ZENDESK_FIRST_REPLY_POLICY",
    "ZENDESK_INBOUND_REPORT_RELEASE",
    "ACTION_SHADOW_SOURCE_ID",
  ])
    assert(!process.env[name], "Vendor access and live publication must be disabled");
  globalThis.fetch = async () => {
    throw Error("Vendor/network requests forbidden in rehearsal");
  };
  const connection = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const globalDb = globalThis as unknown as {
    _cadenceDb?: ReturnType<typeof drizzle<typeof schema>>;
  };
  globalDb._cadenceDb = drizzle(connection, { schema });
  const sourceId = "50000000-0000-4000-8000-000000000043";
  try {
    stage = "synthetic ownership";
    const orgs =
      await connection`select id from organizations where name='Synthetic staging rehearsal'`;
    assert.equal(orgs.length, 1);
    const org = orgs[0]!.id;
    const staff =
      await connection`select id,primary_team_id,display_name from employees where organization_id=${org}`;
    assert.equal(staff.length, 1);
    assert.equal(staff[0]!.display_name, "Synthetic employee");
    const employee = staff[0]!.id,
      team = staff[0]!.primary_team_id;
    assert(team);
    assert.equal((await connection`select id from sync_runs where status='running'`).length, 0);
    const fingerprint = async () => {
      const rows =
        await connection`select to_jsonb(v) as value from metric_values v join metric_definitions d on d.id=v.metric_definition_id
        where v.employee_id=${employee} and not (d.key=any(${[...inboundReportKeys]}::text[])) order by v.id`;
      return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    };
    const before = await fingerprint();
    stage = "synthetic configuration";
    await connection.begin(async (tx) => {
      const existing =
        await tx`select organization_id,configuration_reference,display_name from data_sources where id=${sourceId}`;
      if (existing.length) {
        assert.equal(existing[0]!.organization_id, org);
        assert.equal(existing[0]!.configuration_reference, "zendesk-account:synthetic");
        assert.equal(existing[0]!.display_name, "Synthetic inbound publication rehearsal");
      } else {
        await tx`insert into data_sources(id,organization_id,type,display_name,status,configuration_reference)
          values(${sourceId},${org},'zendesk','Synthetic inbound publication rehearsal','configured','zendesk-account:synthetic')`;
      }
      await tx`insert into external_identities(employee_id,data_source_id,external_id,external_entity_type,match_method)
        values(${employee},${sourceId},'synthetic-inbound@example.invalid','user','manual') on conflict do nothing`;
      for (const [index, key] of inboundReportKeys.entries()) {
        const rate = key === "inbound_calls_answer_rate";
        const duration = ["total_talk_time_inbound", "max_hold_time_inbound"].includes(key);
        const unit = rate ? "%" : duration ? "s" : "calls";
        const valueType = rate ? "percentage" : duration ? "duration" : "count";
        const calculationType = rate ? "latest" : key === "max_hold_time_inbound" ? "max" : "sum";
        let defs =
          await tx`select id,unit,value_type,calculation_type,source_strategy,status from metric_definitions where organization_id=${org} and key=${key}`;
        if (!defs.length)
          defs =
            await tx`insert into metric_definitions(organization_id,key,name,category,unit,value_type,calculation_type,source_strategy,direction)
          values(${org},${key},${`Synthetic ${key.replaceAll("_", " ")}`},'inbound_call',${unit},${valueType},${calculationType},'zendesk','neutral')
          returning id,unit,value_type,calculation_type,source_strategy,status`;
        assert.equal(defs.length, 1);
        const def = defs[0]!;
        assert.equal(def.unit, unit);
        assert.equal(def.value_type, valueType);
        assert.equal(def.calculation_type, calculationType);
        assert.equal(def.source_strategy, "zendesk");
        assert.equal(def.status, "active");
        const assignments =
          await tx`select employee_id,role_key from metric_assignments where metric_definition_id=${def.id} and team_id=${team}`;
        if (!assignments.length)
          await tx`insert into metric_assignments(metric_definition_id,team_id,display_order) values(${def.id},${team},${80 + index})`;
        else {
          assert.equal(assignments.length, 1);
          assert.equal(assignments[0]!.employee_id, null);
          assert.equal(assignments[0]!.role_key, null);
        }
      }
    });
    const { inboundPublicationFixture } =
      await import("../src/__tests__/fixtures/inbound-publication");
    const { createInboundPublisher } =
      await import("../src/lib/connectors/zendesk-inbound-publisher");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const config = { organizationId: org, dataSourceId: sourceId };
    const results = [];
    for (const offset of [1, 0]) {
      stage = `synthetic publication offset ${offset}`;
      const f = inboundPublicationFixture(config, employee, team);
      const { periodStart, periodEnd } = weekDates(offset);
      f.release.policy.effectivePeriodStart = weekDates(1).periodStart;
      f.release.policy.metricKeys = [...inboundReportKeys];
      f.snapshot.bootstrapStart =
        (Date.parse(weekDates(1).periodStart + "T00:00:00Z") - 86400000) / 1000;
      for (const state of [f.snapshot.callsState, f.snapshot.legsState]) {
        state.bootstrapStart = f.snapshot.bootstrapStart;
        state.cursor.watermark = f.snapshot.bootstrapStart;
      }
      for (const row of [...f.snapshot.calls, ...f.snapshot.legs])
        row.created_at = periodStart + "T12:00:00Z";
      const publisher = createInboundPublisher(
        f.release,
        async () => ({
          snapshot: f.snapshot,
          identities: new Map([["synthetic-inbound@example.invalid", 42]]),
        }),
        "synthetic"
      );
      const result = await runSync(publisher, config, { weekOffset: offset });
      assert.equal(result.success, true, "Synthetic publication failed");
      const values =
        await connection`select d.key,v.numeric_value,v.provenance_json from metric_values v join metric_definitions d on d.id=v.metric_definition_id
        where v.employee_id=${employee} and v.period_start=${periodStart} and v.period_end=${periodEnd} and d.key=any(${[...inboundReportKeys]}::text[])`;
      assert.equal(values.length, 9);
      assert(
        values.every((v) => v.numeric_value !== null && Number.isFinite(Number(v.numeric_value)))
      );
      assert(
        values.every(
          (v) => v.provenance_json.sourceContract === "zendesk-call-created-agent-leg-inbound-v1"
        )
      );
      assert.equal(Number(values.find((v) => v.key === "inbound_calls_offered")!.numeric_value), 2);
      assert.equal(
        Number(values.find((v) => v.key === "inbound_calls_answer_rate")!.numeric_value),
        100
      );
      assert.equal(
        Number(values.find((v) => v.key === "inbound_calls_unreachable")!.numeric_value),
        0
      );
      assert.equal(
        Number(values.find((v) => v.key === "total_talk_time_inbound")!.numeric_value),
        2
      );
      results.push({ periodStart, periodEnd, publishedValues: values.length });
    }
    assert.equal(await fingerprint(), before, "Unrelated synthetic values changed");
    console.log(
      JSON.stringify({
        syntheticInboundRehearsal: true,
        syntheticEmployeeId: employee,
        periods: results,
        unrelatedValuesUnchanged: true,
        vendorRequests: 0,
        productionWrites: 0,
      })
    );
  } finally {
    await connection.end();
    delete globalDb._cadenceDb;
  }
}
main().catch(() => {
  console.error(
    `Synthetic inbound rehearsal failed at ${stage}; no production action was performed.`
  );
  process.exitCode = 1;
});
