# Follow-ups

Issues found while fixing the 2026-09-09 silent sync outage (see `INVESTIGATION.md` and
`FIX_LOG.md`) that are deliberately **not** fixed as part of that work — logged here per
CLAUDE.md's Definition of Done ("a fix that surfaces unrelated problems logs them here rather
than bundling unrelated fixes into the same change").

## Current state (as of 2026-09-21 — read this table first, then the detailed items below)

This file mixes "found and fixed inline" narratives with genuinely-still-open items, in
roughly chronological (not numeric) order — this table exists so you don't have to read all
17 items to find the live ones.

| # | Item | Status | Needs |
|---|---|---|---|
| 1 | `csat_score` broken | Open (Zendesk data limitation) | Fresh live re-check (last checked 2026-09-01) |
| 2 | Talk-fetch shared try/catch fragility | Open | Real code fix (medium risk) — already caused incident #6 |
| 3 | Single-Zendesk-subdomain assumption | Open | Human w/ Zendesk admin access |
| 4 | Is Vercel invoking the cron? | **Resolved** — see #5/#7 | Nothing; fold into #7 |
| 5 | Sync pipeline too slow for one invocation | **Fixed** (batching + per-week split) | Nothing |
| 6 | Departed-employee ticket volume crashed syncs | **Fixed** 2026-09-15 | Nothing |
| 7 | Cron legs fire late (Hobby-plan behavior) | Not a bug | Nothing |
| 8 | Roster candidates re-proposed forever | **Fixed** 2026-09-15 | Nothing |
| 9 | Christopher Courcy (POS) counted as employee | **Resolved 2026-09-16** — a `departed` roster candidate for him was approved and `employees.employment_status` is `inactive` (confirmed live 2026-09-21). This item's "still open, needs Alex" framing below is stale. | Nothing |
| 10 | `fetchMetricSets` not parallelized | Open, low urgency | Proactive perf work; margin still comfortable |
| 11 | Weeks 2-3 re-verified post-fix | **Done** | Nothing |
| 12 | Phase 4 security audit | **Done** — 2 critical Next.js CVEs patched | Nothing |
| 13 | Phase 5 performance audit | **Done** — no bottleneck found | Nothing |
| 14 | Phase 6 UI/UX audit | **Done** — mobile stat-card fix shipped | Sidebar mobile auto-collapse still open, low priority |
| 15 | `evaluateStatus` 3 dormant bugs + dead visibility columns + `drizzle-kit migrate` anomaly | **evaluateStatus bugs fixed 2026-09-21** (see `target-resolution.ts`) — one (the `maximum` branch ignoring `direction`) was found to have live, if previously-harmless, exposure via 3 real `targetType=maximum` rows before the fix. Dead visibility columns and the migrate anomaly are still open. | Dropping/deprecating `metric_assignments.visibleOnHome/visibleOnTeam/visibleOnEmployee`; investigating the `drizzle-kit migrate` CLI anomaly |
| 16 | Sub-manager hierarchy (Jacob Murray, James Maynard, Norvel Crawford) | **Shipped 2026-09-17**; reconciliation route/page sub-manager access gap **fixed 2026-09-21** | Juan Jimenez/Maicol Ortiz still `pending` as of 2026-09-21 (their stated 9/21 start date) — Alex needs to review now, see item 18 |
| 17 | CI broken for two weeks | **Fixed 2026-09-17** | Nothing |
| 18 | *(new, 2026-09-21)* Juan Jimenez / Maicol Ortiz still pending on their stated start date | **Resolved 2026-09-21** — were mislabeled as POS/Alex's candidates; actually Menufy/Barbara's. Approved live via the real admin UI after fixing a separate "reject has no undo" gap this surfaced (new `restoreRejectedCandidate` action) | Nothing |
| 19 | *(new, 2026-09-21)* Cross-org isolation gap in admin pages/view-as | **Fixed 2026-09-21** | Nothing |
| 20 | *(new, 2026-09-21)* `resolveVisibility` specificity scoring treated teamId/line as a hierarchy | **Fixed 2026-09-21** | Nothing |
| 21 | *(new, 2026-09-21)* Menufy visibility overrides couldn't express "all lines" | **Fixed 2026-09-21** — added an "all lines" option | Nothing |
| 22 | *(new, 2026-09-21)* `findKeyChange`'s near-zero-baseline % swings (e.g. "Avg Hold declined 434%") | **Fixed 2026-09-21** | Nothing |
| 23 | *(new, 2026-09-21)* Barbara's team's 67-86% "Needs Attention" rate | **Root cause found**: concentrated in 3 metrics (OB/IB calls, Tickets Resolved) whose range targets are narrower than real variance — see the exact numbers in `HANDOFF.md` | Recalibration conversation with Barbara |
| 24 | *(new, 2026-09-21)* Dead `"entra"` data-source UI branch in `data-health/page.tsx`; stale `assembled` row still in `data_sources` table | Open, low priority | Decide whether to delete the dead UI branch and/or the stale DB row |
| 25 | *(new, 2026-09-21)* `docs/planning-report.html` (2026-09-02) never reconciled with this file | **Partially done** — its 2 most-cited findings (TGT-01, IDEM-01) cross-referenced; ~20 others still unverified | A dedicated pass through SYNC-01 through DB-05 |

