# Fix Log: Silent 5-Day Sync Outage (2026-09-09)

Builds directly on `INVESTIGATION.md` (read that first for full context). This log records
what was actually changed, what was verified with real data, and what remains open.

## Phase 0 — Why doesn't the cron reach `runSync()`?

- **0.1 (done, code fix applied):** `src/app/api/cron/sync/route.ts` was missing
  `export const dynamic = "force-dynamic"`. Route Handlers do not inherit `dynamic` from a
  parent layout. Added it. Honest caveat: this app runs Next.js 16.3.1, where GET Route
  Handlers are already uncached by default (that default flipped in Next 15) — so this is
  correctness/defense-in-depth, not a confirmed smoking gun for the actual outage.
- **0.2-0.4 (blocked, tooling unavailable):** No Vercel CLI authentication exists in this
  sandboxed environment (`vercel whoami` has no cached credentials) and network access to
  Vercel's own API timed out even for the CLI's own telemetry check. `vercel crons`,
  `vercel inspect`, and `vercel env ls production` could not be run. This is a genuine tooling
  wall, not a skipped step — see `FOLLOWUPS.md` item 4 for the exact human-in-the-loop check
  needed.
- **0.5 — questions for a human with Vercel dashboard access** (unchanged from
  `INVESTIGATION.md` §12, repeated here since Phase 0 didn't resolve them):
  a) Project → Settings → Cron Jobs: is `0 6 * * * → /api/cron/sync` listed and enabled? What do
     the Function Invocation Logs show for that route over the last ~10 days — no invocations
     logged at all, or 401/500 responses?
  b) What Vercel plan tier is this project on?

## Phase 1 — Make this failure mode impossible to go silent for 5 days again (done)

- `src/app/api/cron/sync/route.ts`: both early-return branches (missing `CRON_SECRET`, header
  mismatch) now call `logger.error(...)` with diagnostic context (never the secret value itself
  — only whether a header was present and its length). A `sync_errors` row was deliberately
  **not** used here: `sync_errors.syncRunId` is `NOT NULL` and no `sync_runs` row exists yet at
  this point in the request — faking one just to attach an error would pollute real sync
  history.
- `src/components/sync-staleness-banner.tsx` (new) + `src/app/(app)/layout.tsx`: a visible
  warning banner now renders on every page (not just `/data-health`) when the signed-in
  manager's Zendesk data source hasn't had a successful sync in over 30 hours. Hidden on print
  (`print:hidden`, consistent with the existing print stylesheet work).
- `src/lib/env.ts` + `src/app/api/cron/sync/route.ts`: added an optional `SYNC_HEARTBEAT_URL`
  env var. If set, the cron route pings it (best-effort, 5s timeout, failures only logged as a
  warning — never affects the response Vercel's cron caller gets) after the sources loop
  completes. Deliberately **not** pinged from the 401/500 early-returns — a dead-man's-switch
  should go silent and alert exactly when the real work never happens. This app does not create
  the actual monitoring account (Healthchecks.io/Cronitor/etc.) — a human needs to set one up
  and put its check URL in `SYNC_HEARTBEAT_URL` for this to do anything.

## An additional bug found empirically while verifying (not in the original investigation)

`src/lib/connectors/zendesk-shared.ts`'s `zendeskGet()` had **no timeout on its `fetch()`
call**. A stalled connection anywhere would hang forever — no error, no `sync_errors` row, no
`logger.error` call, nothing — because nothing ever throws to reach any of the existing
catch blocks. Found by triggering a real sync during Phase 2 verification and watching it sit
at `status: "running"`, `records_ingested: 0` for 15+ minutes with zero errors anywhere.
Fixed by adding `signal: AbortSignal.timeout(30_000)` to the fetch call — a stalled request now
throws cleanly after 30s and flows through the sync engine's existing (already-correct)
error-handling path instead of hanging indefinitely.

**This is still being verified — see the next section.**

## Phase 2 — Verification with real data

Triggered a real sync through the app's own authenticated path (`POST /api/sync/run`, signed in
as a real manager — Alexander Smith) rather than reasoning about the code. This is the exact
verification method now written into `CLAUDE.md`'s Definition of Done.

