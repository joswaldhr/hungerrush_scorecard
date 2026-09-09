# Investigation: "This Week" empty across scorecard metrics, no auto-update

Status: COMPLETE — fixed, see FIX_LOG.md
Started: 2026-09-09
Finished: 2026-09-09
Scope: READ-ONLY. No code changes, no Zendesk writes, no DB writes, no triggering
the sync job. This file is a running checklist — findings are filled in as each
section completes.

**Update (2026-09-09, same day): fixed and verified with real data — see `FIX_LOG.md`.** The
current-week gap this file diagnosed is closed (a real sync now populates real data). The exact
Vercel-side cause of the cron gap (§10/§12) is still unconfirmed — that needs Vercel dashboard
access this environment doesn't have; see `FOLLOWUPS.md` item 4.

**TL;DR for anyone skimming**: The metrics pipeline itself is not broken. No sync — cron or
manual — has run since 2026-09-04 21:16 UTC (5 days before this was written), so there is
simply no data yet for the current week. The code proves this: `runSync()` always writes a
`sync_runs` row before doing anything else, and there hasn't been a new one in 5 days (not even
a failed one), which rules out an in-flight failure and points at the cron either not being
invoked by Vercel at all, or being silently rejected by the `CRON_SECRET` auth check before it
ever reaches the sync logic (§10). This needs Vercel dashboard access to pin down exactly which
(§12, item 1) — outside what a read-only repo/DB investigation can see.

---

## 0. Can we actually verify anything live?
- [x] Attempted one real, read-only Zendesk API call
- Result: **SUCCESS.** `GET https://{ZENDESK_SUBDOMAIN}.zendesk.com/api/v2/account/settings.json`
  using the credentials in the local `.env` (`ZENDESK_EMAIL` / `ZENDESK_API_KEY`) returned
  `HTTP 200 OK` with a real `settings` object (`branding`, `apps`, `tickets`, `agents`, `groups`
  keys present). Credentials are valid and the Zendesk API is reachable from this environment
  right now.
