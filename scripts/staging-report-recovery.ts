/** Called only after staging-solved-publication's destination, ownership and credential guards. */
import assert from "node:assert/strict";
import { setTimeout as wait } from "node:timers/promises";
import type postgres from "postgres";
import { weekDates } from "../src/lib/utils";
import { solvedPublicationFixture } from "../src/__tests__/fixtures/solved-publication";
import {
  planReportRecovery,
  runLiveReportRecovery,
} from "../src/lib/connectors/zendesk-report-recovery";
import { requestReportJobs, REPORT_JOB_RECORD } from "../src/lib/connectors/zendesk-report-jobs";
import { parseSolvedRelease } from "../src/lib/connectors/zendesk-solved-publication-record";

export async function rehearseReportRecovery(input: {
  connection: ReturnType<typeof postgres>;
  org: string;
  source: string;
  employee: string;
  team: string;
  fingerprint: () => Promise<string>;
  before: string;
}) {
  const { connection, org, source, employee, team } = input;
  // A second guard prevents accidental direct use outside the approved rehearsal entry point.
  assert.equal(process.argv[2], "--apply");
  assert.equal(process.argv[3], "--recovery");
  assert.equal(process.env.VERCEL_ENV, "preview");
  assert.equal(process.env.VERCEL_GIT_COMMIT_REF, "codex/main-operational-upgrade");
  assert.equal(new URL(process.env.DATABASE_URL!).host, "nozomi.proxy.rlwy.net:24570");
  assert(!process.env.ZENDESK_API_KEY && !process.env.ZENDESK_REPORT_RECOVERY);
  const config = { organizationId: org, dataSourceId: source };
  const fixture = solvedPublicationFixture(config, employee, team);
  // Stricter than production's 24-hour age; enough for real five-minute source cooldowns.
  const releases = ["updater", "assignee-solved"].map((kind) =>
    parseSolvedRelease({
      ...fixture.policy,
      kind,
      groupIds: [10],
      maxObservationAgeSeconds: 3600,
    })
  );
  const collection = {
    scope: { ...config, accountReference: fixture.policy.accountReference },
    bootstrapStart: Date.parse("2026-09-26T00:00:00Z") / 1000,
  };
  const credentials = {
    subdomain: "synthetic",
    email: "source@example.invalid",
    apiKey: "synthetic-token",
  };
  const periods = [1, 0].map((offset) => ({ offset, ...weekDates(offset) }));
  const tickets = periods.flatMap(({ offset, periodStart }) => {
    const idBase = (Date.parse(periodStart) / 86400000) * 1000;
    return Array.from({ length: 3 }, (_, i) => ({
      ...fixture.snapshot.tickets[0]!,
      id: idBase + 100 + i,
      assignee_id: offset === 1 && i < 2 ? 42 : 99,
      solved_at: `${periodStart}T12:00:00Z`,
    }));
  });
  const events = periods.flatMap(({ periodStart }) => {
    const idBase = (Date.parse(periodStart) / 86400000) * 1000;
    return Array.from({ length: 3 }, (_, i) => ({
      ...fixture.snapshot.events[0]!,
      id: idBase + 1 + i,
      ticket_id: idBase + 100 + i,
      created_at: `${periodStart}T12:00:00Z`,
      child_events: [
        {
          id: idBase + 500 + i,
          event_type: "Change",
          status: "solved",
          previous_value: "open",
        },
      ],
    }));
  });
  let simulatedRequests = 0;
  globalThis.fetch = async (value, options) => {
    assert.equal(options?.method, "GET");
    assert.equal(options?.redirect, "error");
    const url = new URL(String(value));
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
    if (url.pathname === "/api/v2/incremental/ticket_events.json")
      return Response.json({
        ticket_events: events,
        count: events.length,
        end_time: Math.floor(Date.now() / 1000) - 120,
        end_of_stream: true,
        next_page: null,
      });
    if (url.pathname === "/api/v2/search/export.json") {
      const query = url.searchParams.get("query") ?? "";
      const lower = /solved>=(\d{4}-\d{2}-\d{2})/.exec(query)?.[1];
      const upper = /solved<=(\d{4}-\d{2}-\d{2})/.exec(query)?.[1];
      assert(lower && upper);
      assert(query.includes("assignee:42"));
      return Response.json({
        results: tickets
          .filter(
            (t) =>
              t.assignee_id === 42 &&
              t.solved_at.slice(0, 10) >= lower &&
              t.solved_at.slice(0, 10) <= upper
          )
          .map(({ id }) => ({ id })),
        meta: { has_more: false },
        links: { next: null },
      });
    }
    if (url.pathname === "/api/v2/tickets/show_many.json") {
      const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number);
      const selected = tickets.filter((t) => ids.includes(t.id));
      assert.equal(selected.length, ids.length);
      return Response.json({
        tickets: selected,
        metric_sets: selected.map(({ id, solved_at }) => ({ ticket_id: id, solved_at })),
      });
    }
    throw Error("Unexpected synthetic recovery request");
  };
  const plan = planReportRecovery(collection, releases);
  const requestedAt = new Date().toISOString();
  // Explicit manual synthetic demand, so a repeated rehearsal tests this build too.
  // This does not reset a cursor, a lease, source cooldown or an existing retry deadline.
  await requestReportJobs(
    collection.scope,
    plan.requests.map((r) => ({ ...r, desiredAt: requestedAt }))
  );
  const policyHashes = plan.currentPolicyHashes;
  const receipts: unknown[] = [];
  let completed = false;
  const start = Date.now();
  for (let tick = 0; tick < 24 && Date.now() - start < 1800000; tick++) {
    const result = await runLiveReportRecovery(collection, releases, credentials);
    receipts.push({ tick, ...result });
    console.log(JSON.stringify({ syntheticRecoveryTick: tick, ...result }));
    assert.notEqual(
      result.status,
      "failed",
      "Synthetic dispatcher failed; inspect retained job rather than resetting it"
    );
    assert.equal(
      await input.fingerprint(),
      input.before,
      "Recovery changed unrelated metric values"
    );
    const rows =
      await connection`select payload_json from source_records where data_source_id=${source} and external_record_type=${REPORT_JOB_RECORD}`;
    const active = rows
      .map((r) => r.payload_json)
      .filter((s) => policyHashes.includes(s.definition.policyHash));
    assert.equal(active.length, plan.requests.length);
    assert(active.every((s) => s.accountReference === fixture.policy.accountReference));
    completed = active.every(
      (s) => s.completedThrough && Date.parse(s.completedThrough) >= Date.parse(requestedAt)
    );
    if (completed) break;
    // Wait for real persisted database deadlines, never edit clocks or bypass production pacing.
    const [latest] =
      await connection`select max(started_at) as started_at from sync_runs where data_source_id=${source}`;
    const sourceReadyAt = latest?.started_at ? new Date(latest.started_at).getTime() + 301000 : 0;
    const pending = active.filter(
      (s) => !s.completedThrough || Date.parse(s.completedThrough) < Date.parse(requestedAt)
    );
    const nextJobAt = Math.min(
      ...pending.map((s) =>
        Math.max(Date.parse(s.notBefore), s.lease ? Date.parse(s.lease.expiresAt) : 0)
      )
    );
    // The first handoff deliberately exercises retained collector pacing; a skipped
    // publication remains queued and cannot claim completed employee observations.
    const resumeAt = Math.max(Date.now() + 1000, sourceReadyAt, nextJobAt);
    while (Date.now() < resumeAt) {
      assert(Date.now() - start < 1800000, "Synthetic recovery exceeded its bounded rehearsal");
      await wait(Math.min(60000, resumeAt - Date.now()));
      console.log(
        JSON.stringify({
          syntheticRecoveryWaiting: true,
          elapsedSeconds: Math.round((Date.now() - start) / 1000),
        })
      );
    }
  }
  assert(completed, "Synthetic recovery did not finish within its bounded rehearsal");
  const values =
    await connection`select d.key,v.period_start::text,v.period_end::text,v.numeric_value,v.quality_status,v.provenance_json
    from metric_values v join metric_definitions d on d.id=v.metric_definition_id
    where v.employee_id=${employee} and d.key in ('zendesk_tickets_solved_credits','zendesk_assignee_solved_tickets')
    and v.period_start::text=any(${periods.map((p) => p.periodStart)}::text[]) order by d.key,v.period_start`;
  assert.equal(values.length, 4);
  for (const row of values) {
    const current = row.period_start === periods[1]!.periodStart;
    const expected = row.key === "zendesk_tickets_solved_credits" ? 3 : current ? 0 : 2;
    assert.equal(row.numeric_value, expected);
    assert.equal(row.quality_status, "complete");
    if (current) assert(row.provenance_json.reportingAsOf);
  }
  const settled = await runLiveReportRecovery(collection, releases, credentials);
  assert.equal(
    settled.status,
    "idle_or_deferred",
    "Duplicate tick must not redo acknowledged work"
  );
  console.log(
    JSON.stringify({
      syntheticReportRecoveryRehearsal: true,
      completePersistedDispatcherPath: true,
      sourceCooldownsBypassed: false,
      vendorRequests: 0,
      productionWrites: 0,
      simulatedRequests,
      requestedJobs: plan.requests.length,
      receipts,
      results: values.map((r) => ({
        key: r.key,
        periodStart: r.period_start,
        value: r.numeric_value,
      })),
      unrelatedValuesUnchanged: true,
      duplicateTickDidNoWork: true,
      elapsedSeconds: Math.round((Date.now() - start) / 1000),
    })
  );
}
