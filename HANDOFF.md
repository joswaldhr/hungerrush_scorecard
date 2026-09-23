> Current September 23 overhaul status: see
> [implementation progress and release checkpoint](docs/audits/2026-09-23-implementation-progress.md).
> The older production-complete statements below describe earlier sessions. The current
> audit branch is `codex/audit-reliability-checkpoints`. Hosted Preview uses a separate
> Railway database, Entra registration, and branch-scoped secrets; its synthetic sign-in/UI
> checks passed. Production rollout and historical repair remain gated. Follow the linked
> ledger for current commits, validation, and remaining work; older sections are historical.

# Session Handoff — 2026-09-15

## TL;DR

This session closed out the sync-timeout saga from the previous handoff, then ran a full
7-phase app review (roster integrity → metric confidence → sync reliability → security →
performance → UI/UX → code quality/docs) at the user's request. **All 7 phases are done.** Phase 7 (code quality, test coverage, docs freshness) was
completed in this session.

Along the way, the review found and fixed several real, previously-unknown production issues —
not hypothetical ones — each verified against real data or the real deployed app, not assumed.
The two most serious: a 3-day silent sync failure caused by a departed employee's ticket count
exceeding a Zendesk API limit, and two **critical, unauthenticated RCE vulnerabilities in
Next.js itself**, patched the same session they were found. Everything below is committed and
pushed to `master` and live in production.

