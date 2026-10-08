/** Hosted synthetic CSAT adapter/transaction rehearsal. No vendor or production access. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { weekDates } from "../src/lib/utils";

let stage = "guard";
async function main() {
  assert.equal(process.argv[2], "--apply");
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/main-operational-upgrade");
  const url = new URL(process.env.DATABASE_URL!);
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  for (const key of [
    "ZENDESK_EMAIL",
    "ZENDESK_API_KEY",
    "ZENDESK_CSAT_POLICY",
    "ZENDESK_CSAT_RECOVERY",
    "ZENDESK_REPORT_RECOVERY",
    "ACTION_SHADOW_SOURCE_ID",
  ])
    assert(!process.env[key], "Live source access must be disabled");
  process.env.ZENDESK_SUBDOMAIN = "synthetic-csat";
  process.env.ZENDESK_EMAIL = "source@example.invalid";
  process.env.ZENDESK_API_KEY = "synthetic-no-vendor-access";
  const sql = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const globalDb = globalThis as unknown as {
    _cadenceDb?: ReturnType<typeof drizzle<typeof schema>>;
  };
  globalDb._cadenceDb = drizzle(sql, { schema });
  const id = (n: number) => `60000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const org = id(50),
    team = id(51),
    source = id(55),
    staff = [52, 53, 54].map(id);
  const accountReference = "zendesk-account:synthetic-csat";
  const periods = [2, 1, 0].map(weekDates);
  const keys = ["csat_score", "csat_response_rate"] as const;
  let selected = periods[0]!,
    requests = 0;
  globalThis.fetch = async (input, options) => {
    const u = new URL(String(input));
    assert.equal(u.origin, "https://synthetic-csat.zendesk.com");
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "error");
    requests++;
    if (u.pathname === "/api/v2/users.json")
      return Response.json({
        users: staff.map((_, i) => ({
          id: i + 7,
          email: `agent${i}@example.invalid`,
          role: "agent",
          active: true,
          suspended: false,
        })),
        meta: { has_more: false },
        links: { next: null },
      });
    const tickets = ["good", "bad", "offered", "bad"].map((score, i) => ({
      id: 100 + i,
      assignee_id: i === 3 ? 8 : 7,
      group_id: 20,
      brand_id: 30,
      satisfaction_rating: { score },
    }));
    if (u.pathname === "/api/v2/search/export.json") {
      const q = u.searchParams.get("query")!;
      const pad = (day: string, offset: number) =>
        new Date(Date.parse(day + "T00:00:00Z") + offset * 86400000).toISOString().slice(0, 10);
      assert(q.includes(`solved>=${pad(selected.periodStart, -1)}`));
      assert(q.includes(`solved<=${pad(selected.periodEnd, 1)}`));
      assert(
        q.includes("group:20") &&
          q.includes("brand:30") &&
          [7, 8, 9].every((i) => q.includes(`assignee:${i}`))
      );
      return Response.json({ results: tickets, meta: { has_more: false }, links: { next: null } });
    }
    if (u.pathname === "/api/v2/tickets/show_many.json") {
      assert.deepEqual(
        u.searchParams.get("ids")?.split(",").map(Number).sort(),
        [100, 101, 102, 103]
      );
      return Response.json({
        metric_sets: tickets.map((t) => ({
          ticket_id: t.id,
          solved_at: `${selected.periodStart}T12:00:00Z`,
        })),
      });
    }
    throw Error("Unexpected synthetic source request");
  };
  try {
    stage = "ownership";
    const old = await sql`select name from organizations where id=${org}`;
    assert(!old.length || old[0]!.name === "Synthetic CSAT recovery rehearsal");
    const fingerprint = async () => {
      const rows =
        await sql`select to_jsonb(v) as row from metric_values v join employees e on e.id=v.employee_id where e.organization_id<>${org} order by v.id`;
      return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    };
    const before = await fingerprint();
    stage = "synthetic catalog";
    await sql.begin(async (tx) => {
      await tx`insert into organizations(id,name) values(${org},'Synthetic CSAT recovery rehearsal') on conflict do nothing`;
      await tx`insert into teams(id,organization_id,name,slug) values(${team},${org},'Synthetic CSAT team','synthetic-csat-recovery') on conflict do nothing`;
      await tx`insert into data_sources(id,organization_id,type,display_name,status,configuration_reference) values(${source},${org},'zendesk','Synthetic CSAT recovery','configured',${accountReference}) on conflict do nothing`;
      assert.equal(
        (
          await tx`select id from data_sources where id=${source} and organization_id=${org} and configuration_reference=${accountReference} and type='zendesk' and status='configured'`
        ).length,
        1
      );
      for (const [i, employee] of staff.entries()) {
        await tx`insert into employees(id,organization_id,primary_team_id,display_name) values(${employee},${org},${team},${`Synthetic CSAT employee ${i + 1}`}) on conflict do nothing`;
        assert.equal(
          (
            await tx`select id from employees where id=${employee} and organization_id=${org} and primary_team_id=${team}`
          ).length,
          1
        );
        await tx`insert into external_identities(employee_id,data_source_id,external_id,external_entity_type,match_method) values(${employee},${source},${`agent${i}@example.invalid`},'user','manual') on conflict do nothing`;
      }
      for (const [i, key] of keys.entries()) {
        await tx`insert into metric_definitions(id,organization_id,key,name,source_strategy,calculation_type,unit,value_type) values(${id(61 + i)},${org},${key},${key},'zendesk','latest','%','percentage') on conflict do nothing`;
        assert.equal(
          (
            await tx`select id from metric_definitions where id=${id(61 + i)} and organization_id=${org} and key=${key} and source_strategy='zendesk'`
          ).length,
          1
        );
        await tx`insert into metric_assignments(metric_definition_id,team_id) select ${id(61 + i)},${team} where not exists(select 1 from metric_assignments where metric_definition_id=${id(61 + i)} and team_id=${team})`;
      }
    });
    const { createCsatConnector } = await import("../src/lib/connectors/zendesk-csat-connector");
    const { parseZendeskCsatPolicy } = await import("../src/lib/connectors/zendesk-csat-policy");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const policy = parseZendeskCsatPolicy(
      JSON.stringify({
        schemaVersion: 1,
        dataSourceId: source,
        organizationId: org,
        accountReference,
        reportingTimeZone: "UTC",
        effectivePeriodStart: periods[0]!.periodStart,
        teams: [{ teamId: team, groupIds: [20], brandIds: [30], metricKeys: keys }],
      }),
      "synthetic-csat"
    )!;
    const config = { dataSourceId: source, organizationId: org };
    const receipts = [];
    for (const period of periods) {
      stage = "fixed period publication";
      selected = period;
      const result = await runSync(createCsatConnector(policy), config, {
        period: { periodStart: period.periodStart, periodEnd: period.periodEnd },
      });
      assert(result.success);
      const values =
        await sql`select v.employee_id,d.key,v.numeric_value,v.period_end::text,v.provenance_json from metric_values v join metric_definitions d on d.id=v.metric_definition_id where v.employee_id=any(${staff}::uuid[]) and v.period_start=${period.periodStart}`;
      assert.equal(values.length, 6);
      for (const row of values) {
        const index = staff.indexOf(row.employee_id);
        const expected =
          index === 0
            ? row.key === "csat_score"
              ? 50
              : 200 / 3
            : index === 1
              ? row.key === "csat_score"
                ? 0
                : 100
              : null;
        assert.equal(row.numeric_value, expected);
        assert.equal(row.period_end, period.periodEnd);
        assert.equal(row.provenance_json.sourceContract, "zendesk-solved-current-assignee-csat-v1");
      }
      assert.equal(await fingerprint(), before);
      receipts.push({
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        values: 6,
        zeroValues: 1,
        noSampleNulls: 2,
      });
    }
    stage = "durable cooldown";
    const { planReportRecovery, dispatchReportRecovery } =
      await import("../src/lib/connectors/zendesk-report-recovery");
    const { solvedPublicationFixture } =
      await import("../src/__tests__/fixtures/solved-publication");
    const { isSyncRateLimited } = await import("../src/lib/rate-limit");
    const f = solvedPublicationFixture(config, staff[0]!, team);
    const plan = planReportRecovery(
      {
        scope: { ...config, accountReference },
        bootstrapStart: Date.parse(periods[0]!.periodStart + "T00:00:00Z") / 1000,
      },
      [{ ...f.policy, subdomain: "synthetic-csat", accountReference }],
      new Date(),
      policy
    );
    const request = plan.requests.find(
      (r) => r.definition.kind === "csat" && r.definition.periodStart === selected.periodStart
    )!;
    const beforeRequests = requests;
    const result = await dispatchReportRecovery(
      { ...plan, requests: [request], currentPolicyHashes: [plan.csatPolicy!.policyHash] },
      async (job) => {
        assert.equal(job.definition.kind, "csat");
        assert(await isSyncRateLimited(source));
        return { status: "deferred", retryAt: new Date(Date.now() + 300000).toISOString() };
      }
    );
    assert.equal(result.status, "deferred");
    assert.equal(requests, beforeRequests);
    const [job] =
      await sql`select payload_json from source_records where data_source_id=${source} and external_record_type='zendesk_report_job_v1' and payload_json->'definition'->>'periodStart'=${selected.periodStart}`;
    assert.equal(job!.payload_json.lastOutcome, "deferred");
    assert.equal(job!.payload_json.completedThrough, null);
    assert.equal(job!.payload_json.lease, null);
    assert(Date.parse(job!.payload_json.notBefore) > Date.now());
    assert.equal(await fingerprint(), before);
    console.log(
      JSON.stringify({
        observedAt: new Date().toISOString(),
        environment: "isolated synthetic Preview",
        productionAccess: false,
        vendorRequests: 0,
        simulatedRequests: requests,
        receipts,
        durableCooldownPersisted: true,
        unrelatedValuesUnchanged: true,
        limits: [
          "Cooldown remains pending; no unattended scheduler execution is claimed.",
          "Failure/lease/rollover cases are separately covered by PostgreSQL and worker tests.",
        ],
      })
    );
  } finally {
    await sql.end();
    delete globalDb._cadenceDb;
  }
}
main().catch(() => {
  console.error(`Synthetic CSAT rehearsal failed at ${stage}; private values not logged`);
  process.exitCode = 1;
});