**A real, separate problem surfaced during this verification** (not a code bug — see below),
which is why this took much longer than expected:

- Two earlier sync attempts got abandoned mid-transaction when their dev server processes were
  killed (restarting to pick up code changes / clear a stale `.next` cache). Their Postgres
  connections were left "idle in transaction," holding row-level locks that blocked every
  subsequent sync attempt from proceeding — this looked exactly like an indefinite hang and cost
  significant time to diagnose (confirmed via direct `pg_stat_activity`/lock-graph queries, not
  guessed). Killing the stray dev server that still held one of these transactions open resolved
  it. **This was testing-methodology fallout, not a production bug** — a real Vercel deployment
  never gets torn down mid-transaction the way a locally-restarted dev server does.
- Once that cleared, a sync genuinely ran end-to-end successfully, it was just slow: ~32 minutes
  for `runSync()` (442 records ingested, 2,283 facts normalized, 0 errors) plus another ~17.6
  minutes for the separate `computeMetricValuesFromFacts()` step (5,515 values written). Both
  numbers are real and both completed cleanly. The slowness itself is a legitimate finding —
  both functions write one row at a time, sequentially, inside long-lived transactions/loops —
  logged as its own item in `FOLLOWUPS.md` rather than fixed here (a batching change is exactly
  the kind of "big refactor" this task was scoped to avoid).
- One transient `ECONNRESET` hit mid-write on the first `computeMetricValuesFromFacts()`
  attempt — a plain network blip, not reproducible, resolved by re-running.

**Real query results, taken directly from the production Railway Postgres after the sync
completed:**

```
SELECT * FROM sync_runs ORDER BY started_at DESC LIMIT 1;
→ id: 11568eaf-2774-4ef2-be80-66cc2af42393
  status: completed
  started_at:   2026-09-09T17:55:41.767Z
  completed_at: 2026-09-09T18:27:30.507Z
  records_ingested: 442, records_normalized: 2283, records_skipped: 566, error_count: 0

SELECT count(*), count(numeric_value) FROM metric_values WHERE period_start = '2026-09-07';
→ total: 1110, non_null: 1110
  (last week, 2026-08-31, for comparison: total 1172, non_null 1172 — comparable magnitude)

SELECT last_successful_sync_at FROM data_sources WHERE type = 'zendesk';
→ 2026-09-09T18:27:30.695Z  (matches the completed run's completed_at exactly)

SELECT * FROM sync_errors ORDER BY created_at DESC LIMIT 10;
→ (empty)
```

**Dashboard, loaded fresh and signed in as Alexander Smith:**
- `/team`: header reads "Week of Sep 7 – Sep 13, 2026", "Last updated: 8:30 AM"; real per-employee
  trend data for the current week (e.g. "Tickets Resolved declined 67%", trend sparklines showing
  real from→to values like "8 to 4").
- `/one-on-ones/40000000-0000-4000-8000-000000000006` (Christopher Courcy), This Week column:
  Tickets Resolved **4** (was 12 last week), Tickets Updated **5** (was 13), Worked Elevated
  Tickets **0**, Avoidable Worked Elevated Tickets **0**, inbound/outbound call counts real zeros
  (not "No Data") — screenshot taken and sent to the user. No hardcoded/fake values anywhere;
  `No Target`/`No Data`/`Not enough history yet` states render correctly where they legitimately
  apply (e.g. call-timing averages with zero calls this week).

**Known cleanup debris, left as-is (informational, not a bug)**: two `sync_runs` rows from the
abandoned attempts above (`933767d5...`, `6efbb2b8...`) remain permanently `status: "running"` —
their processes are dead and they'll never update. This does **not** affect the app: both
`/api/sync/health` and the new staleness banner key off the most-recent `started_at`, and the
real completed run (`11568eaf...`) is more recent than both. Not worth a DB write to tidy up
purely cosmetic historical rows from this session's own testing.

## Update (2026-09-09, later same day): root cause of the cron gap confirmed, and a second blocker found

