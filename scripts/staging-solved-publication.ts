/** Explicit synthetic hosted rehearsal. Never loads vendor credentials or production data. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { weekDates } from "../src/lib/utils";
import { solvedPublicationFixture } from "../src/__tests__/fixtures/solved-publication";

let stage = "guard";
async function main() {
  assert.equal(process.argv[2], "--apply");
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/main-operational-upgrade");
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.protocol, "postgresql:");
  assert.equal(url.host, "nozomi.proxy.rlwy.net:24570");
  assert.equal(url.pathname, "/railway");
  assert(url.password);
  for (const key of [
    "ZENDESK_EMAIL",
    "ZENDESK_API_KEY",
    "ASSEMBLED_API_KEY",
    "ENTRA_CLIENT_SECRET",
    "ZENDESK_TALK_COLLECTION_POLICY",
    "ZENDESK_LEGACY_TALK_RESUME",
    "ZENDESK_OUTBOUND_POLICY",
    "ZENDESK_CSAT_POLICY",
    "ZENDESK_FIRST_REPLY_POLICY",
    "ZENDESK_INBOUND_REPORT_RELEASE",
    "ACTION_SHADOW_SOURCE_ID",
  ])
    assert(!process.env[key], "Vendor access/publication must be disabled");
  globalThis.fetch = async () => {
    throw Error("Network requests forbidden in rehearsal");
  };
  // Satisfy sync-service environment validation without obtaining sign-in credentials.
  process.env.AUTH_SECRET = "synthetic-local-publication-only-no-signin";
  const connection = postgres(url.toString(), { max: 1, onnotice: () => {} });
  const cache = globalThis as unknown as { _cadenceDb?: ReturnType<typeof drizzle<typeof schema>> };
  cache._cadenceDb = drizzle(connection, { schema });
  const source = "50000000-0000-4000-8000-000000000045";
  const definitions = [
    {
      key: "zendesk_tickets_solved_credits",
      name: "Tickets solved (Zendesk credit)",
      kind: "updater" as const,
      count: 3,
    },
    {
      key: "zendesk_assignee_solved_tickets",
      name: "Tickets solved (assigned)",
      kind: "assignee-solved" as const,
      count: 2,
    },
  ];
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
    const periods = [weekDates(1).periodStart, weekDates(0).periodStart];
    const keys = definitions.map((d) => d.key);
    const fingerprint = async () => {
      const rows =
        await connection`select to_jsonb(v) as value from metric_values v join metric_definitions d on d.id=v.metric_definition_id
        where not(v.employee_id=${employee} and d.key=any(${keys}::text[]) and v.period_start::text=any(${periods}::text[])) order by v.id`;
      return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    };
    const before = await fingerprint();
    stage = "synthetic catalog";
    await connection.begin(async (tx) => {
      const existing =
        await tx`select organization_id,configuration_reference,display_name from data_sources where id=${source}`;
      if (existing.length) {
        assert.equal(existing[0]!.organization_id, org);
        assert.equal(existing[0]!.configuration_reference, "zendesk-account:synthetic");
        assert.equal(existing[0]!.display_name, "Synthetic solved publication rehearsal");
      } else
        await tx`insert into data_sources(id,organization_id,type,display_name,status,configuration_reference)
        values(${source},${org},'zendesk','Synthetic solved publication rehearsal','configured','zendesk-account:synthetic')`;
      await tx`insert into external_identities(employee_id,data_source_id,external_id,external_entity_type,match_method)
        values(${employee},${source},'agent','agent','manual') on conflict do nothing`;
      for (const [index, definition] of definitions.entries()) {
        let defs =
          await tx`select id,unit,value_type,calculation_type,source_strategy,status from metric_definitions where organization_id=${org} and key=${definition.key}`;
        if (!defs.length)
          defs =
            await tx`insert into metric_definitions(organization_id,key,name,category,unit,value_type,calculation_type,source_strategy,direction)
          values(${org},${definition.key},${definition.name},'ticket','tickets','count','sum','zendesk','higher_is_better')
          returning id,unit,value_type,calculation_type,source_strategy,status`;
        assert.equal(defs.length, 1);
        const def = defs[0]!;
        for (const [field, value] of Object.entries({
          unit: "tickets",
          value_type: "count",
          calculation_type: "sum",
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
    const { createSolvedPublisher } =
      await import("../src/lib/connectors/zendesk-solved-publisher");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const config = { organizationId: org, dataSourceId: source };
    const results = [];
    for (const offset of [1, 0]) {
      const { periodStart, periodEnd } = weekDates(offset);
      for (const definition of definitions) {
        stage = `publish ${definition.kind} offset ${offset}`;
        const fixture = solvedPublicationFixture(config, employee, team);
        fixture.policy = { ...fixture.policy, kind: definition.kind, groupIds: [10] };
        const at = `${periodStart}T12:00:00Z`;
        const cutoff = new Date(Date.now() - 60000).toISOString();
        // The current-period fixture deliberately includes a verified numeric zero.
        const count = offset === 0 && definition.kind === "assignee-solved" ? 0 : definition.count;
        const snapshot = {
          ...fixture.snapshot,
          coverage: {
            start: `${periodStart}T00:00:00Z`,
            endExclusive:
              offset === 0
                ? cutoff
                : new Date(Date.parse(`${periodEnd}T00:00:00Z`) + 86400000).toISOString(),
            complete: true,
            ...(offset === 0 ? { asOf: cutoff } : {}),
          },
          tickets: Array.from({ length: count }, (_, i) => ({
            ...fixture.snapshot.tickets[0]!,
            id: 100 + i,
            solved_at: at,
          })),
          events: Array.from({ length: count }, (_, i) => ({
            ...fixture.snapshot.events[0]!,
            id: 1 + i,
            ticket_id: 100 + i,
            created_at: at,
            child_events: [
              { id: 1000 + i, event_type: "Change", status: "solved", previous_value: "open" },
            ],
          })),
        };
        const result = await runSync(
          createSolvedPublisher(fixture.policy, async () => ({
            snapshot,
            observationStartedAt: fixture.identity.observationStartedAt,
            identities: new Map([["agent", 42]]),
          })),
          config,
          { weekOffset: offset }
        );
        assert.equal(result.success, true, "Synthetic solved publication failed");
        stage = `readback ${definition.kind} offset ${offset}`;
        const values =
          await connection`select v.numeric_value,v.quality_status,v.provenance_json from metric_values v join metric_definitions d on d.id=v.metric_definition_id
          where v.employee_id=${employee} and d.key=${definition.key} and v.period_start=${periodStart} and v.period_end=${periodEnd}`;
        assert.equal(values.length, 1);
        assert.equal(values[0]!.numeric_value, count);
        assert.equal(values[0]!.quality_status, "complete");
        const context = values[0]!.provenance_json;
        assert.equal(
          context.sourceContract,
          definition.kind === "updater"
            ? "zendesk-qualified-updater-solved-credits-v1"
            : "zendesk-qualified-assignee-solved-tickets-v1"
        );
        if (offset === 0) assert.equal(context.reportingAsOf, cutoff);
        results.push({
          key: definition.key,
          periodStart,
          periodEnd,
          value: count,
          reportingAsOf: offset === 0 ? cutoff : null,
        });
      }
    }
    assert.equal(await fingerprint(), before, "Unrelated synthetic values changed");
    console.log(
      JSON.stringify({
        syntheticSolvedRehearsal: true,
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
          ? error.message.replace(/postgres(?:ql)?:\/\/\S+/g, "[redacted]").slice(0, 200)
          : undefined,
      databaseCode:
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        /^[0-9A-Z]{5}$/.test(String(error.code))
          ? String(error.code)
          : undefined,
    })
  );
  process.exitCode = 1;
});
