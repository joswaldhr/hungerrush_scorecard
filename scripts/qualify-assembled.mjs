/** Explicit read-only diagnostic; never invoke from app builds, cron or tests. */
import assert from "node:assert/strict";
import { writeFile, access, open, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import postgres from "postgres";
import {
  createAssembledReader,
  readPeople,
  matchRoster,
  recordMap,
  inspectActivities,
} from "./lib/assembled-readonly.mjs";

let stage = "preflight";
async function main() {
  const output = path.resolve(process.argv[2] ?? "");
  assert.equal(path.dirname(output), path.resolve("docs/audits"));
  assert(output.endsWith(".json"));
  await access(output).then(
    () => {
      throw new Error("output_exists");
    },
    () => {}
  );
  const url = new URL(process.env.DATABASE_URL ?? "");
  assert.equal(url.hostname, "metro.proxy.rlwy.net");
  assert.equal(url.port, "57223");
  assert.equal(url.pathname, "/railway");
  const reader = createAssembledReader(process.env.ASSEMBLED_API_KEY);
  const lockPath = path.join(os.tmpdir(), "cadence-assembled-qualification.lock");
  const lock = await open(lockPath, "wx");
  const sql = postgres(url.toString(), {
    max: 1,
    ssl: "require",
    connection: { default_transaction_read_only: true, statement_timeout: 15_000 },
  });
  try {
    stage = "database_inventory";
    const database = await sql.begin("read only isolation level repeatable read", async (tx) => {
      const [mode] = await tx`select current_setting('transaction_read_only') as mode`;
      assert.equal(mode.mode, "on");
      await tx`set local timezone='UTC'`;
      const employees =
        await tx`select e.email, replace(t.slug,'-support','') as team from employees e
        join teams t on t.id=e.primary_team_id and t.organization_id=e.organization_id
        where e.employment_status='active' and t.slug in ('menufy-support','pos-support') order by t.slug,e.id`;
      const assignments = await tx`select d.key,t.slug as team,d.unit,d.source_strategy,
        count(*)::int as assignments
        from metric_assignments a join metric_definitions d on d.id=a.metric_definition_id
        left join teams t on t.id=a.team_id
        where (a.effective_from is null or a.effective_from<=current_date-extract(dow from current_date)::int)
        and (a.effective_to is null or a.effective_to>current_date-extract(dow from current_date)::int)
        group by d.key,t.slug,d.unit,d.source_strategy order by d.key,t.slug`;
      const unassigned = await tx`select d.key from metric_definitions d where d.status='active'
        and not exists(select 1 from metric_assignments a where a.metric_definition_id=d.id
          and (a.effective_from is null or a.effective_from<=current_date-extract(dow from current_date)::int)
          and (a.effective_to is null or a.effective_to>current_date-extract(dow from current_date)::int)) order by d.key`;
      return { employees, assignments, unassigned };
    });
    assert(database.employees.length > 0 && database.employees.length <= 200);
    stage = "roster";
    const people = await readPeople(reader);
    const roster = matchRoster(database.employees, people);
    stage = "activity_types";
    const typePayload = await reader.get("activity_types");
    const types = recordMap(typePayload.activity_types);
    // Fixed discovery windows. Current-week sample ends at the current day's Central
    // midnight, so future planned shifts are not mistaken for elapsed observations.
    const windows = [
      { start: "2026-09-13T05:00:00Z", end: "2026-09-20T05:00:00Z", mode: "closed" },
      { start: "2026-09-20T05:00:00Z", end: "2026-09-27T05:00:00Z", mode: "closed" },
      { start: "2026-09-27T05:00:00Z", end: "2026-09-29T05:00:00Z", mode: "partial-current" },
    ];
    const samples = [];
    for (const team of ["menufy", "pos"]) {
      const sample = roster.matches.find((m) => m.employee.team === team);
      if (!sample) continue;
      for (const window of windows) {
        const start = Date.parse(window.start) / 1000;
        const end = Date.parse(window.end) / 1000;
        stage = "activity_sample";
        const payload = await reader.get("activities", {
          start_time: start,
          end_time: end,
          agents: sample.person.agent_id,
          include_agents: false,
          include_activity_types: false,
        });
        samples.push({
          team,
          ...window,
          ...inspectActivities(
            payload,
            sample.person.agent_id,
            start,
            end,
            typePayload.activity_types
          ),
        });
      }
    }
    const report = {
      observedAt: new Date().toISOString(),
      readOnly: true,
      databaseWrites: 0,
      vendorWrites: 0,
      reportGenerationRequests: 0,
      rawRecordsPersisted: false,
      sourceSupport: "retired",
      api: reader.stats(),
      roster: { returned: people.length, paginationComplete: true, teams: roster.summary },
      inventory: {
        keys: new Set(database.assignments.map((a) => a.key)).size,
        assignments: database.assignments.reduce((n, a) => n + a.assignments, 0),
        rows: database.assignments,
        unassigned: database.unassigned,
      },
      activityTypes: {
        count: types.length,
        productive: types.filter((t) => t.productive === true).length,
        timeoff: types.filter((t) => t.timeoff === true).length,
      },
      timeZone: "America/Chicago",
      samples,
      limitations: [
        "One matched employee per team is sampled; schedule availability does not establish all-employee coverage.",
        "Current mappings do not establish historical membership, employment eligibility or Zendesk platform identity agreement.",
        "No API version override is sent; an absent response version leaves pinned version unverified.",
        "Activity rows are planned time, not proof of attendance, adherence, human ticket actions or handling effort.",
        "No schedule sum is certified: account activity mappings, layer semantics, exclusions and independent report comparison remain open.",
        "No Assembled report was generated or retrieved; adherence and effort report qualification remains open.",
      ],
    };
    await writeFile(output, JSON.stringify(report, null, 2) + "\n", { flag: "wx" });
    console.log(
      JSON.stringify({
        inventory: { keys: report.inventory.keys, assignments: report.inventory.assignments },
        roster: report.roster,
        api: report.api,
        activityTypes: report.activityTypes,
        samples,
      })
    );
  } finally {
    await sql.end();
    await lock.close();
    await unlink(lockPath);
  }
}
main().catch((error) => {
  const codes = [
    "invalid_roster_total",
    "roster_changed_during_read",
    "invalid_record_map",
    "invalid_roster_page",
    "duplicate_or_missing_person_id",
    "unknown_deleted_status",
    "roster_count_overflow",
    "premature_roster_end",
    "roster_page_budget_exhausted",
    "read_failed",
    "missing_api_key",
  ];
  const reason =
    codes.includes(error?.message) || /^http_\d{3}$/.test(error?.message ?? "")
      ? error.message
      : "guard_or_query_failed";
  console.error(JSON.stringify({ stage, reason, writes: 0, rawRecordsLogged: false }));
  process.exitCode = 1;
});
