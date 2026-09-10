# Follow-ups

Issues found while fixing the 2026-09-09 silent sync outage (see `INVESTIGATION.md` and
`FIX_LOG.md`) that are deliberately **not** fixed as part of that work — logged here per
CLAUDE.md's Definition of Done ("a fix that surfaces unrelated problems logs them here rather
than bundling unrelated fixes into the same change").

## 1. `csat_score` is broken (Zendesk data limitation, not a pipeline bug)

`src/lib/connectors/zendesk.ts:404-406`. Per the 2026-09-01 metric-integrity audit,
`/satisfaction_ratings.json` returned 0 results in every window tested against the real
account — classified as a Zendesk source/API limitation, not a connector bug. See
`INVESTIGATION.md` §6. Worth a fresh live check once the sync is confirmed healthy again, to
see if it's still returning zero results — but that's a separate investigation, not a fix to
bundle here.

## 2. Talk API fetch fragility — shared try/catch across all 4 weeks

`src/lib/connectors/sync-engine.ts:67-88` wraps the entire 4-week fetch loop in one try/catch.
A failure in any single week's fetch (especially week 0's Talk call fetch, which is
structurally the heaviest — see `INVESTIGATION.md` §4) aborts the whole run, discarding
already-fetched data for the other weeks. Confirmed NOT the cause of the 2026-09-09 incident
(§10 of `INVESTIGATION.md`), but it's a real, separate risk. Fixing it means restructuring the
fetch-then-publish contract to fail per-week rather than per-run — a medium-risk change to core
sync architecture, not a small patch. Scope as its own task.

## 3. Single-Zendesk-subdomain assumption — needs a human, not a code fix

`src/lib/connectors/zendesk-shared.ts:14-17`'s `baseUrl()` only supports one
`ZENDESK_SUBDOMAIN`. Whether the real HungerRush Zendesk account is single- or
multi-brand/subdomain is unconfirmed by any code or doc in this repo (`INVESTIGATION.md` §8).
**Action item for a human**: confirm with Zendesk admin access. If multi-brand, some
tickets/calls could be silently invisible to this connector regardless of any sync-scheduling
fix.

## 4. Whether Vercel is actually invoking `/api/cron/sync` on schedule — still open

Phase 0 of the fix work (see `FIX_LOG.md`) could not be fully resolved: this sandboxed
environment has no cached Vercel CLI authentication and network access to Vercel's own API
timed out, so `vercel crons`/`vercel env ls production` could not be run. **Needs a human with
Vercel dashboard access** to check: is the `0 6 * * *` cron for `/api/cron/sync` listed and
enabled under Project → Settings → Cron Jobs, and what do the Function Invocation Logs show for
that route over the last ~10 days (no invocations at all vs. 401/500 responses)? See
`INVESTIGATION.md` §12 items 1-3 for the exact questions.

## 5. Sync pipeline is too slow to finish inside one serverless invocation — now confirmed URGENT

**Updated 2026-09-09, after the `CRON_SECRET` fix was deployed and tested live.** What started
as "worth batching eventually" is now a confirmed second production blocker, separate from the
missing-secret bug:

- `CRON_SECRET` was added to Vercel (Production + Preview) and a fresh deployment picked it up.
  Triggering the real `https://hungerrush-scorecard.vercel.app/api/cron/sync` endpoint directly
  confirmed the auth fix works — a new `sync_runs` row (`41efb235-...`) appeared immediately,
  proving the request now correctly reaches `runSync()`.
- That invocation was still `status: "running"` with zero completion **34+ minutes later**, with
  no `sync_errors` row and no transition to `"failed"` — the same signature seen locally when a
  process running `runSync()` gets killed out from under it (an abandoned mid-transaction
  connection, not a code path that ran to any kind of finish, success or caught exception).
  This run should have been **faster** than the ~32-minute local test, since this week's
  tickets/calls were already mostly ingested by an earlier manual sync (hash-dedup in
  `ingestRecords` should skip rewriting unchanged records) — yet it still didn't finish.
  Strong circumstantial evidence (not proof — Vercel's runtime/lambda invocation logs were not
  accessible via the API endpoints tried) that Vercel's platform-level execution limit is
  killing the function mid-flight, even with Fluid Compute enabled on this project
  (`resourceConfig.fluid: true`, confirmed via the Projects API).