Everything else not listed above (error monitoring, ongoing metric-reconciliation job,
`metric_visibility_overrides` missing `organizationId`, old git worktree, `VERCEL_API` token
rotation, `env.ts`'s missing `server-only` guard, week-boundary math duplicated in 5 places,
the unexplained "Jayhov Sumagang / Kevin L" reference in `HANDOFF.md`) is still open exactly
as described in its own item below or in `HANDOFF.md` — nothing new to report.

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

**Update (2026-09-15): this exact fragility caused a real 3-day incident, not just a
theoretical one — see item #6 below.** One employee's ticket-search query failing aborted the
whole week's sync for all 84 employees. The immediate cause is fixed (item #6), but the
architecture is still one query away from the same failure mode for a different reason. Now a
stronger case for actually doing this, not just tracking it.

## 6. Fixed: departed-employee ticket volume crashed 3 days of Menufy syncs (2026-09-15)

Found via a smoke-test pass following up on this session's earlier fixes: `week=1`'s sync had
failed 3 days running (09-13 through 09-15), each time discarding that week's fresh data for
every Menufy employee, not just one.

**Root cause, confirmed against the real API, not inferred:**
- `fetchRecords` queried every row in `external_identities` for the data source — with no
  filter on the linked employee's `employmentStatus`. Departing an employee (per the
  `approveDeparture` flow, and the manual reconciliation in item below) never removes their
  `external_identities` row, only marks the employee inactive and closes `team_memberships`.
- Rasheil Badajos — deactivated in the 2026-09-11 Menufy roster reconciliation — was still
  being queried on every sync as a result.
- Her ticket count for the affected week: **1,211**, confirmed via a direct Zendesk API call —
  roughly 10x a normal agent's weekly volume. Sampling the results showed all of them touched
  within the same ~17-minute window on 09-14, already `solved` — almost certainly a bulk
  reassignment/cleanup action tied to her offboarding, not organic activity.