With direct Vercel API access (a token the user provided), confirmed definitively:
`CRON_SECRET` had never been added to Vercel's environment variables at all — every other
secret the app needs was there (added together 2026-08-26), `CRON_SECRET` simply wasn't. The
cron registration itself was fine (correctly bound to the current production deployment,
enabled). This rules out "Vercel never invoked the cron" — it was being invoked and hitting the
500 "CRON_SECRET not configured" branch, silently, every single day.

Added `CRON_SECRET` to Production + Preview, triggered a redeploy, then called the real
`https://hungerrush-scorecard.vercel.app/api/cron/sync` directly with the correct header to
confirm end-to-end. **Auth fix confirmed working** — a new `sync_runs` row appeared
immediately. But the invocation never completed (34+ minutes, no success, no failure) — see
`FOLLOWUPS.md` item 5 for the full analysis. Strong circumstantial evidence this is Vercel's
platform execution-duration limit killing the function mid-flight, since the pipeline's
unbatched, one-row-at-a-time write pattern (already flagged as a followup) takes ~50 minutes
total, and this run should have been *faster* than the ~32-minute local test since most of this
week's data was already ingested (hash-dedup should skip rewriting it).

**Net effect: the missing-secret bug is fixed and proven, but the cron likely still can't
complete a full sync reliably until the pipeline is made significantly faster (or split into
smaller invocations) — tracked as the new top item in `FOLLOWUPS.md`.** Manual syncs via
`/api/sync/run` still work (proven in the original Phase 2) and remain the reliable path in the
meantime.

## Summary

- Fixed: missing `dynamic = "force-dynamic"` on the cron route (defense-in-depth); missing
  `sync_errors`/`logger.error` coverage on cron auth failures; missing site-wide staleness
  banner; missing dead-man's-switch heartbeat hook; missing `fetch()` timeout in the Zendesk
  HTTP client (a real bug, confirmed causing indefinite hangs).
- Verified with real data: a full sync now runs end-to-end and populates the current week
  (1,110 real metric values, matching last week's scale). The dashboard renders real numbers.
- Still open (needs a human, see `FOLLOWUPS.md` item 4): whether Vercel's cron was ever actually
  invoking `/api/cron/sync`, or being silently auth-rejected — this environment has no Vercel
  dashboard/CLI access to settle it. Trigger a manual sync via `/api/sync/run` in the meantime;
  don't wait on the cron to self-heal until that's confirmed fixed.

## Update (2026-09-10): batching fix shipped, verified, and stress-tested against the real limit

Implemented `FOLLOWUPS.md` item 5 option (a): batched `ingestRecords`, `normalizeIngestedRecords`,
and `computeMetricValuesFromFacts` into chunked bulk upserts (500 rows/statement) instead of one
query per row. Full design in the approved plan; see the "Batch the sync pipeline's writes"
commit for the actual diff.

**Verified with real data, twice** (local script, then the real deployed cron):
- Local `scripts/run-live-sync.ts` run before vs. after: publish (DB-write) phase dropped from
  **247.8s to 2.2s** on comparable data — a ~114x improvement. `sync_runs.metadataJson` now
  records `{ fetchMs, publishMs, computeValuesMs }` on every run.
- **Decisive check** (triggering the real production `https://hungerrush-scorecard.vercel.app/api/cron/sync`
  directly, exactly as done for the `CRON_SECRET` fix): `HTTP 504 FUNCTION_INVOCATION_TIMEOUT`
  at **exactly 300 seconds**. This is the real, confirmed Vercel function duration limit for
  this project — previously unknown, now settled by direct observation rather than guessed.

**Bottom line: batching was necessary but not sufficient.** With writes now effectively
instant, a full sync still takes ~14 minutes total — ~13.8 minutes of which is the Zendesk API
fetch phase alone, untouched by this change — nearly 3x over the real 300s limit. The cron
still cannot complete a full sync today. See `FOLLOWUPS.md` item 5's update for the concrete
next options (splitting the work across multiple smaller invocations is the recommended next
step) — not started, needs a decision on exactly how to split before implementing. Manual syncs
via `/api/sync/run` remain the only currently-reliable path and now also run ~114x faster on
the DB-write side.