- Root cause of the slowness itself (unchanged from before): `runSync()`'s publish phase and
  the separate `computeMetricValuesFromFacts()` step each write one row at a time, sequentially,
  inside a single long-lived transaction/loop, with no batching. A local, direct (non-HTTP) run
  took ~32 minutes for `runSync` (2,283 facts) plus ~17.6 minutes for
  `computeMetricValuesFromFacts` (5,515 values) — ~50 minutes total, all of which needs to fit
  inside one cron invocation today since the route calls both steps sequentially before
  responding.

**This needs a real decision, not a guessed patch** — options, roughly cheapest to most
involved:
  a) **Batch the writes.** Multi-row `INSERT ... VALUES (...), (...), ...` (or
     `unnest()`-based bulk upserts) instead of one query per fact/value in both
     `normalizeIngestedRecords` (`sync-engine.ts`) and `computeMetricValuesFromFacts`
     (`compute-values.ts`). Could plausibly bring total runtime down from ~50 minutes to well
     under whatever the actual platform limit is. Doesn't touch the fetch phase (still bound by
     however long ~260+ sequential Zendesk API calls take).
  b) **Split the work across multiple invocations.** E.g. a separate cron per week-offset, or
     tickets and calls as separate cron jobs, so no single invocation has to do all 4 weeks +
     calls + normalize + compute in one shot.
  c) **Move off the request/response model.** Vercel's `waitUntil` for background work after
     responding is still bound by the same underlying function lifetime limits for anything
     substantial — a real fix here likely means a proper background job/queue rather than a
     single HTTP-triggered function, which is a bigger architectural change.
  d) Confirm the actual configured/effective function duration limit for this specific
     project+plan (Fluid Compute changes the numbers, and this wasn't confirmed precisely — the
     Vercel dashboard's Deployment → Function detail view, or Vercel support, can give an exact
     answer) — worth doing before picking (a)/(b)/(c), since if the real limit turns out to be
     generous enough, (a) alone might already be sufficient.

## Update (2026-09-10): (a) shipped and verified, (d) now definitively confirmed — (a) alone is NOT enough

**Option (a) is done.** `ingestRecords`, `normalizeIngestedRecords`, and `computeMetricValuesFromFacts`
are all now batched (chunked bulk upserts, 500 rows/statement, via Drizzle's `excluded.*`
pattern — see the "Batch the sync pipeline's writes" commit). Verified against real production
data: the publish (DB-write) phase dropped from **247.8s to 2.2s** on the same data — a ~114x
improvement, DB writes are now effectively instant. `sync_runs.metadataJson` now records
`{ fetchMs, publishMs, computeValuesMs }` on every run going forward, closing the
fetch-vs-publish measurement gap this item originally flagged.

**Option (d) is now answered directly, not inferred.** Triggered the real deployed
`https://hungerrush-scorecard.vercel.app/api/cron/sync` after the batching fix shipped:
`HTTP 504`, body `FUNCTION_INVOCATION_TIMEOUT`, at **exactly 300 seconds**. That is the real,
confirmed function duration limit for this project (Fluid Compute is enabled but evidently caps
at 5 minutes here, not higher).

**Net result: batching alone does not fix the timeout.** With writes now effectively free, a
full sync still takes **~14 minutes total, ~13.8 of which is the Zendesk API fetch phase alone**
(confirmed via `metadataJson.fetchMs` on a real run) — nearly 3x over the real 300s limit, and
this change never touched the fetch phase. **Options (b) split-the-work and (c)
background-job-model are no longer "maybe needed later" — one of them is now required** to
actually close this out. (b) is the more incremental next step (e.g. one cron per week-offset,
or tickets/calls as separate invocations, so no single invocation does more than ~1-2 minutes of
fetching) — not started, needs a decision on exactly how to split before implementing.