Read in this order if you're picking this up fresh:
1. This file (status + what's next)
2. `FOLLOWUPS.md` — the full detailed log (25 numbered items as of 2026-09-21; the count here
   will keep going stale, so don't trust a specific number — read its own "Current state" table
   at the top instead of counting), most current info per item, several superseding what the
   previous handoff said (e.g. the original "split Talk calls out of week 0" theory turned out
   to be wrong — see item #6/#10)
3. `CLAUDE.md` — durable lessons folded into the project's standing instructions
4. `INVESTIGATION.md`/`FIX_LOG.md` — older, narrower history now folded into `FOLLOWUPS.md`

## What happened, in order

**Sync timeout saga, concluded:**
1. Verified all 4 per-week cron legs live with the correct `CRON_SECRET` (a stale local `.env`
   copy had silently diverged from Vercel's real value — rotated it; the real scheduled cron was
   never actually at risk, since Vercel auto-attaches its own copy regardless of the local file).
2. The original theory (week 0's Talk-calls fetch never terminates) was **wrong** — instrumented
   it directly and found 11 pages, 42.5s, zero rate-limit hits. The real bottleneck was 84
   sequential per-employee Zendesk requests (ticket search + identity resolution) with no
   concurrency. Parallelized both (bounded concurrency of 5) — verified live, ~150-170s per leg
   now vs. up to 296s before, comfortable margin restored on all 4 weeks.

**Roster integrity (Menufy, then POS):**
3. Reconciled Menufy's roster against Barbara Maenza's real team list: found 3 "lead"-role
   accounts and 1 real employee (Rasheil Badajos) incorrectly counted as regular staff, and 2
   stale pending candidates that should've been rejected. Fixed with Barb's explicit
   confirmation. Menufy: 23 → 19, matches her list exactly.
4. Same self-serve check on POS (Alex is on vacation, so only the mechanical parts): found the
   identical "lead counted as employee" pattern (Christopher Courcy) — **flagged, not touched**,
   needs Alex's confirmation on return. Two legitimately-new candidates (Juan Jimenez, Maicol
   Ortiz) also await his review.

**A real, live P0 found via a post-fix smoke test:**
5. Deactivating Rasheil (step 3) didn't remove her from the Zendesk sync's identity list — the
   query had no employment-status filter. Her ticket count for one week hit 1,211 (a bulk
   reassignment from her own offboarding), which exceeded Zendesk Search's 1,000-result cap and
   crashed the **entire week's sync for all 84 employees**, 3 days running. Fixed two ways:
   filter by employment status, and handle the cap gracefully instead of crashing. Also revealed
   36 already-departed people system-wide had been needlessly synced this whole time (84 → 48
   active identities).
6. Found and fixed a second, related bug: `discoverRosterCandidates` re-proposed
   already-resolved candidates forever (only checked for *pending* duplicates, not
   approved/rejected ones) — cleaned up 34 duplicate rows this bug had already created.

**Full app review, user-requested, 7 phases planned (see the conversation for how the plan was
tightened across several rounds of self-critique before executing):**
7. **Phase 2 (metric confidence)**: null-handling audit clean, concurrency refactor verified
   correct via exact-match independent recomputation, idempotency perfect (0 drift across 6,556
   rows). Bounded reconciliation (1,008 checks) found and explained a real "settling" phenomenon
   — Zendesk auto-closes solved tickets days later, so a "completed" week's numbers keep gently
   shifting for several days. Not a bug.
8. **Phase 3**: weeks 2-3 re-verified live post-fix, `sync_errors` swept clean.
9. **Phase 4 (security)**: `pnpm audit` found **two critical, unauthenticated RCE
   vulnerabilities in Next.js itself** (one in the Image Optimization API, directly reachable in
   this app's real production deployment) — patched immediately (16.3.1 → 16.3.5). Also found
   and fixed a cross-manager visibility gap in the reconciliation-run listing endpoint. Core
   `assertCanAccessEmployee`/`assertCanAccessTeam` boundary confirmed sound everywhere.
10. **Phase 5 (performance)**: no real bottleneck. Confirmed via direct `EXPLAIN ANALYZE` against
    production data that query execution is 0.517ms — all observed latency is network/connection
    overhead, not a code or index problem.
11. **Phase 6 (UI/UX)**: found and fixed a **genuinely broken mobile layout** — the Team page's
    stat cards overlapped and clipped at real phone widths, not just cramped. Fixed the
    responsive breakpoint, plus two smaller papercuts (truncated text with no hover fallback, a
    "1 metrics need attention" grammar bug).

## What's still open (see `FOLLOWUPS.md`'s "Current state" table for the single source of truth — this section and the one two updates below it used to be two disconnected lists; merged here 2026-09-21)

**Phase 7 — done.** Three sub-tasks completed:
- **7a (dead code removal)**: removed `getTeamMetricTrend` (metrics/queries.ts), `getCadenceGapDays`
  (briefings/generate.ts), and the entire `context/queries.ts` module (zero callers). Deleted the
  test file and fixture export that only served `getTeamMetricTrend`. Briefings generators left in
  place per James — unwired-but-planned, not dead.
- **7b (sync orchestration tests)**: 11 new tests across `run-sync.test.ts` (7 tests: happy path,
  fetch/publish failures, empty data, DataSource-not-found, weekOffset, pagination) and
  `rate-limit.test.ts` (4 tests: sync and reconciliation cooldown logic). All pass.
- **7c (docs freshness audit)**: audited all 9 `docs/*.md` files against current code. Updated
  ARCHITECTURE.md (project structure, connector interface, sync lifecycle, deployment, testing),
  DATA_MODEL.md (8 new tables, 3 new columns), INTEGRATIONS.md (Assembled/Rippling status),
  DESIGN_SYSTEM.md (component list), METRIC_REGISTRY.md, METRIC_TRACEABILITY.md, and PRODUCT.md.
  BUILD_SPEC.md and MVP.md were already accurate.

**Needs Alex, not a code fix:**
- ~~Confirm whether Christopher Courcy should be removed from POS's active roster~~ — resolved
  2026-09-16 (confirmed live 2026-09-21): a departure was already approved for him and his
  employee record is `inactive`. No action needed (item #9).
- ~~Review the two pending POS candidates (Juan Jimenez, Maicol Ortiz)~~ — this was never
  actually Alex's call. Both are **resolved** as of 2026-09-21: they're real Menufy hires
  (Barbara's, not POS), matching her own earlier mention of Juan as one of her 9/21 hires — the
  "POS/Alex" label on this item was a mislabel inherited from an earlier session. Both now have
  active employee records on Menufy Support with linked Zendesk identities. See the new
  "Update (2026-09-21, later)" section below for the full story, including a real bug this
  surfaced in the reject flow.

**Needs a product/priority decision, not urgent:**
- ~~Target recalibration conversation with Barbara~~ — **decided 2026-09-22: James is
  deliberately leaving Barbara's original targets unchanged through launch**, revisiting only
  if she raises it herself. Kept here for context, not as an open item. Her team's 76.8%
  "Needs Attention" rate over the last 3 completed weeks (69 employee-weeks; matches the
  67–86% range originally observed) is concentrated in exactly 3 of ~21 assigned metrics —
  Outbound Calls, Inbound Calls, Tickets Resolved — all `range` targets narrower than the
  team's real week-to-week variance:
  - OB Calls: restaurant 69.2% off-target; consumer 95.8% off-target (restaurant range [35,75]
    vs. stddev ≈28.2; consumer [75,112] vs. stddev ≈92.2)
  - IB Calls: restaurant 84.6% off-target; consumer 54.2% off-target (restaurant [52,72] vs.
    stddev ≈35.0; consumer [30,52] vs. stddev ≈17.0)
  - Tickets Resolved: restaurant 64.1% off-target; consumer 79.2% off-target (restaurant
    [75,128] vs. stddev ≈91.4; consumer [282,443] vs. stddev ≈245.4)

  Every other real target on her team (Avg Hold 0–2%, CSAT 15–17%, Abandoned-on-Hold 13–15%)
  is healthy — those employees are fine. Avg Response Time is a little elevated on Consumer
  specifically (50% off vs. 23% on Restaurant) — worth a passing mention, not the main story.
  Re-verified 2026-09-21 by re-running the app's own real target/status logic (not an
  approximation) against current live data, after Juan Jimenez/Maicol Ortiz were added — they
  correctly show as pure "No Data" and don't skew anything. This is a "3 specific ranges are
  too tight" story, not a "the team is struggling" story (item #23). A percentile-based
  candidate-range recommendation exists (`scripts/analyze-menufy-range-target-percentiles.ts`,
  2026-09-22) if this comes back up post-launch — no need to redo that analysis from scratch.
- Sidebar doesn't auto-collapse on mobile (item #14) — cramped everywhere on a phone, not
  broken elsewhere the way the stat cards were. This is primarily a desk tool; flagged as a
  candidate only if mobile use turns out to matter.
- `fetchMetricSets` parallelization (item #10 in the older sync-timeout thread) — now the
  largest remaining fetch-phase cost, current margin is comfortable without it.
- Talk-fetch shared try/catch fragility (item #2) — now has a stronger case given it contributed
  to the item-#6 incident, still a real architectural change, not a small patch.
- Whether to build the ongoing/automated metric-reconciliation job discussed during planning
  (Phase 2e) — a real infrastructure commitment, deliberately not started, needs an explicit
  decision if continuous (not just point-in-time) confidence matters enough to build it.
- No error monitoring exists anywhere — a real client-side error today becomes a
  `console.error` line in server logs with no persistence, dashboard, or alert
  (`/api/client-error` just logs). This is the second time this gap has been flagged since the
  2026-09-09 outage.
- Whether to delete the dead `"entra"` data-source UI branch (`data-health/page.tsx`) and/or
  the stale `assembled` row still sitting in the real `data_sources` table (item #24, found
  2026-09-21 while writing docs — the connector code was removed 2026-09-03 but its DB row
  wasn't).

**Needs a human with access this session didn't have:**
- Whether POS's actual work week is Sun-Sat too, or something else — see item #27. Confirmed
  for Menufy (Barbara said Sun-Sat, applied company-wide 2026-09-22); POS is unconfirmed and
  the setting is currently global, so this matters if POS turns out to differ.
- Whether the real Zendesk account is single- or multi-brand (item #3, predates this session).
- **What does "Jayhov Sumagang / 'Kevin L' roster mismatches" actually refer to?** Confirmed
  2026-09-21: this exact phrase is the *only* place in the entire repo (code, docs, git
  history via `git log -S`) that mentions either name — authored directly by James on
  2026-09-15 with no prior artifact establishing context. Nothing here can scope or resolve
  this; it needs to go back to James with that literal question.

**Housekeeping, noticed in passing, not touched:**
- An old git worktree (`.claude/worktrees/quizzical-curie-4547cd`) is still registered as of
  2026-09-21 — ask James if it's still needed.
- `env.ts` has no `import "server-only"` guard (item #12) — no active leak, but no build-time
  safety net either; would need a new dependency, flagged as a hardening recommendation.
- Three lower-severity dependency vulnerabilities (js-yaml, esbuild, vitest/@vitest/mocker) left
  as accepted risk — all dev-only, no production exposure, vitest's fix conflicts with this
  environment's known Node 24 issue (see `known-workarounds` memory). Re-confirmed unchanged as
  of 2026-09-21.
- `metric_visibility_overrides` still has no `organizationId` column — matches an existing
  pattern elsewhere in the admin actions (e.g. `roster-actions.ts`'s tables), a non-issue in
  today's single-org reality. Re-confirmed as of 2026-09-21 that no other table added since has
  the same gap left unflagged.
- `VERCEL_API` personal access token (still in local `.env`, gitignored, never committed) —
  consider rotating/scoping down now that the heavy Vercel-debugging work from the sync-timeout
  saga is done.

## Access notes

Same `VERCEL_API` personal access token from the previous handoff is still in `.env`
(gitignored, never committed — reconfirmed this session). It was used extensively again this
session for direct Vercel verification. Consider whether to rotate/scope it down now that the
bulk of this work is done (flagged, not decided).

## UI Audit (post-Phase 7)

After the 7-phase review, a targeted UI audit addressed layout clutter and missing export
functionality across the app:

**Phase 1 — Dead component removal:** Deleted 6 orphaned files (BriefingSection,
MeetingPrepChecklist, MetricHistoryChart, TrendIndicator, Tabs UI primitive, Home loading
skeleton). Zero imports anywhere.

**Phase 2 — Sidebar cleanup:** Removed duplicate utility nav (Settings/Connections duplicated
Operations items). Fixed hardcoded "James Smith" and "Support Manager" — now uses real user
name/email and job title from the employees table. Avatar initials derive from name or email.

**Phase 3 — Team page declutter:** Removed dead Export button, hardcoded "8:30 AM" fallback,
Employees and Team Trend stat cards (redundant). Reduced stat cards from 5 to 3. Removed
duplicate filter toolbar from TeamRosterTable (pills + search remain inline). Removed always-empty
"1:1 Upcoming" and "Action" columns. Added `TeamFilters` component for Team/Period dropdowns in
the page header. Fixed missing period options (weeks 2 and 3). Removed two unnecessary DB queries
(previous-week metrics, meeting references).

**Phase 4 — Scorecard export:** New `ScorecardExport` client component on the 1:1 page with
7 export options: PDF (html2canvas + jspdf), PNG (html2canvas), CSV, formatted text copy,
copy link, and print. Replaces the old `OneOnOneActions` (Copy Link + Print only). New
dependencies: `html2canvas@1.4.1`, `jspdf@4.2.1`. Also approved `core-js` build script in
`pnpm-workspace.yaml` (transitive dependency from jspdf).

**Phase 5 — Documentation:** Updated DESIGN_SYSTEM.md component list and this handoff.

## Update (2026-09-16 to 2026-09-17): roster auto-approval, Menufy targets/visibility, sub-manager hierarchy, and a ship-readiness audit that found CI had been broken for two weeks

**Roster auto-approval with a circuit breaker.** `discoverRosterCandidates` (`reconcile.ts`) now
auto-approves new-hire candidates (creates the employee/identity/team-membership rows
immediately) instead of always requiring manual review, with a circuit breaker (>5 absolute or
>30% of the active roster) that falls back to `pending` if a batch looks structurally wrong.
Departures remain manual — never auto-deactivated. Verified live: an auto-approval fired for
real the very next morning after shipping.

**Menufy Restaurant/Consumer targets, range support, and bulk metric visibility.** Loaded real
per-line target config for Menufy (`scorecard-spec-for-claude-code.md` at the repo root has the
full spec). Added range-target support to `metric_targets` (`targetMin`/`targetMax`, strict
both-sides evaluation — below min *or* above max is off-track) and a `line` column threaded
through target/visibility resolution. New `metric_visibility_overrides` table with three-tier
precedence (scorecard → manager → global default), properly scoped by `teamId` so a Menufy-only
hide can never leak into POS — this needed a real fix mid-implementation when the first design
(scoping by `line` alone) turned out unable to distinguish "POS only" from "everywhere," since
POS employees always have `line = null`, same as an unscoped row. New admin page at
`/admin/metric-visibility`. `declined_calls`, `missed_calls`, and `csat_response_rate` were
loaded with real targets but will show "No Data" permanently — a known, separately-tracked
Zendesk API gap (see `phone-system` project memory), not a bug in this work.

Menufy employees were tagged with their real line (`restaurant`/`consumer`) from live Zendesk
group membership — 19 of 20 split cleanly; Scott Easterday was the one person in both groups,
resolved as `restaurant` per Barb's direct confirmation.

**Sub-manager hierarchy.** Discovered (via a conversation with Barb, relayed by James) that
Jacob Murray, James Maynard, and Norvel Crawford — previously deactivated as "leads miscounted
as employees" — are actually real sub-managers, each owning a slice of Barb's team. All three
now have real Cadence logins and per-employee `managerAssignments` rows matching Barb's roster
sheet. This needed a real code fix, not just data setup: `team/page.tsx` and
`one-on-ones/page.tsx` previously required a manager to have at least one *whole* team assigned
(and a whole-team assignment always grants access to every member of that team, so it couldn't
be used to scope someone to a slice) — added `getVisibleTeamsForManager` in `authorization.ts`
so a manager whose access comes entirely from individual employee assignments still renders
correctly. Rasheil Badajos was also reactivated — Barb's current roster sheet lists her as a
real associate (title "PH Team Lead," not literal people-management), reversing the earlier
9/11 deactivation.

**Ship-readiness audit — the most important finding: CI had been broken for two weeks.** The
last successful GitHub Actions run before this audit was 2026-09-02 — every push since,
including the entire 7-phase review and the UI audit above, ran against a red pipeline where
`db:migrate`/`test`/`build` never even executed (it failed at `prettier --check`). Two root
causes, both fixed: (1) Prettier formatting drift in 16 files, and (2) job-level
`NODE_ENV: production` (meant only for the build step's SSO fail-loudly check) was also applied
to `pnpm test`, and under `NODE_ENV=production` Vite's jsdom test environment externalizes Node
builtins like `crypto` as browser stubs — breaking every test that touched `sync-engine.ts`'s
hashing. Fixing this surfaced a real, load-bearing fact: several tests (`sync-engine.test.ts`,
`run-sync.test.ts`, all of `roster-reconcile.test.ts`'s actual assertions) had **never once run
successfully** in this environment before — locally blocked by no Docker, and in CI blocked by
the above. One genuine test-isolation bug was found and fixed in the process (an aggregate-count
assertion in `roster-reconcile.test.ts` that only ever passed by accident of never actually
running). CI is green again as of this handoff.

Also fixed: a real display bug where the three range-target metrics (Tickets Solved, IB Calls,
OB Calls) silently rendered "—" instead of the actual range on every Menufy scorecard and export,
since the Target column/export code read `targetValue` directly (`null` for range targets)
without checking `targetType`. Added integration test coverage for `queries.ts`
(`getEmployeeMetricsBatch` — the single function every scorecard renders through, previously
untested) and the new metric-visibility admin actions.

**Found during this update, not yet acted on at the time — now folded into the single merged
"What's still open" section near the top of this file** (2026-09-21): the target-calibration
signal below was followed up with a data-backed root-cause analysis and its display-math half
(`findKeyChange`'s near-zero-baseline bug) was fixed; see items #22/#23 there and in
`FOLLOWUPS.md`. The original finding, kept verbatim for history: live-clicking through Barb's
Team page as part of this audit showed 67–86% of her team as "Needs Attention" (varies by
week), and several "Key Change" percentages over 100% (e.g. "Avg Hold declined 434%"). The
underlying numbers were accurate (verified against Rosa E's actual scorecard), and the >100%
swings were a known instability of percent-change math against a small/near-zero baseline.

## Update (2026-09-21): foundation-strengthening audit and fixes

An extensive read-only audit (8 parallel investigations against current code and the real
Railway pilot database) plus a full implementation pass followed the ship-readiness audit
above. Full detail lives in `FOLLOWUPS.md` items #18–25 and its "Current state" table; the
short version: two live-and-wrong-today bugs were fixed (`findKeyChange`'s near-zero-baseline
% swings, and three `evaluateStatus` target-resolution bugs — one of which was found to have
real, if previously-harmless, live exposure); a real cross-org isolation gap in every admin
page and the view-as flow was closed before a 2nd organization ever becomes real; a latent
bug in metric-visibility precedence scoring and a genuine gap (no way to hide a metric for
"all of Menufy regardless of line") were both fixed; test coverage was added for the roster
auto-approval circuit breaker's untested percent-based path and for `getVisibleTeamsForManager`
(zero coverage despite fixing a real 2026-09-17 incident); CLAUDE.md and all `docs/*.md` files
were reconciled against current code (CLAUDE.md's Product UX section had described a 4-screen
product 11 days after it was cut to 2; "Assembled live in production" was false; a
previously-undocumented dead `"entra"` data-source UI branch was found and corrected in three
docs). Two time-sensitive/stale backlog items were resolved by direct live DB query while
planning this work: Christopher Courcy's departure turned out to already be approved
(2026-09-16, never marked resolved until now), and Juan Jimenez/Maicol Ortiz are still
pending on their literal 2026-09-21 start date (now flagged urgently above, not previously
called out as time-sensitive anywhere).

Root cause for Barbara's team's high "Needs Attention" rate was also found (not just
flagged): concentrated in exactly 3 of ~21 metrics whose range targets are narrower than real
variance — see the "What's still open" section above for the exact numbers.

## Update (2026-09-21, later): fixed a mislabeled roster item, closed a real "no undo" gap, re-confirmed Barbara's calibration finding

Continuing directly from the foundation-strengthening pass above, in the same session.

**Juan Jimenez / Maicol Ortiz, resolved — and a real gap found while fixing it.** Acting on
item #18 (framed above as "needs Alex"), a first attempt to reject-then-rediscover them
exposed that rejection is permanent by design: `discoverRosterCandidates` treats *any* prior
`roster_candidates` row for an identity, regardless of status, as "already seen" and never
re-proposes it (see item #8's original reasoning — a human's decision should stick). There
was no way back except a raw database write, which James asked not to use. Added
`restoreRejectedCandidate` (`admin/roster-review/actions.ts`) — scoped to only ever reset a
`rejected` row back to `pending`, never an `approved`/`auto_approved` one (those already
created a real employee; undoing that is a different operation, deactivation via
`/admin/employees`) — plus a "Recently rejected" section on `/admin/roster-review` with a
"Restore to pending" button. Used it live through the real UI (no DB bypass, nothing for
James to click) to restore and properly approve both. **Also caught mid-fix**: the original
"needs Alex" framing was simply wrong — both candidates' real `suggested_team_id` is Menufy
Support, matching Barbara's own earlier mention of Juan as one of her 9/21 hires. Both now
have active `employees` rows on Menufy Support with a linked `external_identities` row
(`match_method: roster_discovery`), verified live — metrics will attribute correctly on the
next sync.

Also confirmed live: new-hire discovery and auto-approval already run fully automatically
once a day (piggybacked on the `?week=0` cron leg, `src/app/api/cron/sync/route.ts:84-93`) —
James asked whether this needed building and it turns out most of it already existed. He
explicitly confirmed keeping departure processing manual (deactivating a real person by
mistake is worse than creating an extra employee row) — no change made there.

Committed as `2050907` (a CI-only test-isolation bug this same push exposed — two unrelated
test files independently used the identical fixture email `test-manager@test.cadence.internal`,
latent since before this session, only surfaced once a larger insert batch shifted timing;
fixed by suffixing `authorization.test.ts`'s copy) and `87af741` (the restore feature itself).
Both verified green in real CI, not just locally.

**Barbara's target-calibration finding, re-confirmed with fresh live data.** James asked for a
check-in on this. Re-ran the app's actual `getEmployeeMetricsBatch`/`deriveOverallStatus`
logic (not an approximation) against the current database, including the two new hires above.
Numbers are unchanged from the original finding — see the "What's still open" section above
for the current exact figures. This is ready to bring to Barbara as-is; no further
investigation is queued unless James wants a shareable write-up prepared.

## Update (2026-09-22 to 2026-09-23): scorecard export fixes, scorecard redesign, 1:1s picker redesign (twice)

Four separate pieces of work, each a direct response to James testing the app himself and
reporting a specific problem, not self-initiated. All verified live in the browser, not just
read from the code — every fix below has a concrete before/after check, not "should work now."

**1. Scorecard export was broken in three of five ways** (`0f41f76`). James ran a real export
test: PDF and PNG both failed, CSV downloaded but dashes rendered as mojibake in Excel, print
spilled onto a second, mostly-blank page. All three had real, distinct root causes:
- PDF/PNG: `html2canvas` can't parse the `lab()`/`oklch()` color functions this app's Tailwind
  v4 theme uses for every color — confirmed via the actual thrown error, which the code had
  been silently swallowing (no `console.error` in the catch blocks at all). Fixed by swapping
  to `html2canvas-pro`, a fork built specifically for this exact Tailwind v4 incompatibility,
  same API.
- CSV: no UTF-8 BOM, so Excel assumed the system codepage and mangled the en-dashes in target
  ranges (`75–128` → `75â€"128`). Fixed by prepending `﻿`; confirmed by intercepting the
  actual `Blob` the app constructs and checking for the real BOM byte (65279).
- Print: the stylesheet linearized all 5 category cards into one tall column, and
  `break-inside: avoid` pushed whichever card didn't quite fit onto page 2, wasting whatever
  room was left on page 1. Switched to a 2-column print layout with tighter row padding.
  Verified by extracting the *actual* shipped `@media print` CSS from the live stylesheet (not
  retyped by hand) and measuring real layout against a conservative page-height budget.

**2. Scorecard redesign** (`7b73c9e`) — a large, explicitly-planned refinement (James's own
spec required a plan summary before editing, per its own instructions). Replaced the old fixed
"This Week/Last Week/2/3 Weeks Ago" tabs with a real prev/next/calendar week navigator, real
date-range table headers instead of relative labels, a derived "Overall status: X | N metrics
outside target: ..." line, section-level category icons, and a visibly distinct "No Data" vs
"No Target" badge. The real work was underneath: this page had **zero client-side caching** —
every week click was a full server round-trip re-running auth, manager-context resolution,
roster lookup, and team/manager lookup from scratch on top of the metrics query. Moved the
data-dependent half into a client component backed by a Server Action that re-runs just the
metrics fetch, cached by week in memory, prefetching the 4 most recent weeks on mount plus the
neighbors of wherever you navigate; URL syncs via `history.pushState` so the page shell never
remounts. Verified live: an already-cached week fires zero new requests, an uncached week
fires exactly one, browser Back correctly restores an earlier week.

Found and fixed along the way, not the point of the work: `metric-icon.tsx`'s category→icon
map used a taxonomy (`productivity`/`workload`/`attendance`) that never matched this app's
real categories (`ticket_case_work`/`inbound_call`/`outbound_call`), so 3 of 5 sections
silently fell back to the same generic icon on every row — this **was** the "same teal icon
everywhere" complaint from an earlier picker redesign, just not yet traced to its cause.

**3. Focus ring stuck on the week navigator** (`08bac05`) — James caught this via screenshots:
the prev/next buttons kept a visible teal focus ring through repeated clicks while stepping
back through weeks. Real, standard browser behavior (Chromium shows a focus ring on `<button>`
after any activation including a mouse click, unlike links or text inputs), not a bug in the
global focus-visible style. Fixed by blurring the button after its click handler runs.
Verified keyboard accessibility wasn't collateral damage: a real 17-keystroke Tab sequence
(not a scripted `.focus()`, which browsers treat differently) confirmed the ring still shows
correctly while tabbing to the button — it only clears after activation, identically for mouse
and keyboard.

**4. 1:1s picker redesigned twice**, both direct responses to James using the shipped result
and asking for more: first pass (`01446e5`, `ee9e708`) added sorting, line-based grouping, and
search to what had been an unsorted flat list; second pass (`ac47281`) widened the whole page
(`max-w-4xl` → `max-w-6xl`), removed the single `Card` wrapping each team's entire roster in
favor of open sections with a "Name · N employees · divider" header, replaced the vertical
avatar-above-name tiles with horizontal bordered cards (avatar/name/chevron), and replaced two
separate A-Z/Z-A buttons with one `Sort: A–Z` dropdown. Deliberately skipped the per-employee
status dot the mockup showed — real status needs a metrics batch-query across the whole
roster that doesn't exist on this page, the same query the old Team page ran before it was
deliberately deleted specifically to stop this page from being a "compare everyone" view;
adding it back here would quietly reverse that decision, so it was left out rather than made
unilaterally. Verified all 4 responsive breakpoints (1/2/3/4 columns at <640/640/768/1024px)
via `getComputedStyle`, not eyeballed from a screenshot.

Also this session, before the above: switched the work week from Monday-Sunday to
Sunday-Saturday company-wide (`6241d65`, Barbara confirmed Menufy's real work week; POS's is
still unconfirmed, see "Needs a human" below), removed the Team page/nav entirely (James's
decision, reverses a prior stakeholder-reviewed "two core experiences" shape — see
`CLAUDE.md`'s Product UX section), and fixed a real sidebar layout bug found while doing that
removal (`<nav>` had `flex-1`, leaving ~328px of dead space above the footer on a typical
screen). A separate, read-only percentile analysis of Menufy's range targets was also built at
James's request (`scripts/analyze-menufy-range-target-percentiles.ts`) but he decided to leave
Barbara's original targets unchanged through launch — see item #23 and the "What's still open"
section above.

## Repo state

Everything through this update is committed and pushed to `master` (`ac47281`). CI is green
and the latest Vercel production deployment is `READY`, both confirmed against the real
GitHub Actions run and Vercel API for this exact commit, not assumed from a local pass.