- Evidence: one-off script run via `npx tsx --env-file=.env <scratchpad>/zendesk-live-check.mjs`
  (script not committed to the repo; lives only in this session's scratchpad dir). Raw output:
  `{"ok":true,"status":200,"statusText":"OK","bodySnippet":"{\"hasSettings\":true,\"brandKeys\":[\"branding\",\"apps\",\"tickets\",\"agents\",\"groups\"]}"}`
- Implication: **all later sections can be verified against the real Zendesk account, not just
  inferred from code.** This does NOT yet confirm the *scheduled/production* job uses the same
  credentials successfully — only that these specific local `.env` credentials work right now.

## 1. Provenance of "Last Week"'s numbers
- [x] Determined whether last week's values came from a scheduled run, a
      one-off manual script, or seeded data
- **Finding: manual/dev testing, not a scheduled run — and nothing has synced in 5 days.**
- Evidence (all via direct read-only `SELECT` against the real production Railway Postgres,
  connection string from `.env`; DB server `now()` confirmed as `2026-09-09 16:50:08+00`):
  - `metric_values` schema (`src/lib/db/schema.ts:257-290`) has `calculatedAt`, `dataFreshnessAt`,
    `createdAt` — no `updatedAt`.
  - `SELECT period_start, count(*), count(numeric_value) FROM metric_values WHERE period_start IN ('2026-09-07','2026-08-31') GROUP BY 1` →
    **only one group returned**: `period_start=2026-08-31` (last week), 1,157 rows, all 1,157 with
    a non-null `numeric_value`, `max(calculated_at) = 2026-09-04 22:02:52 UTC`.
    **Zero rows exist anywhere for `period_start = 2026-09-07` (this week) — for any employee, any metric.**
  - A dedicated sync-history table exists: `sync_runs` (`schema.ts:354-375`) and `sync_errors`
    (`schema.ts:377-392`). `SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 20` returned
    **all 7 rows that have ever existed**, all `status=completed`, `error_count=0`:
    ```
    2026-09-04 21:16:05
    2026-09-03 20:24:15
    2026-09-03 19:33:16
    2026-09-02 21:01:30
    2026-09-02 20:40:56
    2026-09-02 17:05:26
    2026-09-02 16:58:13
    ```
    All 7 cluster in 16:58–21:49 UTC (afternoon/evening) across three consecutive calendar days
    (Sep 2–4) — this is the signature of manual "Sync Now" clicks during setup/testing, **not**
    an automated daily job (the cron is scheduled for `06:00 UTC`, and none of the 7 are anywhere
    near that hour). `sync_errors` has 0 rows ever.
  - `source_records` and `normalized_facts` confirm the gap is at **ingestion**, not aggregation:
    `source_records` has 252 rows for both 2026-08-24 and 2026-08-31 weeks, **zero** for
    2026-09-07. Same pattern in `normalized_facts` (1093/1157 rows for the two prior weeks, none
    for this week). The aggregation step (`computeMetricValuesFromFacts`) has nothing to bug out
    on — there's simply no raw data yet.
  - `data_sources.last_successful_sync_at` for the Zendesk source = `2026-09-04 21:49:13 UTC`,
    matching the last `sync_runs` row exactly.
  - **Conclusion: nothing has synced — via any path, scheduled or manual — since 2026-09-04
    21:16 UTC, which is 5 days before this investigation (2026-09-09). This is not "hasn't run
    yet for the current week, will self-correct" — the pipeline has been silently idle for 5 days
    despite the app being live and deployed through at least 2026-09-08.**

## 2. Environment & secrets
- [x] Located where Zendesk credentials are stored
- [x] Confirmed (or could not confirm) the scheduled job uses the same
      credentials/environment as local dev
- **Finding: credentials are plain env vars, valid locally (§0); whether Vercel Production has
  them (esp. `CRON_SECRET`) is the single biggest open question — and a mismatch would fail
  completely silently.**
- Evidence:
  - `src/lib/env.ts:3-32` (Zod schema) — `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_KEY`,
    `ASSEMBLED_API_KEY` all declared `.optional()`. `CRON_SECRET` also `.optional()` at the Zod
    level (line 31), but the comment above it (lines 28-30) says the route itself enforces it.
  - Local `.env` has `CRON_SECRET`, `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_KEY` all
    present (values not inspected/printed — presence only).
  - `src/app/api/cron/sync/route.ts:12-20`:
    ```ts
    if (!env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    ```
    **Neither the 500 nor the 401 branch logs anything or writes a `sync_errors`/`sync_runs`
    row** — the only place those tables get written is deeper in the file, past this auth check.
    So if Vercel's cron hits this route and it 401s/500s, there is **no trace of it anywhere
    this app can show you** — it would only appear in Vercel's own Function invocation logs,
    which are outside this investigation's access.
  - `src/app/api/sync/run/route.ts:12-16` — the **manual** "Sync Now" action authenticates via
    `auth()` (NextAuth session) + `getEffectiveManagerContext`, i.e. requires a logged-in
    manager. This is almost certainly how the 7 existing `sync_runs` rows were produced.
  - **Not verifiable from this repo/DB**: whether `CRON_SECRET` (or the Zendesk vars) are
    actually set correctly in Vercel's *Production* environment — that requires Vercel
    dashboard/API access, out of scope for a read-only repo+DB investigation. Flagged as the
    top item for a human to check next (see §12).

## 3. Stack & scheduling infrastructure
- [x] Enumerated every place a recurring job could be defined, and whether
      each is actually deployed/active
- **Finding: exactly one scheduling mechanism exists (Vercel Cron via `vercel.json`), it's
  committed and has been part of every deploy for ~10 days, but there is no direct evidence it
  has ever actually fired.**
- Evidence:
  - `vercel.json` (repo root), verbatim:
    ```json
    { "crons": [ { "path": "/api/cron/sync", "schedule": "0 6 * * *" } ] }
    ```
    Tracked in git (not gitignored). Introduced in commit `819e326` ("Phase 16: scheduled sync
    via Vercel Cron", 2026-08-30), still present at `HEAD` (`1722c68`, 2026-09-08) — part of
    every deploy since.
  - `.github/workflows/ci.yml` is the only workflow file — triggers on `push`/`pull_request`
    only, no `on: schedule`. It runs typecheck/lint/migrate/test/build against an ephemeral CI
    Postgres container and never calls any sync endpoint. Not related to this incident.
  - Repo-wide grep for `node-cron`, `cron-job`, `EventBridge`, `Sidekiq`, `Celery`, `agenda` —
    **zero matches**. Vercel Cron is the *only* scheduler anywhere in the codebase.
  - **What can't be confirmed from the repo/DB alone**: whether Vercel has actually registered
    and fired this cron entry in production. The DB evidence (§1) is consistent with it never
    having fired successfully — 10 days since the cron config landed, zero `sync_runs` rows near
    `06:00 UTC`, zero rows of any kind in the last 5 days. Needs the Vercel dashboard (Cron Jobs
    settings + Function Logs for `/api/cron/sync`) to confirm one way or the other.

## 4. Zendesk integration inventory — Ticketing vs Talk
- [x] Ticketing API path documented (endpoint, pagination, rate limits)
- [x] Talk API path documented (endpoint, pagination, rate limits)
- [x] Webhook presence checked
- **Finding: all Zendesk data arrives via polling, not webhooks. Both API paths are correctly
  built and have no early-cutoff bug — but the current-week Talk fetch is structurally far more
  fragile than any other week's fetch (see §5 for why this matters, and §10 for why it's ruled
  out as the cause of the *current* incident specifically).**
- Evidence:
  - **Webhooks:** repo-wide grep for "webhook" — the only match in the entire codebase is this
    investigation file's own checklist line. No incoming-webhook API route exists anywhere.
    `src/app/api/**` contains only pull-based routes (`cron/sync`, `sync/run`, `sync/health`,
    `reconciliation/run`, `reconciliation/results`, `health`, `client-error`,
    `auth/[...nextauth]`). **All Zendesk data arrives via polling** — daily cron (`0 6 * * *`
    UTC) or a manual "Sync Now" click.
  - **Ticketing API** — Zendesk **Search API**, `GET /search.json` (`zendesk.ts:129`,
    `searchAllPages`, called at `zendesk.ts:342,348`). Exact query strings:
    ```
    type:ticket assignee:${email} updated>=${periodStart} updated<=${periodEnd}
    type:ticket assignee:${email} status<solved   // "backlog", current week only
    ```
    Filters on Zendesk's **`updated`** field (not `created_at`/`solved_at`) for the weekly set;
    `created_at` is only used client-side afterward to bucket already-fetched tickets for the
    handle-time/response-time averages. `MAX_WEEKS_BACK = 4` (`zendesk.ts:17`), enforced at
    `zendesk.ts:322-324`. `searchAllPages` has **no early-stop condition** — it loops purely on
    `res.next_page` until Zendesk returns `null`; no code-side pagination bug found.
  - **Talk API** — `fetchCallsForWeek()` (`zendesk.ts:183-203`), endpoint
    `GET /channels/voice/stats/incremental/calls.json?start_time={epoch}` (a forward-only cursor
    export, no `end_time` param). Full stop-condition logic, quoted verbatim:
    ```ts
    while (path && pages < 50) {
      const res = await zendeskGet<ZendeskCallsResponse>(path);
      pages++;
      let allPastWindow = res.calls.length > 0;
      for (const call of res.calls) {
        if (new Date(call.created_at).getTime() <= endTime) { calls.push(call); allPastWindow = false; }
      }
      if (res.end_of_stream || allPastWindow) break;
      path = res.next_page;
    }
    return calls;  // unconditional — NOT gated on end_of_stream having been seen
    ```
    Confirmed directly (not inferred): the function returns whatever it accumulated regardless
    of *why* the loop exited (`end_of_stream`, `allPastWindow`, or the 50-page cap) — there is
    **no** all-or-nothing gate on `end_of_stream`.
  - **Why the current week is structurally different**: for a completed week (`weeksAgo>=1`),
    `endTime` (that week's Sunday 23:59:59 UTC) is in the past, so `allPastWindow` reliably
    becomes `true` once the export scrolls past it — a fast, clean stop. For the **current**
    week (`weeksAgo=0`), `endTime` is in the *future*, so `allPastWindow` can essentially never
    trip, and per project history Zendesk Talk's `end_of_stream` never turns `true` for an
    in-progress week either (it trickles single new records once caught up to "now"). **The only
    thing that can stop the current-week loop is the 50-page hard cap** — meaning the
    current-week Talk fetch is, every single sync run, the one guaranteed-heaviest, most
    fragile sub-fetch (up to 50 sequential API calls, every time). This is a real structural
    weak point worth hardening (see §11), but §10 explains why it is **not** what's causing the
    present 5-day gap.
  - **Multi-brand**: `zendesk-shared.ts:14-17`'s `baseUrl()` builds the API host from a single
    `ZENDESK_SUBDOMAIN` env var — this is the only place a Zendesk host is constructed anywhere
    in the connector. **The connector assumes exactly one Zendesk subdomain/instance**, with no
    per-brand looping and no reference to Zendesk's native multi-brand API (`/api/v2/brands`)
    anywhere in the connector. Whether the real HungerRush Zendesk account is actually
    provisioned with multiple brands/subdomains is **not resolved by the code or docs** — flagged
    as an open question (§12), independent of the current incident.

## 5. Diff Last Week vs This Week (highest-signal test)
- [x] Found the exact code path for a working "Last Week" metric
- [x] Traced what happens when the same logic runs for "This Week"
- **Finding: the date/timezone/filter logic is identical for both weeks — the divergence is not
  in the metric-computation code at all, it's that no sync has run to populate the current week
  (see §1 and §10).**
- Evidence:
  - Three independent, hand-written implementations of week math exist and were compared
    line-by-line: `weekOf(weeksAgo)` (`zendesk.ts:115-125`, used by the connector/sync),
    `weekDates(weeksAgo)` (`src/lib/utils.ts:8-29`, used by `/team`), and `periodDates(key)`
    (`one-on-ones/[id]/page.tsx:33-55`, used by the 1:1 page). All three use the **identical**
    formula — Monday-start, Sunday-end, computed entirely in **UTC**
    (`getUTCDay()`/`setUTCDate()`, never local time):
    ```js
    const dayOfWeek = now.getUTCDay();
    monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7) - weeksAgo * 7);
    // sunday = monday + 6 days; both formatted as "YYYY-MM-DD"
    ```
    This rules out "the sync writes to a different `periodStart` than the UI queries for" as a
    cause — confirmed by direct comparison, not inferred.
  - Caveat found via code comment: two *more* reimplementations exist —
    `scripts/run-reconciliation.ts`'s private `weekDates()` and inline arithmetic in the mock
    connectors (`zendesk-mock.ts`/`assembled-mock.ts`) — which use **local server time**, not
    UTC (flagged in `src/__tests__/week-dates.test.ts:1-8` and the 2026-09-01 metric-integrity
    audit doc). Confirmed via `src/lib/connectors/index.ts:4-5` and `cron/sync/route.ts:4` that
    the live cron path imports the **real** `ZendeskConnector`, not the mock — so this
    local-time divergence does **not** affect the live bug; it's a dormant risk confined to
    dev/test fixtures and the standalone CLI reconciliation script.
  - The "Last Week" code path (ticket search, `zendesk.ts:341-361`) and the "This Week" code
    path are the **exact same function**, just invoked with `weekOffset=1` vs `weekOffset=0` —
    there is no separate/forked logic for the current week in the ticket-fetch code. The only
    place current-week behavior structurally diverges is the Talk call fetch (§4) — which, per
    §10, is not what's currently empty-handed here (that would still leave a DB trace; none
    exists).

## 6. Per-metric mapping
- [x] All 16 metrics mapped to file/line + status
- Evidence (keys confirmed verbatim from `src/lib/fixtures/seed.ts:471-753`):

| Metric key | Computed at | Status |
|---|---|---|
| `tickets_resolved` | `zendesk.ts:359-361` → `zendesk.ts:467-479` | Working when sync runs; empty-this-week because the sync hasn't run (§10), not a metric bug |
| `tickets_updated` | `zendesk.ts:392` → `zendesk.ts:480-493` | Same |
| `worked_elevated_tickets` | `zendesk.ts:378` + `isElevatedTicket()` `zendesk.ts:251-253` → `zendesk.ts:536-549` | Same (implemented; an older planning doc's "Definition Required" note is stale) |
| `avoidable_worked_elevated_tickets` | `zendesk.ts:379-381` + `isAvoidableElevation()` `zendesk.ts:259-261` → `zendesk.ts:550-563` | Same |
| `avg_handle_time` | `zendesk.ts:367-371` (`full_resolution_time_in_minutes.business`) → `zendesk.ts:494-507` | Same (POS only) |
| `avg_response_time` | `zendesk.ts:372-374` (`reply_time_in_minutes.business`) → `zendesk.ts:508-521` | Same (Menufy only); null on 0 tickets created that week, by design |
| `csat_score` | `zendesk.ts:404-406` → `zendesk.ts:598-611` | **Separately broken**, unrelated to this incident: per the 2026-09-01 metric-integrity audit, `/satisfaction_ratings.json` returned 0 results in every window tested against the real account — classified as a Zendesk source/API limitation, not a pipeline bug. Not re-verified live in this pass — still worth a fresh check once the sync gap is fixed. |
| `inbound_calls_offered` | `aggregateCalls()` `zendesk.ts:217` → `zendesk.ts:568,581-595` | Working when sync runs; see §4 for why this week's fetch is structurally the most fragile |
| `inbound_calls_accepted` | `zendesk.ts:218` | Same |
| `inbound_calls_abandoned_on_hold` | `zendesk.ts:219-220` | Same |
| `avg_talk_time_inbound` | `zendesk.ts:221` | Same (null on 0 calls, by design) |
| `avg_hold_time_inbound` | `zendesk.ts:222` | Same |
| `avg_call_duration_inbound` | `zendesk.ts:223` | Same |
| `avg_consultation_time_inbound` | `zendesk.ts:224-225` | Same (null unless a consulted call exists) |
| `outbound_calls` | `zendesk.ts:226` | Same |
| `outbound_calls_completed` | `zendesk.ts:227` | Same |
| `outbound_calls_non_answered` | `zendesk.ts:228` (`completion_status==="failed"`) | Same |
| `avg_talk_time_outbound` | `zendesk.ts:229` | Same |
| `avg_hold_time_outbound` | `zendesk.ts:230` | Same |

  All 12 call metrics share one upstream fetch (`fetchCallsForWeek`) and one aggregator
  (`aggregateCalls`, `zendesk.ts:211-232`) called once per week — they succeed or fail
  **together**, per week, which matches "This Week" being empty for all of them simultaneously
  while "Last Week" is fine for all of them simultaneously.
  - Normalize step (`normalizeRecords`, `zendesk.ts:457-615`): a **zero-activity** week, if a
    sync actually ran, produces **real zeros** for count-based metrics (ticket/call counts are
    pushed unconditionally, no null-guard: `zendesk.ts:468-479,536-563,581-595`) — only the
    average-based metrics (`avgHandleTime`, `avgResponseTime`, backlog, call averages) are
    individually guarded with `!= null` checks and legitimately produce no row when there's
    nothing to average, by design. `computeMetricValuesFromFacts()`
    (`compute-values.ts:11-98`) has **no special-case logic for "current" vs "complete"
    periods** — it aggregates whatever `normalizedFacts` exist for a period; a period with zero
    facts simply produces no `metricValues` row. **A "completely empty" current week (not even
    real zeros) is therefore only possible if no `normalizedFacts` exist at all for that week**
    — which traces upstream to the sync not having published anything (§10), not to a
    compute-layer bug.

## 7. Presentation-layer caching
- [x] Checked for ISR/SSG/CDN/client caching in front of the dashboard
- **Finding: caching is ruled out entirely — the root layout forces fully dynamic rendering,
  and there is genuinely no data in the DB for this week (per §1), so there's nothing for a
  cache to be hiding.**
- Evidence:
  - `src/app/layout.tsx:7` — `export const dynamic = "force-dynamic";` at the root layout,
    cascading to every route including `one-on-ones/[id]/page.tsx` and `team/page.tsx`. Neither
    page sets its own `revalidate`/`dynamic`/`unstable_cache` — both query the DB directly via
    Drizzle on every request, no `fetch()` involved.
  - Repo-wide grep for `export const revalidate`, `unstable_cache`, `fetchCache` — no matches.
    Only cache-adjacent hits anywhere are `revalidatePath()` calls in the admin roster actions,
    scoped to `/admin/...` and `/team` after roster edits — unrelated to metric freshness.
  - `next.config.ts:39-48` only sets security headers (CSP/HSTS/etc.) — no caching/ISR config.

## 8. Multi-brand / multi-instance check
- [x] Confirmed single vs multi-brand Zendesk setup and sync coverage
- **Finding: the connector only supports a single Zendesk subdomain, and whether that's actually
  sufficient for the real HungerRush account is unresolved by code/docs — needs a human to
  confirm with Zendesk admin access.**
- Evidence: `zendesk-shared.ts:14-17`'s `baseUrl()` is the only place a Zendesk API host is ever
  constructed, built from one `ZENDESK_SUBDOMAIN` env var. No brand-looping, no
  `/api/v2/brands` reference, anywhere in `zendesk.ts`/`zendesk-shared.ts`. The POS-vs-Menufy
  split in this app is handled as **two teams/tagging-conventions within one Zendesk account**
  (`isElevatedTicket`/`isAvoidableElevation`, `zendesk.ts:246-261`), not as two brands or two
  subdomains — but nothing in the codebase or docs confirms whether the live HungerRush Zendesk
  instance is in fact single-subdomain. See §12.

## 9. Observability & test coverage gap
- [x] Checked for error monitoring/alerting on the sync job
- [x] Checked for existing tests on the metrics pipeline
- **Finding: both gaps are real and total. There is no error monitoring anywhere in this app,
  and no test exists that would have caught this specific failure mode.**
- Evidence:
  - `package.json` deps/devDeps contain no `@sentry/*`, Datadog, Logtail, PostHog, or comparable
    APM/error-monitoring SDK. Repo-wide case-insensitive grep for
    `sentry|datadog|logtail|posthog` — zero matches anywhere. **No error-monitoring/alerting
    integration exists in this app, period.**
  - `src/lib/logger.ts:9-27` — "logger" is `console.{debug,info,warn,error}` wrapping a JSON
    payload; persists nowhere beyond whatever Vercel retains in its own function logs. Combined
    with §2's finding (cron auth failures don't even call this logger), the only place a human
    could see sync health today is `src/app/api/sync/health/route.ts` (reads
    `dataSources`/`syncRuns`/`syncErrors`, auth-gated) — a pull-based page someone has to
    remember to open, not a push alert.
  - `src/__tests__/` has 12 files. `connectors.test.ts` only exercises
    `ZendeskMockConnector.normalizeRecords`/`.healthCheck` — it does **not** touch
    `src/lib/connectors/sync-engine.ts`'s `runSync()`, the real `ZendeskConnector`, or either API
    route. Grepping all of `src/__tests__/` for `sync-engine|cron|/api/sync|runSync` — **zero
    matches**. **No test exists for the sync orchestration logic or either sync API route** —
    nothing would have caught a regression in the exact auth/scheduling path implicated here.

## 10. Root cause hypothesis
- [x] Written, with confidence level and evidence

### The gap is upstream of `runSync()` even being invoked — HIGH confidence

I read `src/lib/connectors/sync-engine.ts` and `src/app/api/cron/sync/route.ts` directly (in
full) to reconcile two candidate mechanisms the research passes surfaced, and one of them is
now ruled out by the code's own structure, not just by absence of evidence:

**`runSync()` (`sync-engine.ts:52-56`) inserts a `sync_runs` row with `status: "running"`
immediately, before any Zendesk network call is made.** Its fetch phase is wrapped in a
try/catch (`sync-engine.ts:67-88`) that swallows any error (including an exception from the
current week's fragile Talk fetch, §4) and sets `success = false` — execution then **always**
continues to the unconditional checkpoint block at the end (`sync-engine.ts:149-162`), which
updates that same row to `status: "failed"` (or `"completed"`) no matter what happened in
between. **There is no code path inside `runSync()` that fails without leaving a `sync_runs`
row, whether "running"-stuck, "failed", or "completed".**

§1 found **zero new `sync_runs` rows of any status since 2026-09-04 21:16 UTC**, and confirmed
all 7 rows that exist are `status: "completed"` — none stuck at "running", none "failed". Given
the guarantee above, **this proves `runSync()` has not been invoked at all in the last 5 days**
— not "invoked and failed inside the fetch phase." That rules out §4's current-week Talk-fetch
fragility as the cause of *this* incident (it's still a real, separate structural weakness worth
fixing — see §11 — it's just not what's producing the present symptom).

I also checked `src/lib/rate-limit.ts:5,10-16`: the sync cooldown is only **5 minutes**
(`SYNC_COOLDOWN_MS = 5 * 60 * 1000`), and it only blocks a new run if a `sync_runs` row
`startedAt` is within that 5-minute window. Since the most recent row is 5 *days* old, rate
limiting cannot be silently skipping every cron attempt either — ruled out.

That leaves exactly two candidates upstream of `runSync()`, both of which return before ever
touching `sync_runs` and therefore look **identical** from the DB's perspective (zero trace
either way) — this is why the distinction can't be settled from this repo/DB alone:

1. **Vercel is not actually invoking `GET /api/cron/sync` on schedule.** `vercel.json`'s
   `crons` entry is committed and has shipped in every deploy since 2026-08-30 (§3), but nothing
   in the repo can confirm Vercel's platform has registered/enabled it for this project, or that
   it's firing.
2. **It is being invoked, but rejected before reaching `runSync()`.**
   `cron/sync/route.ts:13-20` returns `500` if `env.CRON_SECRET` isn't set, or `401` if the
   request's `Authorization` header doesn't exactly match `Bearer {CRON_SECRET}` — and **neither
   branch logs anything or writes to `sync_errors`** (confirmed by reading the route: no
   `logger.error` or DB write exists in either early-return). A `CRON_SECRET` that's unset,
   stale, or mismatched between Vercel's Production env and what the route expects would produce
   exactly this symptom: daily silent 401s, forever, invisible anywhere in this app.

**Confidence: high that the failure is one of these two (pre-`runSync()`), based on direct code
reading of the exact functions involved, not inference. Confidence split roughly 50/50 between
options 1 and 2 without Vercel dashboard access — see §12, this is the single most important
open question.**

### Contributing/secondary findings (real, but not the cause of the 5-day gap)
- **No observability on any of this** (§9): even once the primary cause is found, nothing today
  would alert a human to a 5-day silent sync outage — it was only caught by a manager visually
  noticing an empty column.
- **The current-week Talk API fetch is structurally the most fragile part of every sync run**
  (§4): once the primary issue is fixed, this remains a real latent risk — a bad day on that
  fetch (rate limit exhaustion, network blip during a ~50-page march) would abort ticket data for
  *all* weeks in that run too, because one shared `try/catch` wraps the whole 4-week fetch loop
  and week 0 is always fetched first.
- **`csat_score` is separately broken** (§6) for reasons unrelated to this incident (a Zendesk
  API/data limitation found in a prior audit) — don't conflate a fix for the sync gap with a fix
  for CSAT; they're independent problems.

## 11. Proposed fix options (not implemented)
- [x] 2-3 options listed with files touched, risk, effort

**A. Confirm and fix the cron invocation/auth gap (do this first).**
Files/systems: Vercel project dashboard (Settings → Cron Jobs, and Function Invocation Logs for
`/api/cron/sync`), Vercel Production environment variables (`CRON_SECRET`, and the three
`ZENDESK_*` vars while checking). No code change likely required — this is almost certainly an
ops/config fix (set or correct `CRON_SECRET` in Vercel Production so it matches what the route
expects, and/or enable the cron job for the project if it's disabled). Risk: low — read-only
checks first, then a config change with no code touched. Effort: small, but requires Vercel
dashboard access this investigation doesn't have. Once fixed, a manual trigger of
`/api/sync/run` (or waiting for the next `06:00 UTC` cron) should immediately populate this
week's data — no backfill logic needed, per §5's confirmation that the date math has no
current-week special case.

**B. Add minimal observability so this can't go undetected for 5 days again.**
Files: `src/app/api/cron/sync/route.ts` (log/record the 401/500 early-return cases, not just
downstream errors — e.g. write a `sync_errors` row or at least a `logger.error` call before
returning), plus either a simple external uptime/heartbeat check (e.g. a monitoring service
pinging `/api/sync/health` daily) or surfacing "last successful sync" staleness prominently in
the existing `/data-health` page (check whether it already does — if it only shows the last
`sync_runs` row without flagging "this is N days stale," that's a small, targeted addition).
Risk: low, additive only. Effort: small.

**C. Harden the current-week Talk API fetch so a bad day can't zero out the whole run.**
Files: `src/lib/connectors/sync-engine.ts` (the fetch-phase loop, `sync-engine.ts:67-88`) and/or
`src/lib/connectors/zendesk.ts` (`fetchRecords`, around the per-week loop). Change the single
shared `try/catch` around all 4 weeks so a failure in one week's fetch (especially week 0's
heavier Talk call) doesn't discard already-fetched data for the other 3 weeks — e.g. catch
per-week and continue, only marking the run `"failed"`/partial for the week(s) that actually
errored. Risk: medium — touches the core fetch-then-publish contract described in
`sync-engine.ts`'s own header comment, needs care to preserve the "no partial data visible on
failure" guarantee for whichever week *did* fail, while still publishing the weeks that
succeeded. Effort: medium. Lower urgency than A/B since §10 shows this isn't the current cause,
but worth doing before it silently causes a similar-looking incident on a day the cron is
otherwise working.

## 12. Open questions
- [x] Listed

1. **(Highest priority)** Is Vercel actually invoking `GET /api/cron/sync` on the
   `0 6 * * *` schedule for this project? Check Vercel dashboard → Project → Settings → Cron
   Jobs (is it listed/enabled?) and → Deployments → Functions → Invocation Logs for
   `/api/cron/sync` over the last ~10 days. Look specifically for `401`/`500` responses (auth
   rejection, matches hypothesis 2 in §10) versus no invocations logged at all (matches
   hypothesis 1).
2. Is `CRON_SECRET` set in Vercel's **Production** environment, and does it match what a request
   from Vercel's own cron infrastructure would send? (This app's route expects an exact
   `Authorization: Bearer {CRON_SECRET}` match — Vercel's cron feature sends this automatically
   using the env var of the same name, so a mismatch would most likely mean the var is missing,
   was rotated in one place but not the other, or differs between environments/branches.)
3. Is this Vercel project on a plan/tier where Cron Jobs are fully enabled? (Some plans have
   historically restricted cron scheduling granularity or required an explicit opt-in per
   project — worth a quick dashboard check even though `vercel.json` alone looks correct.)
4. Does the real HungerRush Zendesk account use a single subdomain, or multiple
   brands/subdomains? (§4, §8) — the connector only supports one `ZENDESK_SUBDOMAIN`; if the
   account is multi-brand/multi-subdomain, some tickets/calls could be systematically invisible
   regardless of the sync-scheduling issue. Needs a Zendesk admin to confirm.
5. Is `csat_score` still returning 0 results from `/satisfaction_ratings.json` against the real
   account today? (§6) — last confirmed broken in a 2026-09-01 audit; worth a fresh, isolated
   check once the main sync gap is fixed, since it's an independent problem.
6. Once A (§11) is fixed and a sync runs successfully: does the current-week Talk fetch actually
   complete within Vercel's function execution time limit? The 50-page cap (§4) means it's the
   heaviest single sub-fetch in the whole pipeline — worth confirming it doesn't hit a platform
   timeout on a real run, which would produce a *different* silent failure mode than the one
   diagnosed here.
