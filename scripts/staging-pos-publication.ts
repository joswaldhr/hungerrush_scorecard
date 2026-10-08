/** Synthetic hosted acceptance only. The destination guard runs before any connection. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { weekDates } from "../src/lib/utils";
import { posInboundPublicationFixture } from "../src/__tests__/fixtures/pos-inbound-publication";
import { posInboundReportKeys } from "../src/lib/connectors/zendesk-pos-inbound-report";

let stage = "guard";
async function main() {
  assert.equal(process.argv[2], "--apply");
  assert.equal(process.argv.length, 3);
  await import("./assert-main-preview.mjs");
  globalThis.fetch = async () => {
    throw Error("Network requests forbidden in rehearsal");
  };
  // Only process-local synthetic credentials, after proving real vendor access is absent.
  process.env.AUTH_SECRET = "synthetic-local-publication-only-no-signin";
  process.env.ZENDESK_SUBDOMAIN = "synthetic";
  process.env.ZENDESK_EMAIL = "source@example.invalid";
  process.env.ZENDESK_API_KEY = "synthetic-token";
  const connection = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const cache = globalThis as unknown as { _cadenceDb?: ReturnType<typeof drizzle<typeof schema>> };
  cache._cadenceDb = drizzle(connection, { schema });
  const source = "50000000-0000-4000-8000-000000000050";
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
    const periods = [weekDates(2), weekDates(1), weekDates(0)];
    const starts = periods.map((p) => p.periodStart),
      keys = [...posInboundReportKeys];
    const fingerprint = async () =>
      createHash("sha256")
        .update(
          JSON.stringify(
            await connection`
      select to_jsonb(v) as value from metric_values v join metric_definitions d on d.id=v.metric_definition_id
      where not(v.employee_id=${employee} and d.key=any(${keys}::text[]) and v.period_start::text=any(${starts}::text[])) order by v.id
    `
          )
        )
        .digest("hex");
    const before = await fingerprint();
    stage = "synthetic catalog";
    const names: Record<string, string> = {
      inbound_calls_accepted: "Accepted IB (Inbound)",
      declined_calls: "Declined calls",
      missed_calls: "Missed calls",
      avg_talk_time_inbound: "Avg Talk",
      avg_hold_time_inbound: "Avg Hold",
      avg_call_duration_inbound: "Avg Duration",
      avg_consultation_time_inbound: "Avg Consultation",
    };
    await connection.begin(async (tx) => {
      const existing =
        await tx`select organization_id,configuration_reference,display_name from data_sources where id=${source}`;
      if (existing.length) {
        assert.equal(existing[0]!.organization_id, org);
        assert.equal(existing[0]!.configuration_reference, "zendesk-account:synthetic");
        assert.equal(existing[0]!.display_name, "Synthetic POS publication rehearsal");
      } else
        await tx`insert into data_sources(id,organization_id,type,display_name,status,configuration_reference)
        values(${source},${org},'zendesk','Synthetic POS publication rehearsal','configured','zendesk-account:synthetic')`;
      const identities =
        await tx`select employee_id,external_id from external_identities where data_source_id=${source}`;
      assert(identities.length <= 1);
      if (identities.length) {
        assert.equal(identities[0]!.employee_id, employee);
        assert.equal(identities[0]!.external_id, "synthetic-agent@example.invalid");
      } else
        await tx`insert into external_identities(employee_id,data_source_id,external_id,external_entity_type,match_method)
        values(${employee},${source},'synthetic-agent@example.invalid','agent','manual')`;
      for (const [index, key] of keys.entries()) {
        const duration = key.startsWith("avg_");
        const unit = duration ? "s" : "calls",
          type = duration ? "duration" : "count",
          aggregation = duration ? "average" : "sum";
        let defs =
          await tx`select id,unit,value_type,calculation_type,source_strategy,status from metric_definitions where organization_id=${org} and key=${key}`;
        if (!defs.length)
          defs =
            await tx`insert into metric_definitions(organization_id,key,name,category,unit,value_type,calculation_type,source_strategy,direction)
          values(${org},${key},${names[key]!},'inbound_call',${unit},${type},${aggregation},'zendesk','neutral') returning id,unit,value_type,calculation_type,source_strategy,status`;
        assert.equal(defs.length, 1);
        const def = defs[0]!;
        for (const [field, value] of Object.entries({
          unit,
          value_type: type,
          calculation_type: aggregation,
          source_strategy: "zendesk",
          status: "active",
        }))
          assert.equal(def[field], value);
        const assignments =
          await tx`select employee_id,role_key from metric_assignments where metric_definition_id=${def.id} and team_id=${team}`;
        if (!assignments.length)
          await tx`insert into metric_assignments(metric_definition_id,team_id,display_order) values(${def.id},${team},${index})`;
        else {
          assert.equal(assignments.length, 1);
          assert.equal(assignments[0]!.employee_id, null);
          assert.equal(assignments[0]!.role_key, null);
        }
      }
    });
    const config = { organizationId: org, dataSourceId: source };
    const fixtures = periods.map((period, i) => {
      const f = posInboundPublicationFixture(config, employee, team);
      const idBase = (Date.parse(period.periodStart) / 86400000) * 100;
      for (const call of f.snapshot.calls) {
        call.id += idBase;
        call.created_at = `${period.periodStart}T00:00:00Z`;
        call.updated_at = new Date(Date.now() - 120000).toISOString();
        call.hold_time = i === 2 ? 0 : call.hold_time * 3;
      }
      for (const leg of f.snapshot.legs) {
        leg.call_id += idBase;
        leg.id += idBase;
        leg.created_at = `${period.periodStart}T00:00:00Z`;
        leg.updated_at = new Date(Date.now() - 120000).toISOString();
        leg.talk_time = i === 2 ? 0 : leg.talk_time === 0 ? 0 : leg.id % 100 === 1 ? 600 : 900;
        leg.duration = i === 2 ? 0 : 600;
        leg.consultation_time = i === 2 ? null : 30;
      }
      f.release.policy.effectivePeriodStart = periods[0]!.periodStart;
      return { ...f, ...period };
    });
    const calls = fixtures.flatMap((f) => f.snapshot.calls),
      legs = fixtures.flatMap((f) => f.snapshot.legs);
    const watermark = Math.floor(Date.now() / 1000) - 60;
    let simulatedRequests = 0;
    globalThis.fetch = async (input, options) => {
      assert.equal(options?.method, "GET");
      assert.equal(options?.redirect, "error");
      const url = new URL(String(input));
      assert.equal(url.origin, "https://synthetic.zendesk.com");
      simulatedRequests++;
      if (url.pathname === "/api/v2/users.json")
        return Response.json({
          users: [
            {
              id: 42,
              email: "synthetic-agent@example.invalid",
              role: "agent",
              active: true,
              suspended: false,
            },
          ],
          meta: { has_more: false },
          links: { next: null },
        });
      const resource = url.pathname.endsWith("/calls.json")
        ? "calls"
        : url.pathname.endsWith("/legs.json")
          ? "legs"
          : null;
      assert(
        resource && url.pathname === `/api/v2/channels/voice/stats/incremental/${resource}.json`
      );
      const rows = resource === "calls" ? calls : legs;
      const next = new URL(url);
      next.searchParams.set("start_time", String(watermark));
      return Response.json({
        [resource]: rows,
        count: rows.length,
        end_time: watermark,
        next_page: next.href,
      });
    };
    const { createLivePosInboundPublisher } =
      await import("../src/lib/connectors/zendesk-pos-inbound-publisher");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const collection = {
      scope: { ...config, accountReference: "zendesk-account:synthetic" },
      bootstrapStart: (Date.parse(periods[0]!.periodStart) - 86400000) / 1000,
    };
    const results = [];
    for (const [index, f] of fixtures.entries()) {
      stage = `collect and publish synthetic POS period ${index}`;
      const result = await runSync(createLivePosInboundPublisher(f.release, collection), config, {
        period: { periodStart: f.periodStart, periodEnd: f.periodEnd },
      });
      assert.equal(result.success, true, "Synthetic POS publication failed");
      const values =
        await connection`select d.key,v.numeric_value,v.provenance_json from metric_values v join metric_definitions d on d.id=v.metric_definition_id
        where v.employee_id=${employee} and d.key=any(${keys}::text[]) and v.period_start=${f.periodStart} and v.period_end=${f.periodEnd}`;
      assert.equal(values.length, keys.length);
      const expected: Record<string, number | null> = {
        inbound_calls_accepted: index === 2 ? 0 : 2,
        declined_calls: 0,
        missed_calls: 0,
        avg_talk_time_inbound: index === 2 ? 0 : 500,
        avg_hold_time_inbound: index === 2 ? 0 : 60,
        avg_call_duration_inbound: index === 2 ? 0 : 600,
        avg_consultation_time_inbound: index === 2 ? null : 30,
      };
      for (const row of values) {
        assert.equal(row.numeric_value, expected[row.key]);
        assert.equal(
          row.provenance_json.sourceContract,
          "zendesk-qualified-pos-leg-date-inbound-v1"
        );
        if (row.key.startsWith("avg_")) {
          assert.equal(row.provenance_json.cohortCount, 3);
          assert.equal(
            row.provenance_json.sampleCount,
            index === 2 && row.key === "avg_consultation_time_inbound" ? 0 : 3
          );
        }
      }
      results.push({ periodStart: f.periodStart, periodEnd: f.periodEnd, values: expected });
    }
    assert.equal(await fingerprint(), before, "Unrelated synthetic values changed");
    console.log(
      JSON.stringify({
        syntheticPosRehearsal: true,
        completeCollectionAndLiveAdapterPath: true,
        simulatedRequests,
        results,
        unrelatedValuesUnchanged: true,
        vendorRequests: 0,
        productionWrites: 0,
      })
    );
  } finally {
    await connection.end();
    delete cache._cadenceDb;
  }
}
main().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      failedAt: stage,
      errorName: error instanceof Error ? error.name : "Unknown",
      errorMessage:
        error instanceof Error
          ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]").slice(0, 180)
          : undefined,
    })
  );
  process.exitCode = 1;
});