- Zendesk's Search API hard-caps pagination at 1,000 total results; requesting page 11 (results
  1001-1100) returns a real `422 Unprocessable Entity`, confirmed directly against the live API.
  `searchAllPages` had no handling for this — the 422 threw, and because the per-employee fetch
  loop shares one try/catch (item #2 above), one person's failed query took down the whole
  week's sync for everyone.

**Fixed, two layers:**
- `fetchRecords`'s identity query now joins `employees` and filters to `employmentStatus =
  'active'` — departed employees stop being queried at all, closing the immediate cause.
- `searchAllPages` now stops before requesting the page that would 422, logging a warning with
  the real total count instead of crashing — protects against *any* employee (active or not)
  whose real ticket volume exceeds the cap in a given week, not just this specific case.

**Not done**: the shared try/catch itself (item #2) — these two fixes close the specific
trigger, but the architecture is still one bad query away from the same failure mode for a
different reason.

**Verified live**: triggered `?week=1` (the leg that had failed twice) after deploying the fix —
`HTTP 200, success: true, 0 sync_errors`. `identityCount` dropped from **84 to 48** — much
bigger than just removing Rasheil. 48 = 19 (Menufy, matches the 09-11 reconciliation) + 29
(POS, matches the 09-03 audit count) exactly, meaning **36 already-departed employees across
both teams** had been silently re-synced on every single run until this fix, not just the one
that happened to trigger a 422. Bigger latent correctness/efficiency issue than the specific
incident that surfaced it.

## 7. Cron legs fire up to ~90 minutes later than configured — expected Hobby-plan behavior, not a bug

Noticed while investigating item #6: the 4 staggered cron legs (`vercel.json`: 0/15/30/45 past
6am UTC) actually start anywhere from ~06:10 to ~07:28 UTC in practice, confirmed identical
across 3 consecutive days. Checked the actual registered schedule via the Vercel API — it
matches `vercel.json` exactly, no config drift. Confirmed via Vercel's own docs instead of
guessing: **Hobby-plan cron jobs only guarantee execution within the scheduled hour, not the
minute** (Pro/Enterprise get to-the-minute precision) — real, documented platform behavior, not
a defect. No fix needed: every leg still completes well within the 300s limit regardless of
when it starts, and a once-daily batch sync doesn't need minute-level precision. Logged here so
a future session doesn't re-investigate it as a mystery.

## 3. Single-Zendesk-subdomain assumption — needs a human, not a code fix

`src/lib/connectors/zendesk-shared.ts:14-17`'s `baseUrl()` only supports one
`ZENDESK_SUBDOMAIN`. Whether the real HungerRush Zendesk account is single- or
multi-brand/subdomain is unconfirmed by any code or doc in this repo (`INVESTIGATION.md` §8).
**Action item for a human**: confirm with Zendesk admin access. If multi-brand, some
tickets/calls could be silently invisible to this connector regardless of any sync-scheduling
fix.

## 4. Whether Vercel is actually invoking `/api/cron/sync` on schedule — RESOLVED, see item 7

**Resolved (2026-09-10/09-15), this heading is stale.** Item #5's 2026-09-10 update confirmed
a real `sync_runs` row appeared immediately after the `CRON_SECRET` fix, proving requests
reach `runSync()`, and item #7 (2026-09-15) confirmed via the Vercel API that the registered
cron schedule matches `vercel.json` exactly. The cron does fire; Hobby-plan just delivers it
within-the-hour rather than to-the-minute (a separate, non-bug explanation, see item #7). Kept
below only for history — do not re-investigate this question.

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

## 8. Fixed: `discoverRosterCandidates` re-proposed already-resolved candidates forever

Found during a Phase 1 roster review (2026-09-15): Daniel Coy and Claire Boonmanop, explicitly
rejected as new-hire candidates on 2026-09-11, were back as fresh `pending` rows by the next
day. Traced the mechanism precisely: the code only checked for existing **pending** candidates
before creating a new one (`existingPending`, filtered to `status = "pending"`) — an
**approved** or **rejected** candidate wasn't excluded, so anyone whose underlying Zendesk
condition never changes (still in the group after rejection, still absent from it after an
approved departure) gets proposed again on the next `discoverRosterCandidates` run, forever.

In practice this only ever created **one** wrongful duplicate per person, not an unbounded
stream — the duplicate itself was `pending`, so the *next* run's `pendingExternalIds` check
correctly caught and skipped it. Found 34 such duplicates in production, all timestamped
2026-09-10 17:10 — traced to a single manual `?week=0` trigger from earlier this session, the
first time `discoverRosterCandidates` successfully ran after the original CRON_SECRET outage
and 300s-timeout issues had prevented it from running since the departures were first approved
on 2026-09-03/04.

**Fixed** in `src/lib/domain/roster/reconcile.ts`: the "new" loop now checks for **any** prior
candidate row for that identity (any status, not just pending) before proposing again — a
human's reject decision should be durable. The "departed" loop now checks the linked
employee's `employmentStatus` directly instead of candidate-row history — re-proposing a
departure for someone already marked inactive is meaningless regardless of how that inactivity
was recorded. Added two test cases to `roster-reconcile.test.ts` covering both paths (can't run
locally — see `environment-quirks.md` on the local Postgres conflict — CI will verify).

**Also cleaned up**: deleted the 34 existing duplicate pending rows from production (verified
each had a resolved sibling row with the same externalId + changeType before deleting — nothing
genuinely undecided was touched). Pending queue is down to the 2 real, legitimately-new POS
candidates (Juan Jimenez, Maicol Ortiz) awaiting Alex's review.

## 9. POS Support has the same "lead counted as employee" pattern as Menufy did — RESOLVED 2026-09-16

**Resolved, this heading is stale.** Confirmed live via direct DB query on 2026-09-21: a
`departed` roster candidate for Christopher Courcy (`change_type='departed'`) was approved on
2026-09-16, and his `employees` row now has `employment_status='inactive'`. Whoever
approved it apparently already had Alex's (or equivalent) confirmation — no further action
needed. Kept below only for history.

Found via the self-serve half of a POS roster review (Alex is on vacation, so only the
mechanical checks were done — see `project-status` memory): **Christopher Courcy**
(`roleType: lead`, `jobTitle: "Manager, Technical Support"`) is counted in POS's active roster
of 29, same structural pattern as the 3 Menufy leads found and removed earlier this session.
Unlike Menufy's case, **no unambiguous departure signal exists here** — he's still an active
Zendesk group member, and there's no equivalent to Barb's confirmed list to check against yet.
**Not touched** — needs Alex's confirmation on return, same as the Rasheil case needed a human
call rather than an assumption.

## 10. Phase 2 metric-confidence audit (2026-09-15): pipeline is clean; found and explained a real "settling" characteristic

**2a — pipeline correctness, no bugs found.** Audited every null-coalescing fallback across the
connector → normalize → compute → query → UI chain. Well-designed already: `businessMinutes()`
correctly treats Zendesk reporting "0 business minutes" for a ticket resolved outside business
hours as missing data, not a real zero (so it doesn't drag averages down). `averageOf` and
`aggregateSourceValues` both exclude nulls from denominators rather than counting them as zero.
One latent, currently-harmless note: `computeMetricValuesFromFacts` filters facts by
`organizationId` + `factType` only, not by data source — fine while only Zendesk is live, would
need revisiting if a second connector ever wrote the same `factType` key.

Independently recomputed 4 metric types (`tickets_resolved`, `tickets_updated`,
`avg_handle_time`, `avg_response_time`) for one Menufy and one POS employee straight from raw
Zendesk data — exact match on every value, confirming the concurrency refactor from earlier
this session didn't regress correctness, only speed.

**Idempotency: perfect.** Snapshotted all 6,556 `metric_values` rows, re-triggered an
already-synced week live, re-snapshotted — zero rows added, zero removed, **zero values
changed**.

**2b — bounded reconciliation, 1,008 checks across all 48 active employees × 3 completed
weeks × 7 metrics.** 994 exact matches (98.6%). The most recent completed week: 336/336 exact.
The two older weeks: 14 mismatches, all small (ticket counts off by exactly 1, or a real value
where the independent recheck found null) and all in one direction (stored slightly higher, or
independent finding less).

**Root cause, confirmed directly, not guessed**: Zendesk tickets keep getting touched after a
week "ends" — most commonly its own auto-close behavior turning a `solved` ticket into `closed`
several days later, which bumps `updated_at`. Verified directly for one case (Blake Book,
2026-08-31 week): 22 of 48 tickets created that week had their `updated_at` pushed past the
week's end by the time of this check, mostly via exactly this solved-then-auto-closed pattern.
Since this connector's "completed week" metrics are computed from an `updated_at` window (not
an immutable "happened in this period" marker — see the "Incremental semantics" note in
`sync-engine.ts`), and weeks 1-3 get re-synced daily by the rolling cron, **a week's stored
numbers keep settling for several days after it ends**, converging as tickets stop being
touched. This is why the freshest completed week (offset 1) matched exactly and the older ones
(offsets 2-3) showed small drift — more time has passed for more tickets to get auto-closed.

**Not a bug — nothing changed.** This is an inherent characteristic of the data source, not a
pipeline defect: the daily re-sync is already the mitigation, continuously refreshing recent
weeks until they settle. Worth being aware of rather than surprised by if a manager ever notices
"Last Week" or "2 Weeks Ago" shift by a ticket or two day over day — it's real Zendesk activity
catching up, not the sync miscounting.

## 11. Phase 3 (2026-09-15): weeks 2-3 re-verified live post-fix

Only weeks 0 and 1 had been re-checked live after the departed-employee/search-cap fix (item
#6). Triggered weeks 2 and 3 directly: both `HTTP 200`, 151.1s and 150.3s respectively — ~150s
of margin under the 300s limit, consistent with 0 and 1. All four legs now confirmed healthy
under the current code. `sync_errors` swept clean: only the 3 already-diagnosed Rasheil 422s
exist, all 5 orphaned "running" rows predate the CRON_SECRET/per-week-split fixes (09-09/09-10)
-- nothing new or unexplained.

## 12. Phase 4 security audit (2026-09-15)

**Access-control boundary (`assertCanAccessEmployee`/`assertCanAccessTeam` in
`authorization.ts`) — sound.** Traced every dynamic route and API endpoint that touches
employee- or team-scoped data. Two valid patterns in use, both correct: explicit
`assertCanAccessEmployee`/`assertCanAccessTeam` calls (metrics queries, context queries,
reconciliation), or deriving the data from an already-scoped query like `getAssignedEmployees`
(the 1:1 page), where an out-of-scope ID simply can't appear in the result. `getEffectiveManagerContext`'s
"view as" flow re-validates the target user server-side from the cookie's userId on every call
(re-checking `isPlatformAdmin` and deriving the target's *real* assignments) rather than trusting
anything about the cookie's contents beyond which user to look up — a cookie can't grant scope
that user doesn't actually have.

**Found and fixed**: `GET /api/reconciliation/run` scoped only by `organizationId`, not by the
calling manager's own teams — since this org has multiple managers, one could see every other
manager's reconciliation run metadata (not employee-level data, that's already correctly scoped
in `/results` — see the explicit comment there guarding against exactly this). Confirmed zero
reconciliation runs exist in production yet, so nothing has actually been exposed. Fixed to
scope by the manager's own assigned teams (or org-wide runs they personally triggered).

**Admin actions (`roster-actions.ts`, `roster-review/actions.ts`, `admin/actions.ts`) — all
independently gated.** Every action re-checks `isPlatformAdmin`/`requireAdmin()` itself rather
than trusting the page that renders its form — correct, since Server Actions are independently
invocable.

**No secrets reach the browser.** Zero `NEXT_PUBLIC_` env vars anywhere in the codebase; no
client component (`"use client"`) imports `@/lib/env` or `@/lib/db`. One hardening gap, not an
active leak: `env.ts` has no `import "server-only"` guard, so there's no build-time safety net
against a *future* accidental client import — would need adding the `server-only` package as a
new dependency, not done here since it's not fixing a live issue, flagging as a recommendation.

**`pnpm audit` found and fixed two critical, unauthenticated RCE vulnerabilities in Next.js
itself** (see the "Patch Next.js" commit) — the framework serving this app's actual production
traffic on Vercel, not a peripheral dependency. Patched by upgrading `next` 16.3.1 → 16.3.5.
Four lower-severity findings left alone, all dev-only transitive dependencies with no production
runtime exposure (js-yaml via eslint, esbuild via drizzle-kit, vitest/@vitest/mocker) — vitest's
fix needs a major version bump already known to conflict with this environment's Node 24 (see
`known-workarounds` memory), not worth the risk for a dev-only, no-untrusted-input vulnerability
class.

`.env` confirmed properly gitignored and never committed across the repo's full history (only
`.env.example`, a template with no real values) — worth explicitly re-confirming given how much
`CRON_SECRET`/`VERCEL_API` credential handling happened earlier this session.

**Unrelated, noticed in passing, not touched**: an old git worktree
(`.claude/worktrees/quizzical-curie-4547cd`, branch `claude/quizzical-curie-4547cd`, dated
2026-08-31) is still registered — harmless (doesn't affect the app or its own lint/build), but
worth asking James whether it's still needed before someone eventually cleans it up.

## 13. Phase 5 performance audit (2026-09-15): no real bottleneck found

**Unnecessary client-side JS: none found.** Reviewed all 17 `"use client"` files — every one is
either required by Next.js itself (`error.tsx` boundaries), genuinely interactive (forms,
checklists, tabs, the roster table's search/filter/pagination, sidebar active-state), or wraps a
Radix UI primitive with real internal state (`Avatar`, `Separator`). Nothing found that could be
server-rendered instead.

**N+1 queries: none found.** Traced every page that renders a list (`one-on-ones`,
`admin/employees`, `admin/roster-review`, `team`) — all use batched `Promise.all` queries with
in-memory `Map` lookups for per-row display data, never a query inside a render loop. The one
per-item loop found (`data-health`, one query pair per data source) is bounded by connector
count (1-3), not employee count — not a real N+1 risk.

**Query performance: not a bottleneck, confirmed with `EXPLAIN ANALYZE` against real production
data, not assumed.** Timed the actual Team-page query (`getEmployeeMetricsBatch`) for both
teams: 600-1300ms observed, with the *first* query in a fresh process consistently ~2x slower
than the second regardless of which team ran first — confirmed as connection-warmup overhead,
not data-volume-driven, by swapping the order and reproducing the same pattern. Ran the real
query plan directly: **actual Postgres execution time was 0.517ms.** The entire observed
latency is network round-trip to the remote Railway host, not query execution — the existing
single-column indexes are already sufficient at this data volume, and a composite index would
save a fraction of a millisecond at best. Not worth adding; would be optimizing something that
isn't the bottleneck.

**Bottom line: no performance problem exists that a code change would fix.** For a small
internal tool with a handful of daily users, 600ms-1.3s page loads (dominated by an inherent
serverless-to-remote-DB round trip, not application logic) is a reasonable, non-alarming number
— not something to chase further without a real user complaint or a change in usage pattern
(e.g., far more employees or concurrent users) that would change the calculus.

## 14. Phase 6 UI/UX audit (2026-09-15)

**Loading/empty/error/stale states — already solid, confirmed by direct code read.** The
staleness banner (`sync-staleness-banner.tsx`) is genuinely wired to real data
(`dataSources.lastSuccessfulSyncAt`, 30-hour threshold) via the app-wide layout, not decorative.
Error boundaries exist at the route level (`team/error.tsx`, `one-on-ones/[id]/error.tsx`) and
cascade to layout-level (`(app)/error.tsx`) and root (`global-error.tsx`) fallbacks for every
other route, each reporting to `/api/client-error` with a real retry button. `EmptyState` is
used consistently everywhere a list could legitimately be empty (no employees, no teams, no
data sources, no metrics assigned).

**Accessibility — no color-only status indication.** `StatusBadge` always renders a text label
("On Track" / "Watch" / "Needs Attention" / "No Data") alongside color; color is reinforcement,
never the only channel. Root layout has a "Skip to content" link.

**Found and fixed: a genuinely broken mobile layout, not just suboptimal.** Tested the Team page
at 375px (a real phone width) — the stat-card grid was hard-coded to `grid-cols-2` with no
narrower breakpoint, and combined with the sidebar's persistent width eating roughly a third of
an already-narrow viewport, the value numbers ("29", "10", etc.) overlapped their own card
boundaries and got clipped by the screen edge. Not degraded — actually unreadable. Fixed by
changing the base breakpoint to `grid-cols-1`; verified the 5-column desktop layout at 1280px is
unaffected. Checked the other two core pages at the same width: the 1:1 listing page and the 1:1
detail page's metric tables are cramped (the sidebar never auto-collapses on narrow viewports)
but not broken — the tables already scroll horizontally within their own card rather than
overflowing the page, the correct existing pattern.

**Also fixed in passing**: `StatCard`'s label/detail text truncates via Tailwind's `truncate`
with no way to see the full value on overflow (confirmed "100% of team" still truncates even in
the 5-column desktop layout) — added `title` attributes so hovering reveals the full text. Same
fix applied to the roster table's employee name/job title. Also fixed a grammar bug in the same
table: "1 metrics need attention" (always plural) now correctly reads "1 metric needs attention"
for the singular case.

**Not fixed, flagged as a real but larger-scope item**: the sidebar has a manual
user-toggled collapse (persisted to localStorage) but no automatic mobile-responsive behavior —
every page pays its persistent width on a phone, which is cramped everywhere even where it isn't
literally broken. A proper fix (an off-canvas/hamburger pattern for narrow viewports) is a real
UI pattern change, not a quick tweak, and this is an internal tool primarily used at a desk — not
done here, flagging as a candidate if mobile use turns out to matter more than assumed. Also
noticed: the Team page's header metadata line ("Week of Sep 14 – Sep 20, 2026") wraps
awkwardly at narrow widths (one word per line) — cosmetic, not data-hiding, lower priority than
the two fixes above.

## 15. Scorecard targets/visibility work (2026-09-17): three pre-existing `evaluateStatus` bugs, dead visibility columns, and a `drizzle-kit migrate` CLI anomaly

Found while implementing Menufy Restaurant/Consumer target loading, range-target support, and
bulk metric visibility (`metric_visibility_overrides`). None of these were introduced by that
work and none block it — logged rather than fixed, since nothing loaded by the new feature
exercises the affected code paths.

**`evaluateStatus`'s `maximum` branch ignores `direction` entirely**
(`src/lib/domain/metrics/target-resolution.ts`, the `targetType === "maximum"` block) — both the
`lower_is_better` branch and its fallback run identical `value <= targetValue` logic. Not fixed:
nothing in the new Menufy target config uses `targetType: "maximum"` (ceiling semantics are
achieved via `targetType: "minimum"` + `direction: "lower_is_better"`, which already works
correctly).

**`evaluateStatus` aliases `exact` to `minimum` behavior** (same file, the
`targetType === "minimum" || targetType === "exact"` line) — no real equality-tolerance logic
exists for "exact" targets. Not fixed: nothing loaded uses `targetType: "exact"`.

**New finding: the same `minimum`/`exact` branch mishandles `direction: "neutral"`** — it only
branches on `direction === "higher_is_better"`, so `"neutral"` (a legitimate value in
`types.ts`'s `Direction` union) silently falls through to `lower_is_better` semantics. Surfaced
while reasoning about the spec's "informational" metrics, which map most naturally to `neutral`.
Worth fixing alongside the two bugs above, since it's the same underlying pattern (an explicit
direction check with a wrong implicit fallback).

**`metric_assignments.visibleOnHome`/`visibleOnTeam`/`visibleOnEmployee` are now permanently
dead.** Already unread anywhere in the query path before this work; the new bulk-visibility
feature deliberately adds a parallel mechanism (`metric_visibility_overrides`) instead of wiring
these up (see the conversation this was decided in). Worth a follow-up to delete these three
columns or mark them deprecated in a schema comment, so a future engineer doesn't assume
toggling them does anything.

**`drizzle-kit migrate` (the CLI, via `pnpm db:migrate`) failed twice with no usable error
message**, rolling back its own transaction both times, while the *identical* SQL ran cleanly
when executed directly through the app's own `db` connection immediately after. Root cause not
found — worth investigating before relying on `pnpm db:migrate` again. Worked around for this
session's two migrations (0010, 0011) by applying the SQL directly and hand-inserting the
matching `(hash, created_at)` row into `drizzle.__drizzle_migrations` (hash = sha256 of the exact
migration file content, per `readMigrationFiles` in `drizzle-orm`'s `migrator.js`) so the
bookkeeping table stays consistent with what a normal `migrate` run would have recorded. Separately,
but discovered via the same investigation: migration 0009 (`0009_fact_identity.sql`) is applied
and recorded in the real database, but a plain `drizzle-kit generate` still re-emitted its
columns/index as if new — i.e. the local drizzle snapshot state had already drifted from the real
database before this session touched anything (matches the `known-workarounds`/environment-quirks
history of this project). The generated SQL for both new migrations here was hand-reviewed and
trimmed to remove the re-emitted, already-applied statements before running; nothing from that
drift was applied a second time.

## 16. Sub-manager hierarchy: Jacob Murray, James Maynard, Norvel Crawford (2026-09-17)

Discovered via a conversation with Barb (relayed by James) that these three — previously
deactivated on 2026-09-11 as "leads miscounted as employees" (see items above and the
`roster-manager-exclusion-fix` memory) — are actually real sub-managers, each managing their own
slice of Barb's team, not just oversight-only accounts. Set up as real Cadence users with
per-employee `managerAssignments` rows (not team-level — a team-level assignment grants access
to *every* member of that team, which would have defeated the point of scoping each of them to
only their own people) matching Barb's roster sheet exactly (7/8/6 people respectively; the
sheet's other 2 pending new hires, Juan Jimenez and Maicol Ortiz, aren't real employees yet so
have no assignment — needs one once they're approved around their 9/21 start date).

This required a real code fix, not just data: `team/page.tsx` and `one-on-ones/page.tsx`
previously hard-required `ctx.assignedTeamIds.length > 0` to render anything, which a
per-employee-only manager can never satisfy. Added `getVisibleTeamsForManager` to
`authorization.ts` — derives the teams to actually display from the manager's assigned
employees' own `primaryTeamId`, not just their direct team assignments. Verified live: each of
the three sees exactly their own people; Barb's own view (whole-team assignment, unchanged) is
unaffected.

Also reactivated Rasheil Badajos (deactivated in the same 9/11 batch) — Barb's current sheet
lists her as a real associate (title "PH Team Lead," reporting to James Maynard like everyone
else on his slice), not a people-manager, reversing the earlier "lead, not a real employee"
call. If that turns out to be wrong, the reversal is easy to spot: she's the only person in this
batch whose `roster_candidates` history shows a `departed`→`new` round-trip.

## 17. CI had been broken for two weeks; found and fixed during a ship-readiness audit (2026-09-17)

The last successful GitHub Actions run before this was found was 2026-09-02. Every push since —
the entire 7-phase review, the UI audit, and the roster-auto-approval/Menufy-targets/sub-manager
work documented above — ran against a red pipeline, failing at the `prettier --check` step, which
meant `db:migrate`, `test`, and `build` never even executed. Every "verified" claim in this
project's history since 2026-09-02 was self-verified locally by whoever did the work, not
confirmed by CI.

Two root causes, both fixed:
1. **Prettier formatting drift in 16 files** (fixed with `prettier --write`, no behavior change).
2. **The real one**: job-level `NODE_ENV: production` in `.github/workflows/ci.yml` was meant
   only for the build step's "fail loudly if SSO unconfigured" check (`src/lib/auth/index.ts`),
   but applied to the whole job, including `pnpm test`. Under `NODE_ENV=production`, Vite's jsdom
   test environment externalizes Node builtins like `crypto` as browser stubs
   ("Module 'crypto' has been externalized for browser compatibility"), so anything importing it
   — `sync-engine.ts`'s `payloadHash`, used by every ingest path — threw `createHash is not a
   function`. Broke every test touching `sync-engine.ts` (`sync-engine.test.ts`,
   `run-sync.test.ts`) the moment CI actually got far enough to run them. Fixed by scoping
   `NODE_ENV: production` to just the "Verify production build" step.

Fixing this surfaced a load-bearing fact worth remembering: several test files
(`sync-engine.test.ts`, `run-sync.test.ts`, and — separately — every real assertion in
`roster-reconcile.test.ts`) had **never once actually run to completion** in any environment
before this — blocked locally by no Docker Postgres, and in CI by the bug above. One genuine bug
was found the moment they finally ran for real: `roster-reconcile.test.ts`'s "does not re-propose
a departure for an already-inactive employee" test asserted an aggregate `departedCandidates`
count of exactly 0, which only ever happened to be true because the test never ran — an earlier
test in the same file leaves behind a real, active employee (via auto-approval) that legitimately
*should* show up as a fresh departure when a later test's connector returns nothing. Fixed by
narrowing the assertion to the one row the test actually cares about, rather than the aggregate
count. Lesson: a test suite that reports green because it never actually executed is
indistinguishable from a green test suite that's genuinely passing — the "133 passed" reported
locally throughout this project's history looks identical either way. If a suite hasn't
confirmed a genuine local or CI environment recently, treat its "passing" status as unverified,
not as evidence.

## 18. Juan Jimenez / Maicol Ortiz still `pending` on their stated 9/21 start date — RESOLVED 2026-09-21

Found while planning a 2026-09-21 foundation-strengthening pass. Item #16 (and this item's
own original text) misidentified these two as POS candidates needing Alex — their real
`suggested_team_id` is Menufy Support, matching Barbara's own earlier mention of Juan as one
of her 9/21 hires. That mislabel, inherited from an earlier session, is the actual root cause
of the delay: nobody wrong-manager-checked would have approved them.

Also surfaced a real, separate gap while fixing this: rejecting a candidate through
`/admin/roster-review` is permanent by design (`discoverRosterCandidates` treats any prior
row for an identity, regardless of status, as "already seen" and never re-proposes it — see
item #8). There was no way to undo an accidental reject without a raw database write. Added
`restoreRejectedCandidate` (`admin/roster-review/actions.ts`) plus a "Recently rejected"
section on the page, scoped to only ever touch `rejected` rows (never `approved`/
`auto_approved`, which already created a real employee and need a different operation to
undo). Used it live to restore and properly approve both Juan Jimenez and Maicol Ortiz via
the real UI — both now have active `employees` rows on Menufy Support with a linked
`external_identities` row, verified live.

Minor, harmless asymmetry noticed while verifying: `approveNewCandidate` never backfills
`roster_candidates.employee_id` onto the candidate row it just approved (unlike
`approveDeparture`, which relies on that column already being set). Nothing currently reads
this column for `changeType='new'` rows, so it's cosmetic today, not a bug -- worth a
one-line fix if anyone ever adds a feature that expects it.

## 19. Cross-org isolation gap in admin pages and the view-as flow — FIXED 2026-09-21

Found during a 2026-09-21 foundation-strengthening audit, not previously logged anywhere.
Every admin list page (`admin/employees`, `admin/teams`, `admin/metric-visibility`,
`admin/roster-review`) queried `employees`/`teams`/`users` with no `organizationId` filter at
all, and `isPlatformAdmin` carried no org scope — a platform admin was implicitly a *global*
super-admin across every organization, not an admin of their own org. The `view-as` flow
(`getEffectiveManagerContext`) could resolve a target user in a different org entirely.
Harmless today (exactly 1 real organization exists) but a real violation of CLAUDE.md's
non-negotiable rules against hard-coding single-org assumptions into core domain code.

**Fixed**: added a shared `requireAdmin()` helper (`src/lib/auth/authorization.ts`) returning
the admin's own `{userId, email, organizationId}`; threaded it through all 4 admin pages'
queries and the 4 duplicated local `requireAdmin()` action-file implementations (which were
also consolidated into the same shared helper); added an org-match check to the view-as
lookup; and scoped `listManagersForViewAs()` by `organizationId`. Covered by new tests in
`authorization.test.ts` (a real second-org fixture proves both the view-as block and the
listing scope).

## 20. `resolveVisibility`'s specificity scoring treated teamId/line as a hierarchy — FIXED 2026-09-21

Found during the same audit. The specificity formula weighted `teamId !== null` at 2 and
`line !== null` at 1, so a team-only override always outranked a line-only override at the
same scope — even though the two are independent scoping axes, not a hierarchy (unlike
`target-resolution.ts`'s deliberately different design, which never lets "has a line"
outrank "has a team"). Not reachable through the one shipped admin UI, so no live incident —
fixed proactively before any other writer (a script, a future UI variant, a direct DB insert)
could hit it. **Fixed**: reworked to an explicit match-count (`visibility-resolution.ts`), so
a team-only and a line-only row at the same scope now tie (broken by array order) rather than
one silently always winning. Covered by a new test in `visibility-resolution.test.ts`.

## 21. Menufy metric-visibility overrides couldn't express "all lines" — FIXED 2026-09-21

Found while tracing the visibility-override feature end-to-end. `visibility-editor.tsx`'s
`buildTeamLinePairs` could never create a Menufy override with `line=null` — there was no way
through the admin UI to hide a metric for "all of Menufy regardless of line." Any employee at
`primaryTeamId=Menufy` with `line` still null (a fresh transfer via `setEmployeeTeam`, which
never sets/clears `line`, or anyone not yet manually tagged) fell outside every Menufy-scoped
visibility override, so a metric an admin thought was hidden team-wide stayed visible to that
one person. **Fixed**: added an "all lines" option that writes `teamId=menufyId, line=null`.
The pure logic (`buildTeamLinePairs`/`isValidVisibilitySelection`) was pulled out into
`visibility-logic.ts` and unit-tested directly — this repo has no component-testing
infrastructure, so a dependency-free module was the only way to make this testable at all
(importing the original component file transitively pulled in `next-auth`/`next/server`,
which don't resolve under Vitest).

## 22. `findKeyChange`'s near-zero-baseline % swings — FIXED 2026-09-21

Found via a data-backed audit of Barbara Maenza's Team page (see item 23). `findKeyChange`
(`team/page.tsx`) only guarded an exact-zero prior value, not a near-zero one, so a real but
practically tiny absolute change computed a mathematically extreme percentage — e.g. hold
time going from 0.2s to 1.1s rendered as "+450%". Confirmed live against several real
hold-time changes on Barbara's team, all well under 10 seconds absolute. **Fixed**: the
percentage is now only trusted when the prior value is at least 10% of the metric's own
resolved target scale; below that, an absolute-delta label is shown instead (e.g. "1s"), kept
data-driven rather than a hardcoded per-metric floor.

## 23. Barbara's team's 67-86% "Needs Attention" rate — root cause found, needs a human decision

The live-verification finding from the 2026-09-17 ship-readiness audit (see `HANDOFF.md`) was
followed up with a data-backed query on 2026-09-21. **Not a pipeline bug, and not evidence of
broad poor performance.** The high rate is concentrated in exactly 3 of ~21 assigned metrics —
Outbound Calls, Inbound Calls, and Tickets Resolved — all `range` targets whose windows are
narrower than the team's real week-to-week variance (range-width-to-stddev ratios of
0.40-1.42 across the 6 line/metric combinations; 54-96% of employee-weeks land outside the
window). Every other real target on the same team (Avg Response Time, CSAT,
Abandoned-on-Hold, both Avg Hold metrics) is 0-35% off-target. Independently replicating
`deriveOverallStatus`'s exact threshold logic against the real data reproduces the reported
67-86% rate. **Needs Barbara**, not code: a recalibration conversation using the exact
per-metric numbers (see `HANDOFF.md`'s "Needs your decision" section for the full table).

## 24. Dead `"entra"` data-source UI branch; stale `assembled` row in `data_sources`

Found while writing `docs/INTEGRATIONS.md`'s Entra ID section for the 2026-09-21 doc pass —
existing docs (`METRIC_REGISTRY.md`, `METRIC_TRACEABILITY.md`) both claimed Entra performs a
daily `accountEnabled` departure check via files/routes (`entra-check.ts`,
`admin/entra-identities`) that turned out **not to exist anywhere in the codebase** when
checked directly. What's real: `data-health/page.tsx` has a conditional render for a data
source of `type === "entra"` (showing "N employees checked" / "N flagged as disabled"), but no
connector/sync code for an `"entra"` type exists in `src/lib`, and no such row exists in the
real database — confirmed live: only `zendesk` and `assembled` rows exist. This is dead UI for
a feature that was seemingly planned but never built, not a description of live behavior;
corrected in `INTEGRATIONS.md`/`METRIC_REGISTRY.md`/`METRIC_TRACEABILITY.md`.

Separately noticed: the `assembled` row itself is also stale — the connector *code* was
removed 2026-09-03, but its `data_sources` row (id `50000000-...-0002`,
`last_successful_sync_at` null) is still sitting in the real database. Not deleted here (a
production data change outside this task's scope) — flagging so it's a documented, deliberate
non-action rather than an oversight.

## 25. `docs/planning-report.html` (2026-09-02) never reconciled with this file

A separate, pre-existing 12-critical-finding audit document that predates this file's entire
history and was never cross-linked to it. Found during the 2026-09-21 doc pass: its TGT-01
finding is the same bug independently rediscovered 15 days later as item #15 above; its
IDEM-01 finding is stale (fixed by the 2026-09-10 batching work, item #5) but the document
still shows it as an open critical issue. Added a status note at the top of the HTML file
cross-linking both. The other ~20 findings (SYNC-01 through DB-05, and its proposed
schema/sync/engine changes) were **not** re-verified — several may already be fixed by later
work with nobody having checked. Worth a dedicated reconciliation pass before trusting any of
them either way.