## Update (2026-09-10, later same day): (b) shipped for week-offset — works today, but week 0 has thin margin

Implemented option (b): `runSync()` now accepts `weekOffset`, and `vercel.json` fires 4
staggered cron legs (`?week=0..3`, 15 min apart) instead of one 4-week sweep. The manual
"Sync Now" button also now defaults to `weekOffset: 0` (current week only), since it shares the
same `runSync()` and was equally exposed to the 300s limit. See the "Split the sync into
one-week-per-invocation legs" commit.

**Verified live**: Vercel accepted and registered all 4 cron entries against the current
deployment (Hobby-plan cron-count-cap risk did **not** materialize — confirmed via the Projects
API, `crons.definitions` lists all 4). Triggered `?week=0` directly (the expected heaviest leg,
per the Talk-calls-trickle behavior in §4/`INVESTIGATION.md`):

```
HTTP 200, ELAPSED: 282.0s
sync_runs.metadata_json: { fetchMs: 259374, publishMs: 1372, computeValuesMs: 5876, weekOffset: 0 }
```

**It completed successfully — but with only ~18 seconds of total margin under the 300s limit**
(week 0's fetch phase alone is 259.4s, 86% of the whole budget, before publish/compute/roster
overhead). This is exactly the scenario the plan flagged as a possible outcome, now confirmed
with real data rather than assumed either way.

**Weeks 1-3 have not yet been triggered/verified** — the 5-minute `isSyncRateLimited` cooldown
(keyed per data source, not per week) meant back-to-back manual triggers of week=1 right after
week=0 would just get skipped as rate-limited, and there wasn't a natural pause to wait through
during this session. They are expected to be meaningfully faster than week 0 (completed weeks
terminate the Talk-calls fetch quickly, per `INVESTIGATION.md` §4) but this is **not yet proven
with real numbers** — the next session (or tomorrow's actual 6:00/6:15/6:30/6:45 UTC scheduled
runs) should confirm via the same `metadata_json` query pattern used above.

**Bottom line: the fix works today, but week 0 has essentially no safety margin.** Any added
load — a bad Zendesk rate-limiting day, growing ticket/agent volume over time, roster discovery
taking longer than usual — could push week 0 back over 300s. Recommended follow-up, not done
here: split week 0 further (e.g. its Talk-calls fetch as its own invocation, separate from its
ticket search), the exact scenario the plan's "Known open risk" section anticipated. Worth
doing proactively rather than waiting for it to fail again.

## Update (2026-09-10, next session): stale local CRON_SECRET copy found and rotated

While trying to manually trigger `?week=1`/`?week=2`/`?week=3` to get the still-missing weeks
1-3 verification numbers (see previous entry), the real deployed cron endpoint returned
`HTTP 401 Unauthorized` using the `CRON_SECRET` value in local `.env`.

Confirmed via the Vercel Projects API this was **not** a new production problem: the deployment
serving `hungerrush-scorecard.vercel.app` is the correct, current one (matches `HEAD`), and
`CRON_SECRET` on Vercel had never been rotated (`updatedAt == createdAt`, set 2026-09-09
20:27:29 UTC, one-time, via the dashboard). Local `.env` was last written 2026-09-09 20:14:56
UTC — 13 minutes *before* that — so the copy saved to `.env` simply never matched what was
actually set on Vercel. This didn't affect the real scheduled cron itself: Vercel auto-attaches
its own `CRON_SECRET` value as the `Authorization` header on cron-triggered requests, which is
why this morning's real 06:xx UTC cron run authenticated fine — it only blocked *manual*
triggering from outside using the stale local file.

Since a "sensitive"-type Vercel env var can never be read back (not even from the dashboard,
by design), recovering the original value wasn't possible either way. With the user's
explicit go-ahead, rotated it: generated a new 48-char hex secret, set it as `CRON_SECRET`
(production) via the Vercel API, and updated local `.env` to match. A redeploy is required for
Vercel to actually apply a changed env var to the running functions — this commit's push
serves that purpose, same as every other fix this week.

