/** Synthetic publication rehearsal; exact isolated Preview only, no vendor access. */
import "./assert-main-preview.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../src/lib/db/schema";
import { weekDates } from "../src/lib/utils";
import { solvedPublicationFixture } from "../src/__tests__/fixtures/solved-publication";

async function main() {
  assert.equal(process.argv[2], "--apply");
  assert.equal(process.argv.length, 3);
  globalThis.fetch = async () => {
    throw Error("Network forbidden in synthetic rehearsal");
  };
  process.env.AUTH_SECRET = "synthetic-publication-rehearsal-no-signin";
  const connection = postgres(process.env.DATABASE_URL!, { max: 1, onnotice: () => {} });
  const cache = globalThis as unknown as { _cadenceDb?: ReturnType<typeof drizzle<typeof schema>> };
  cache._cadenceDb = drizzle(connection, { schema });
  const source = "50000000-0000-4000-8000-000000000059";
  const key = "zendesk_agent_update_events";
  try {
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
    const periods = [weekDates(2).periodStart, weekDates(1).periodStart, weekDates(0).periodStart];
    const fingerprint = async () => {
      const rows =
        await connection`select to_jsonb(v) as value from metric_values v join metric_definitions d on d.id=v.metric_definition_id
        where not(v.employee_id=${employee} and d.key=${key} and v.period_start::text=any(${periods}::text[])) order by v.id`;
      return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
    };
    const before = await fingerprint();
    await connection.begin(async (tx) => {
      const sources =
        await tx`select organization_id,configuration_reference,display_name from data_sources where id=${source}`;
      if (sources.length) {
        assert.equal(sources[0]!.organization_id, org);
        assert.equal(sources[0]!.configuration_reference, "zendesk-account:synthetic");
        assert.equal(sources[0]!.display_name, "Synthetic agent update rehearsal");
      } else
        await tx`insert into data_sources(id,organization_id,type,display_name,status,configuration_reference)
        values(${source},${org},'zendesk','Synthetic agent update rehearsal','configured','zendesk-account:synthetic')`;
      const identities =
        await tx`select employee_id,external_id from external_identities where data_source_id=${source}`;
      if (identities.length) {
        assert.equal(identities.length, 1);
        assert.equal(identities[0]!.employee_id, employee);
        assert.equal(identities[0]!.external_id, "agent");
      } else
        await tx`insert into external_identities(employee_id,data_source_id,external_id,external_entity_type,match_method)
        values(${employee},${source},'agent','agent','manual')`;
      let defs =
        await tx`select id,unit,value_type,calculation_type,source_strategy,status from metric_definitions where organization_id=${org} and key=${key}`;
      if (!defs.length)
        defs =
          await tx`insert into metric_definitions(organization_id,key,name,category,unit,value_type,calculation_type,source_strategy,direction)
        values(${org},${key},'Agent update events','ticket','updates','count','sum','zendesk','higher_is_better') returning id,unit,value_type,calculation_type,source_strategy,status`;
      assert.equal(defs.length, 1);
      const def = defs[0]!;
      for (const [field, value] of Object.entries({
        unit: "updates",
        value_type: "count",
        calculation_type: "sum",
        source_strategy: "zendesk",
        status: "active",
      }))
        assert.equal(def[field], value);
      const assignments =
        await tx`select employee_id,role_key,effective_from,effective_to from metric_assignments where metric_definition_id=${def.id} and team_id=${team}`;
      if (!assignments.length)
        await tx`insert into metric_assignments(metric_definition_id,team_id,display_order,effective_from) values(${def.id},${team},2,${periods[0]!})`;
      else {
        assert.equal(assignments.length, 1);
        assert.equal(assignments[0]!.employee_id, null);
        assert.equal(assignments[0]!.role_key, null);
        assert.equal(assignments[0]!.effective_to, null);
      }
    });
    const { createAgentUpdatePublisher } =
      await import("../src/lib/connectors/zendesk-agent-update-publisher");
    const { runSync } = await import("../src/lib/connectors/sync-engine");
    const config = { organizationId: org, dataSourceId: source };
    const results = [];
    for (const offset of [2, 1, 0]) {
      const { periodStart, periodEnd } = weekDates(offset);
      const f = solvedPublicationFixture(config, employee, team);
      const policy = {
        ...f.policy,
        kind: "agent-updates" as const,
        groupIds: [10],
        effectivePeriodStart: periods[0]!,
      };
      const cutoff = new Date(Date.now() - 120000).toISOString();
      const at = `${periodStart}T00:00:01Z`;
      const idBase = (Date.parse(periodStart) / 86400000) * 1000;
      const count = offset === 2 ? 4 : offset === 1 ? 7 : 0;
      const snapshot = {
        ...f.snapshot,
        coverage: {
          start: `${periodStart}T00:00:00Z`,
          endExclusive:
            offset === 0
              ? cutoff
              : new Date(Date.parse(`${periodEnd}T00:00:00Z`) + 86400000).toISOString(),
          complete: true,
          ...(offset === 0 ? { asOf: cutoff } : {}),
        },
        events: Array.from({ length: count }, (_, i) => ({
          ...f.snapshot.events[0]!,
          id: idBase + i + 1,
          created_at: at,
          child_events: [],
        })),
        tickets: f.snapshot.tickets.map((t) => ({ ...t, solved_at: at })),
      };
      const makePublisher = () =>
        createAgentUpdatePublisher(policy, async () => ({
          snapshot,
          identities: new Map([["agent", 42]]),
          observationStartedAt: f.identity.observationStartedAt,
        }));
      for (let replay = 0; replay < 2; replay++) {
        const result = await runSync(makePublisher(), config, {
          period: { periodStart, periodEnd },
        });
        assert.equal(result.success, true, "Synthetic update publication failed");
      }
      const values =
        await connection`select v.numeric_value,v.quality_status,v.provenance_json from metric_values v join metric_definitions d on d.id=v.metric_definition_id
        where v.employee_id=${employee} and d.key=${key} and v.period_start=${periodStart} and v.period_end=${periodEnd}`;
      assert.equal(values.length, 1);
      assert.equal(values[0]!.numeric_value, count);
      assert.equal(values[0]!.quality_status, "complete");
      assert.equal(
        values[0]!.provenance_json.sourceContract,
        "zendesk-qualified-agent-update-events-v1"
      );
      if (offset === 0) assert.equal(values[0]!.provenance_json.reportingAsOf, cutoff);
      results.push({
        periodStart,
        periodEnd,
        count,
        idempotent: true,
        currentCutoff: offset === 0 ? cutoff : null,
      });
    }
    assert.equal(await fingerprint(), before, "Unrelated synthetic metric values changed");
    console.log(
      JSON.stringify({
        syntheticAgentUpdatePublication: true,
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
main().catch(() => {
  console.error("Synthetic agent-update rehearsal failed; no production access.");
  process.exitCode = 1;
});
