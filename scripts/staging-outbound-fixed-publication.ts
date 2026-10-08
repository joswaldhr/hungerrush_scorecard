/** Isolated synthetic fixed-period outbound rehearsal; never contacts a vendor. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { weekDates } from "../src/lib/utils";

let stage = "guard";
async function main() {
  assert.equal(process.argv[2], "--apply");
  await import("./assert-main-preview.mjs");
  const url = new URL(process.env.DATABASE_URL!);
  process.env.ZENDESK_SUBDOMAIN = "synthetic-outbound-fixed";
  process.env.ZENDESK_EMAIL = "source@example.invalid";
  process.env.ZENDESK_API_KEY = "synthetic-no-vendor-access";
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  (globalThis as unknown as { _cadenceDb: ReturnType<typeof drizzle<typeof schema>> })._cadenceDb =
    drizzle(sql, { schema });
  const id = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const org = id(80),
    team = id(81),
    employee = id(82),
    source = id(83);
  const accountReference = "zendesk-account:synthetic-outbound-fixed";
  const config = { organizationId: org, dataSourceId: source };
  const scope = { ...config, accountReference };
  const periods = [2, 1, 0].map(weekDates);
  let requests = 0;
  globalThis.fetch = async (input, options) => {
    const u = new URL(String(input));
    assert.equal(u.origin, "https://synthetic-outbound-fixed.zendesk.com");
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "error");
    requests++;
    if (u.pathname === "/api/v2/users.json")
      return Response.json({
        users: [
          { id: 42, email: "agent@example.invalid", role: "agent", active: true, suspended: false },
        ],
        meta: { has_more: false },
        links: { next: null },
      });
    if (u.pathname === "/api/v2/tickets/show_many.json")
      return Response.json({
        tickets: u.searchParams
          .get("ids")!
          .split(",")
          .map(Number)
          .map((id) => ({ id, group_id: 7, updated_at: `${periods[0]!.periodStart}T00:00:00Z` })),
      });
    throw Error("Unexpected synthetic request");
  };
  try {
    stage = "ownership";
    const old = await sql`select name from organizations where id=${org}`;
    assert(!old.length || old[0]!.name === "Synthetic outbound fixed-period rehearsal");
    const fingerprint = async () =>
      createHash("sha256")
        .update(
          JSON.stringify(
            await sql`select to_jsonb(v) as row from metric_values v join employees e on e.id=v.employee_id where e.organization_id<>${org} order by v.id`
          )
        )
        .digest("hex");
    const before = await fingerprint();
    const { outboundTalkKeys } = await import("../src/lib/connectors/zendesk-talk-policy");
    stage = "synthetic catalog";
    await sql.begin(async (tx) => {
      await tx`insert into organizations(id,name) values(${org},'Synthetic outbound fixed-period rehearsal') on conflict do nothing`;
      await tx`insert into teams(id,organization_id,name,slug) values(${team},${org},'Synthetic outbound team','synthetic-outbound-fixed') on conflict do nothing`;
      await tx`insert into data_sources(id,organization_id,type,display_name,status,configuration_reference) values(${source},${org},'zendesk','Synthetic outbound fixed','configured',${accountReference}) on conflict do nothing`;
      assert.equal(
        (
          await tx`select id from data_sources where id=${source} and organization_id=${org} and configuration_reference=${accountReference}`
        ).length,
        1
      );
      await tx`insert into employees(id,organization_id,primary_team_id,display_name) values(${employee},${org},${team},'Synthetic outbound employee') on conflict do nothing`;
      assert.equal(
        (
          await tx`select id from employees where id=${employee} and organization_id=${org} and primary_team_id=${team}`
        ).length,
        1
      );
      await tx`insert into external_identities(employee_id,data_source_id,external_id,external_entity_type,match_method) values(${employee},${source},'agent@example.invalid','user','manual') on conflict do nothing`;
      for (const [i, key] of outboundTalkKeys.entries()) {
        const duration = key.startsWith("avg_");
        await tx`insert into metric_definitions(id,organization_id,key,name,source_strategy,calculation_type,unit,value_type) values(${id(90 + i)},${org},${key},${key},'zendesk',${duration ? "average" : "sum"},${duration ? "s" : "calls"},${duration ? "duration" : "count"}) on conflict do nothing`;
        await tx`insert into metric_assignments(metric_definition_id,team_id,effective_from) select ${id(90 + i)},${team},${periods[0]!.periodStart} where not exists(select 1 from metric_assignments where metric_definition_id=${id(90 + i)} and team_id=${team})`;
      }
    });
    const { outboundObservationFixture } =
      await import("../src/__tests__/fixtures/outbound-observation");
    const f = outboundObservationFixture(config, employee, team);
    f.policy.accountReference = accountReference;
    f.policy.effectivePeriodStart = periods[0]!.periodStart;
    const calls = periods.flatMap((p, i) =>
      f.snapshot.calls.map((c) => ({
        ...c,
        id: c.id + i * 100,
        ticket_id: c.ticket_id! + i * 100,
        created_at: `${p.periodStart}T12:00:00Z`,
        updated_at: `${p.periodStart}T13:00:00Z`,
      }))
    );
    const legs = periods.flatMap((p, i) =>
      f.snapshot.legs.map((l) => ({
        ...l,
        id: l.id + i * 100,
        call_id: l.call_id + i * 100,
        created_at: `${p.periodStart}T12:00:00Z`,
        updated_at: `${p.periodStart}T13:00:00Z`,
      }))
    );
    const store = await import("../src/lib/connectors/zendesk-talk-store");
    const lease = await store.claimTalkCollection(scope);
    assert(lease.acquired);
    const owned = { ...scope, token: lease.token };
    stage = "synthetic observation";
    try {
      const bootstrap = Date.parse(periods[0]!.periodStart + "T00:00:00Z") / 1000;
      for (const resource of ["calls", "legs"] as const) {
        const cycle = await store.beginTalkCollectionCycle(owned, resource, bootstrap);
        const values = resource === "calls" ? calls : legs;
        const end = Math.floor(Date.now() / 1000);
        const page = await store.commitTalkCollectionPage(owned, resource, cycle.expectedHash, {
          [resource]: values,
          count: values.length,
          end_time: end,
          next_page: `https://synthetic-outbound-fixed.zendesk.com/api/v2/channels/voice/stats/incremental/${resource}.json?start_time=${end}`,
        });
        await store.commitTalkCollectionPage(owned, resource, page.expectedHash, {
          [resource]: [],
          count: 0,
          end_time: end,
          next_page: null,
        });
      }
    } finally {
      await store.releaseTalkCollection(owned);
    }
    const { createOutboundConnector } =
      await import("../src/lib/connectors/zendesk-outbound-connector");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const expected: Record<string, number | null> = {
      outbound_calls: 2,
      outbound_calls_completed: 1,
      outbound_calls_non_answered: 1,
      avg_talk_time_outbound: 2 / 3,
      avg_hold_time_outbound: null,
    };
    const receipts = [];
    for (const period of periods) {
      stage = "fixed publication";
      const result = await runSync(createOutboundConnector(f.policy), config, {
        period: { periodStart: period.periodStart, periodEnd: period.periodEnd },
      });
      assert(result.success);
      const values =
        await sql`select d.key,v.numeric_value,v.period_end::text from metric_values v join metric_definitions d on d.id=v.metric_definition_id where v.employee_id=${employee} and v.period_start=${period.periodStart}`;
      assert.equal(values.length, 5);
      for (const v of values) {
        assert.equal(v.period_end, period.periodEnd);
        assert.equal(v.numeric_value, expected[v.key]);
      }
      const [run] = await sql`select metadata_json from sync_runs where id=${result.syncRunId}`;
      assert.deepEqual(run!.metadata_json.period, {
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
      });
      receipts.push({ ...period, values: values.length, nulls: 1 });
    }
    assert.equal(await fingerprint(), before);
    console.log(
      JSON.stringify({
        outboundFixedHostedRehearsal: true,
        observedAt: new Date().toISOString(),
        periods: receipts,
        simulatedRequests: requests,
        vendorRequests: 0,
        productionAccess: false,
        unrelatedValuesUnchanged: true,
      })
    );
  } finally {
    await sql.end();
  }
}
main().catch(() => {
  console.error(JSON.stringify({ outboundFixedHostedRehearsal: false, stage }));
  process.exitCode = 1;
});