No practical fallout for scheduled runs: the next cron legs aren't until tomorrow's
6:00/6:15/6:30/6:45 UTC window, well after this deploy lands, and Vercel always sends whichever
value it currently holds — old or new — so the real cron was never at risk of failing from this.
Manual `?week=1/2/3` triggering resumes once this deployment is live.

## Update (2026-09-10, later same day): weeks 1-3 verified, and the thin-margin fix targeted the wrong bottleneck

With the rotated secret, all 4 weeks were triggered manually for real, closing out the item
above. **All 4 were in the danger zone, not just week 0**:

| Week | fetchMs | Total wall time | Margin under 300s |
|------|---------|------------------|---------------------|
| 0 | 259,374 | ~282.0s | ~18s |
| 1 | 294,614 | ~296.0s | **~4s** |
| 2 | 251,932 | ~253.2s | ~47s |
| 3 | 254,428 | ~255.6s | ~44s |

Week 1 nearly 504'd outright. Since completed weeks (1-3) were just as slow as the in-progress
week (0), the previous entry's theory — "the in-progress week never signals `end_of_stream`
so it always burns its full 50-page cap" — couldn't be the whole story, since that shouldn't
apply to already-completed weeks.

**The theory was wrong. Verified directly against the real Zendesk API** (not just docs):
`end_of_stream` never appears in a real response at all (confirmed empirically, not just from
Zendesk's docs — dead code, always `undefined`), and Talk endpoints are rate-limited to 10
req/min. That looked like a strong candidate for the real cause, but instrumenting
`fetchCallsForWeek` (page count, 429 count, backoff wait — see the "Add diagnostics to the Talk
calls fetch" commit) and re-running week=1 for real disproved it immediately: **11 pages, 42.5s,
zero 429s, zero backoff.** The calls fetch was never the problem.

Extending the same instrumentation to the rest of `fetchRecords` (see "Add phase timing to
fetchRecords" commit) found the real breakdown for a 198.7s fetch phase:

| Phase | Time | Share |
|---|---|---|
| Ticket search (84 employees, sequential) | 98.8s | 50% |
| Metric sets (batched by 100 ticket IDs) | 65.8s | 33% |
| Record build (84 sequential `resolveNumericId` calls) | 26.3s | 13% |
| Ratings + Talk calls | 7.6s | 4% |

84 external identities for this data source means both the ticket-search loop and the
`resolveNumericId` calls in record-building are ~84 sequential Zendesk requests each, one
employee at a time, with zero concurrency — the actual bottleneck.

**Fixed** (see "Parallelize per-employee Zendesk fetches" commit): both loops now run with
bounded concurrency (5 at a time, via a new `mapWithConcurrency` helper), leaning on
`zendeskGet`'s existing 429 retry/backoff as the safety net since neither endpoint's real rate
limit is confirmed in this codebase (only Talk's 10/min is documented). **Verified live,
before/after, same weeks**:

| | Week 0 (before → after) | Week 1 (before → after) |
|---|---|---|
| Ticket search | — | 98.8s → 35.5s |
| Record build | — | 26.3s → 6.4s |
| fetchMs | 259.4s → 157.0s | 198.7s → 148.9s |
| Total wall time | 282.0s → 168.7s | 207.8s → 158.0s |
| Margin under 300s | ~18s → ~131s | ~4s → ~142s |

Weeks 2-3 weren't re-verified under the fix (already had more margin pre-fix, and the fix isn't
week-conditional) — worth a quick check if margin ever looks tight again.

**Not done, deliberately out of scope for this change**: `fetchMetricSets` is now the single
largest remaining phase (65.8-75.6s, ~45% of fetchMs) — the same class of problem (a sequential
loop, this time over 100-ticket-ID batches instead of employees), not yet parallelized. Current
margin (~130-140s) is comfortable without it, but it's the obvious next target if that ever
tightens up again.
