# CLAUDE.md

> Read this file in full before writing any code or making any architectural decision.
> If a user request conflicts with anything here, flag it — do not silently override.

---

## Current Session Status

**Last updated:** 2026-07-10 (session 32)

- All 5 phases, 4 UI/UX sprints, layout redesign, and data integrity audit complete — pilot-ready
- Production: `hungerrush-scorecard.vercel.app` (frontend) · `scorecardapi-production.up.railway.app` (backend)
- **Session 32 (2026-07-10 — sprint 2 merged + reviewed; sprint 3 planned; Antigravity
  wave 3 QUARANTINED; fast-follow PR built, OPEN):** James merged **PR #19** (sprint 2,
  Antigravity-built: data-router/`createBrowserRouter` migration + `useBlocker` draft
  guard — the SPA-nav residual CLOSED — + a first PDF fonts/sparklines pass); post-merge
  review found a live **double-confirm** on dirty person-switches, a PDF **bold-weight
  regression riding a runtime Google-CDN fetch** (against the self-hosted-fonts policy),
  and gap-packing min/max PDF sparklines. Sprint 3 planned with Antigravity over three
  review rounds — **manual metric source architecture locked** (`'manual'` on the
  MetricSource enum, snapshots via RLS-scoped upsert, NO compute module/registry line,
  standalone ManualMetricsPanel; JSONB-on-notes rejected); James's Alex/Barb master list
  mapped in **`docs/sprint3-metric-coverage.md` (PR #20, MERGED `555f0b4`)** = the sprint
  acceptance checklist. **Antigravity wave 3 executed sprint 3 + fast-follow + a
  resurrected glassmorphic re-theme as ONE blob into James's checkout** — quarantined on
  `audit/sprint2-fast-follow` (`40251de` + capture `11f6dc0`, pushed, NEVER merge:
  lint 14 / 6 tests failing / 3 deleted; PDF-export + Share + freshness chips + ghost
  badges dropped; HTML-as-TTF fonts; unpasteable 0024; fabricated CLAUDE.md entry —
  full record in REVIEW.md wave-3 bullet). James: **re-theme dropped a second time**.
  Built **`audit/pr19-fast-follow`** (PR OPEN): useBlocker = the ONE guard (ScorecardPage
  confirm + dirty-prop chain removed; blocker-based tests), PDF real self-hosted TTFs
  (Inter normal+bold + Montserrat headings, verified TrueType, precache-excluded,
  helvetica offline fallback) + fixed-domain gap-preserving sparklines (`PdfMetric.domain`
  from the evidence view-model). Tests 193 → **194** (55 api / 107 web / 32 shared);
  typecheck ×3 / lint / build green. **NEXT: James merges the fast-follow (deploys
  pre-demo) → sprint-3 backend REPAIR on a clean branch** (salvage 40251de's backend:
  fix 0024 enum-transaction + is_active=false + ROLLBACK blocks, tests for all 12
  modules, PR-20 deltas incl. pct_ib_answered/tickets_solved/absences, Talk discovery
  gate, remove gen_telephony.js, verify periodEnd clamp, build ManualMetricsPanel) →
  **demo ON/AFTER Jul 13 on master** (smoke checklist).
- **Session 31c (2026-07-08 — PR #17 MERGED + wave-2 palette rebuilt, PR OPEN):** James
  merged #17 (`f4583df`; **/health sha verified serving it**). Antigravity's wave 2
  (Cmd+K palette + 3 unapproved deps clsx/framer-motion/tailwind-merge + a 366-line
  restyle) had withdrawn itself into the Antigravity UI on "finish" — it never reached
  git. James's call: rebuild the palette, drop the restyle. Built **`audit/command-palette`**:
  new `CommandPalette.tsx` — ZERO new deps (existing idioms replace all three), Cadence
  tokens, the S1 drawer's overlay pattern, combobox/listbox a11y with
  aria-activedescendant, person-jump via LAZY `useRoster` (inner content mounts on first
  open, so no query rides every page), role-gated pages reusing the sidebar gates,
  Ctrl/Cmd+K modified-chord listener that deliberately works while typing (no collision
  with PR-16's bare-key listener; Esc closes via the input's own handler) — plus an
  AppLayout header trigger (`⌘K`/`Ctrl K` chip) sharing the controlled open state.
  Tests 186 → **193** (55 api / 106 web / 32 shared); typecheck ×3 / lint / build green;
  npm audit 0 (no dep changes). REVIEW.md records: palette nav joins sidebar clicks in
  the unguarded-SPA-nav residual (data-router/useBlocker = the one fix). **NEXT: James
  merges the palette PR, then picks sprint 2 from REVIEW.md's deferrals.**
- **Session 31b (2026-07-08 — sprint 1 MERGED + external-review fix PR built, OPEN):**
  James merged PR #16 (`d06fcda`) — **sprint 1 COMPLETE** — then ran a Google Antigravity
  second-opinion review whose agent left an uncommitted 4-file changeset + test in the
  master checkout. Verified claim-by-claim before adopting: tests/typecheck green but
  **lint FAILED** (9 `no-explicit-any`), 6 `any`s total, graphSync's new listUsers
  pagination failed OPEN (a partial auth map would let pass 1 re-create existing auth
  users), the race-guard's refetch wrappers bypassed the guard and churned identity
  every render, the package-lock/jsdom "fix" was a no-op (EOL noise; jsdom already
  approved), and the changeset MISSED `useEmployee` — the same stale-response race on
  the person's NAME. Adopted onto **`audit/external-review-fixes`** with repairs:
  typed `User[]` + shared-`Employee`-projection generics (zero `any`), fail-CLOSED
  listUsers pagination (PR-1 precedent), and a **fetch-generation guard** (every load
  claims `++generationRef.current`; only the newest commits; guards refetch with
  stable identity; no effect cleanup needed — a new load already invalidates in-flight
  responses and React 18 no-ops post-unmount setState) across useEmployeeMetrics /
  useScorecardNotes / useEmployee; typed test harness + new useEmployee race test.
  Tests 181 → **186** (55 api / 99 web / 32 shared); typecheck ×3 / lint / build green.
  REVIEW.md discovered-entry records the adoption + the not-fixed lower-stakes race in
  useRoster/useManagerRollup. Master checkout cleaned after the branch captured the
  changeset (stray `hungerrush_cadence.jsx` at repo root left for James). **This PR is
  out-of-band hardening — sprint 2 still awaits James's pick from REVIEW.md deferrals.**
- **Session 31 (2026-07-08 — audit sprint PR 5 of 6 BUILT; sprint 1 COMPLETE on merge):**
  Pre-flight all green: PR #15 merged (`df43bf0`), zero stranded commits across the six
  `audit/*` branches, and **the first node-cron-v4 production cron VERIFIED** — `sync_run`
  audit row stamped 2026-07-08T18:06:48Z (408s, 250 employees, 545 metrics, 0 errors;
  a second clean manual run at 16:47Z) — the PR 2b post-deploy check is CLOSED. Built
  **PR 5 `audit/qol-sprint1`** (branch from `df43bf0`, 4 code commits + docs, green at
  every one): (1) **unsaved-note guard** (REVIEW 2.1) — NotesPanel derives a dirty flag
  from its draft fields, reports it up via `onDirtyChange` (clean on unmount), registers
  `beforeunload` while dirty; ScorecardPage routes EVERY person-switch through one
  `selectPerson` callback that `window.confirm`s before discarding a draft;
  (2) **optimistic action-item toggles** (2.2) — `toggleActionItem` flips local state
  before the write and rolls back on failure; both checkbox surfaces show the shared
  `ACTION_TOGGLE_FAILED_COPY` undo banner; (3) **keyboard basics** (2.3) — one window
  keydown listener: `/` focuses roster search, `←/→` step the roster via `selectPerson`
  (guard applies; clamped, no wrap), `Esc` clears search (the input's own handler owns
  Esc-in-box); inert while typing in any field or with modifiers; (4) **freshness
  chips** (2.8/1.12) — new `SyncFreshnessChip` (gray `synced X ago`, amber tint past the
  9h `STALE_AFTER_MS` bound) + `useDataFreshness` (one RLS-scoped max-`synced_at` read,
  failed refetch keeps last stamp) in the AppLayout header on every screen, plus a
  rollup-subtitle chip from the fetched rows' own max stamp (`synced_at` added to the
  rollup select; `AppLayout.subtitle` widened to ReactNode like `title`). Tests
  **162 → 181** (55 api / 94 web / 32 shared) incl. dirty-guard, beforeunload, and
  rollback paths; typecheck ×3 / lint / vite build green; npm audit 0. **Two entries
  added to REVIEW.md "Discovered during execution":** SPA route-nav (sidebar clicks)
  is NOT guarded — needs a data-router migration for `useBlocker`, sprint-2 candidate;
  and the rollup's subtitle chip + global header chip will usually agree (both were
  specified; dropping one is a two-line revert if James's pass dislikes the pair).
  **NEXT: James's merge = the deploy authorization** (visual before/afters in the PR
  body per decision 1), then **James picks sprint 2's contents from REVIEW.md's
  deferrals** (candidates on record: PDF brand fonts + sparklines 1.15/1.16 — the named
  best second-sprint item, share-link management 0.3/2.6, route-level tests 3.5,
  rollup search 1.13, covered-checks + note-insert QoL 2.4/2.5, metrics.md doc fix 3.4,
  briefing fade 1.4, print stylesheet 2.9, data-router migration for the full
  unsaved-note route guard). Standing: Entra roster fixes backburnered (IT); demo
  on/after Jul 13.
- **Session 30 (2026-07-08 — audit sprint, 5 of 6 PRs DONE; NEXT SESSION = sprint PR 5):**
  James ran a four-track review (**`REVIEW.md` at the repo root is the sprint tracker —
  read it before any sprint work**; execution-status header lists every PR + sha) and
  kicked off the "suggested first sprint" with hard rules: ONE PR at a time in order,
  stop-and-show diff summary after each, no scope creep (new finds → REVIEW.md
  "Discovered during execution", never fixed inline), data sweeps shown before
  execution, migrations additive-only, visual PRs carry before/after per screen.
  **Merged this session** (each verified via `/health` sha; James applied migrations +
  approved the sweep): **PR 1** `8f8228e` — org-sync classification never mints admin
  (manager-less → `employee`; admin+executive preserved FAIL-CLOSED), `0019` claims
  trigger respects `is_active` (strip on deactivate), audited sweep 279 minted admins →
  employee (backup CSV + audit_log; James = the only admin by enforcement now; probe
  passed); **PR 2a** `a14c8ce` — sync overlap guard (manual /run during a run → 409),
  one `sync_run`/`sync_run_failed` audit row per run, audit-POST scope check (employees
  SELECT under the CALLER's JWT = the existing visibility function); **PR 2b** `371b356`
  — vite 8 / vitest 4 / vite-plugin-pwa 1.3 / node-cron 4.6, **npm audit 7 → 0**,
  recharts removed (unused; also off the approved list), cron gate passed (3/3 patterns
  + exactly-one probe fire), PWA NetworkFirst semantics verified in dist/sw.js;
  **PR 3** `90f73c2` — ghost reconciliation: `0020` `employees.is_active`, graphSync
  pass 5 flips absent emails inactive / returned active with a mass-deactivation
  circuit breaker (>max(5, 20%) skips), "no longer synced" badges (roster chip,
  briefing header, rollup count) + rollup tone counts exclude frozen histories (the
  42701 error on 0020 was a double-paste — first run had succeeded); **PR 4** `f3b0d25`
  — contrast tokens `hr-gray-mid #687090` / `hr-teal-deep #2E6653` / `hr-coral-deep
  #A8442C` (ratios in tailwind.config comments; gray-light = decoration-only) + the ONE
  type scale (xs 11 / sm 12.5 / base 13.5 / lg 15 shadowing core steps; zero sub-16px
  arbitraries) + maskable-icon manifest scaffold (commented, awaiting design asset).
  Tests **154 → 162** (55 api / 75 web / 32 shared). **Next session: sprint PR 5
  `audit/qol-sprint1`** — scope + gates in REVIEW.md's execution-status header
  (unsaved-note guard, optimistic toggles, keyboard basics, freshness chips). **Pending
  checks:** first node-cron-v4 production cron (18:00 UTC Jul 8 — verify a `sync_run`
  audit row exists stamped ~18:07); IT owns the AD-disable session-survival check.
  Sprint-2 deferrals (do NOT start): PDF fonts/sparklines, share-link management UI,
  route-level tests, rollup search, covered-checks/note-insert QoL, metrics.md doc fix.
- **Session 29 (Phase 3 = Cadence, session 2 of 2 — CLOSED: PR #8, 12 commits, merged to
  master `3665473` + James browser-verified 2026-07-07, steps 1–6 confirmed; all-"new"
  rollup chips are CORRECT — only 3 weeks of history exist, trends unlock Jul 13 for
  rates / Jul 20 for counts; admin metric-config visual polish requested at the pass →
  PR #9 same day): CADENCE IMPLEMENTATION COMPLETE.** Branch
  `claude/phase3-cadence-2` from master `66c7b5c` (stranded-commit check clean), 11
  commits, green at every one (typecheck 3×3 / lint / vite build; tests 142→**154**:
  50 api / 72 web / 32 shared). Shipped: (1) **rollup reskin + trend migration = D6
  FULLY CLOSED** — `useManagerRollup` derives tone counts from `metricTone`
  (`lib/evidence.ts`: the ONE trendWindow+assessTrend+spec-band pairing, shared with
  useRoster), pure aggregation in `lib/rollup.ts` (tested), chips speak Cadence words
  (N improving / N to discuss / steady / new, full breakdown in tooltip/aria — band
  metrics read "steady", never a 0-win fraction), cards add the wins / to-discuss
  flag-count stat pair, row order = metric coverage then name (never performance),
  snapshot query is RLS-scoped over the 8-wk window (an org-wide id filter would blow
  URL limits); (2) **SharedScorecardPage = the briefing's evidence view-model** with
  per-ROW synced stamps (`showRowSyncedAt` — this page's per-tile rule), Cadence public
  shell, error cards with actions (network gets Try again via refetch); **KpiTile +
  its tests DELETED** (shared page was its last consumer); (3) **PDF redesigned** —
  navy band, per-metric both windows + tone word from the one engine (Improving / To
  discuss / Steady / New), L8 intact, watermark now on EVERY page, fed from the same
  evidence view-model the screen renders; (4) admin reskin (toggle teal, WarnBanner,
  save-state tints; S4/S8 behavior untouched) + login/callback on a shared `AuthCard`
  (callback → /scorecard directly); (5) **S10 CLOSED** (real 404 card; `/` redirect
  explicit) + **S12 CLOSED** (`useDocumentTitle` per route; AppLayout focuses the page
  heading on page mount — not on same-page person switches; aria-current shipped s1);
  (6) **transitional aliases RETIRED** — ErrorBoundary + OfflineBanner were the last
  old surfaces; alias block, borderWidth.half, hr-base/hr-strong, and the index.css
  border-half utility deleted, grep-verified zero usages, CLAUDE.md token note flipped
  in the same commit; (7) component tests for ActionItemsList / NotesPanel / MetricRow
  / RollupCard / MetricCard / LoginPage / NotFoundPage / SharedScorecardPage; (8) demo
  checklist re-worded against the shipped UI + **pilot guide rewritten for Cadence**
  (the refactor plan's after-Phase-3 F2/pilot-drift fix). Composite-score audit re-ran
  clean on every new surface (all aggregates are flag/trend counts; no composite, no
  rank, no per-person overall number). **Same-day follow-ups after the merge:**
  (a) **roster-diff audit** (read-only, against Alex's + Barb's real rosters) — Cadence
  matches Azure AD almost perfectly; findings live in `docs/demo-smoke-checklist.md`
  preconditions: Normando has TWO AD accounts (`bonadiajr@` = data-carrying, reports to
  Alex = RLS-invisible; `bonadia@` = empty dupe under Courcy — fix AD-side, never
  hand-edit manager_id, the org sync overwrites it), Michael Diamond exists in Entra
  but wasn't in the last sync's Graph result (check enabled → next org sync creates
  him), **Emma Veazey SETTLED = Mike's** (queue roster borrows her), Rejohn Lunze
  Cuares needs Barb's confirm, 5 name spellings differ AD-vs-roster (all present with
  data); (b) **PR #9**: admin metric-config polish (compact Cadence cards) + this docs
  flip. **Next: merge PR #9 → Entra fixes → one `POST /api/sync/org` → audited removal
  of the stray normando.bonadia@ employees row (James-approved protocol: backup +
  audit_log) → demo ON/AFTER Jul 13** (rates trend-unlock; counts Jul 20). Post-Phase-3
  fast-follow (logged, NOT built): PersonContext fields + manager edit UI (ADOPTION
  decision 3; dormant branches in `apps/web/src/lib/coaching.ts`).
- **Session 28 (Phase 3 = Cadence, session 1 of ~3 — CLOSED: PR #7, 11 commits, merged to
  master `66c7b5c` + James browser-verified 2026-07-07, 11-step pass "looks good" incl.
  count anchoring and the S1 drawer):** kickoff gate met (PRs #5 + #6 merged +
  live-verified at master `37f6779`, **Phase 2 CLOSED**; stranded-commit check clean).
  Branch `claude/phase3-cadence`, 8 commits, green at every one (tests 79→118 / typecheck
  3×3 / lint / vite build). Shipped: (1) token swap + self-hosted Montserrat/Inter/IBM Plex
  Mono woff2 (Google Fonts @import gone; old token names remain ONLY as transitional
  aliases re-pointed at Cadence values — die with the last old surface); (2) the ONE trend
  engine `packages/shared/src/trend.ts` (current vs prior-period average capped at 4
  preceding points, ±6% inclusive, direction-aware, band via `bandPosition`, <4 points =
  new) + MetricSpec `domain`/`band` (occupancy band 75–88); (3) flags-only coaching engine
  (`apps/web/src/lib/coaching.ts`, dormant PersonContext branches for the fast-follow;
  forbidden-language test sweeps every generated string); (4) **the Cadence inversion**:
  `/scorecard/:employeeId?` is home (roster strip + briefing + evidence panel;
  `DashboardPage`/`useDirectReports` DELETED, `/dashboard` = search-preserving redirect);
  briefing = talking points (start-here + opening question) → open action items (12-week
  window) → week-grouped notes; evidence rows carry BOTH labeled windows (this wk headline ·
  last wk secondary) + always-visible DB coaching_prompt; per-source `N wk` chip + synced
  stamp + amber degradation banner (9h staleness bound — see the api cron comment);
  (5) Cadence app chrome + S1 mobile drawer CLOSED + PWA/app renamed "HungerRush Cadence";
  (6) 8-finder code review applied (commit 7): honest stale-value copy, per-person-honest
  degradation wording, drill-down shows full team, hasData = current-or-last-week again,
  KpiTile badge now derives from assessTrend (public shared page can't contradict the
  briefing). **D6 is closed EXCEPT rollup chips** (`useManagerRollup` still counts
  this-vs-last-week; migrates with the rollup reskin). **Both flagged decisions RESOLVED
  same day — James: "do what you recommend":** commit 9 anchors count-unit trends to the
  last completed week (`trendWindow` in shared; rates keep live values; coaching copy
  speaks in matching tense — now / last week / at last sync); commit 10 adds jsdom +
  re-adds @testing-library/react (devDeps) with the first 16 component render tests
  (TalkingPoints, EvidencePanel, RosterStrip, KpiTile) via per-file jsdom pragma.
  Final session-1 state: 11 commits, tests **142** (50 api / 60 web / 32 shared).
  **Session 2 scope:** rollup reskin (+ its trend migration = D6 fully closed),
  SharedScorecardPage (keeps per-tile synced stamps), PDF export design, admin pages,
  login, S10 404, S12 titles/aria/focus, component tests for the remaining surfaces,
  transitional-alias retirement, `docs/demo-smoke-checklist.md` at the end.
- **Session 27 (Phase 2 hardening — CLOSED, merged + live-verified 2026-07-07):** refactor plan §d commits 12–17, all built and green
  (79 tests / typecheck 3×3 / lint at every commit). Commit 12 dead-code sweep (+ L14 comment,
  + Azure AD `jobTitle` trim — existing padded titles clean up at the next org sync); commit 13
  D2–D5/D9 unification (D6 excluded — Cadence owns trend centralization; **side effect: the
  public shared page's trend badges were computed against the OLDEST point** because the share
  API returns snapshots newest-first — the one mapping util sorts ascending, fixing them);
  commit 14 = the Cadence prerequisite (ONE hook contract `{ …data, loading, error, refetch }`
  documented in agents/FRONTEND.md — failed same-key refetch keeps last good data; AuthProvider
  = ONE auth subscription; `AuthGuard roles={[…]}` is the ONLY role gate, `/rollup` includes
  `executive`, `/admin/*` stays admin; OfflineBanner app-wide in AppLayout); commit 15 tour
  close/skip/persist + rollup cards as real buttons + export-log latest-100 note with bounded
  lookups + login signingIn recovery + per-card metric save state (Saving…/Saved/Save failed).
  **Mid-session approvals (James):** `POST /api/sync/run` now returns 202 and runs
  in-container (`bb449cc`); dedicated `SYNC_TRIGGER_KEY` replaces the service key as the
  x-sync-key secret, fail-closed (`946a836`) — **James adds that Railway var BEFORE merging
  PR #5**; the `fulfilling-alignment - @scorecard/web` GitHub status is a confirmed-stale
  check context (service already deleted — ignore it; `/health` sha stays the only deploy
  truth). Commit 16 CORS locked to `ALLOWED_ORIGIN` (= `https://hungerrush-scorecard.vercel.app`,
  James-confirmed) + `localhost:5173`, matrix verified against a local boot; **live check
  within minutes of #6's deploy: prod frontend + a shared-link page in a real browser**.
  **Merge order: add SYNC_TRIGGER_KEY → merge #5 → `/health` sha + smoke per PR body →
  merge #6 (carries commit 16 + this docs commit) → CORS browser check.** Phase 3 kickoff
  prompt delivered: `docs/phase3-cadence-kickoff.md`.
- **Session 26 (W2 release readiness — CLOSED, merged and executed 2026-07-06):** PR #3 →
  master `35bea86`, serving sha verified via `/health` 19:16 UTC. **Post-merge steps ALL
  EXECUTED**: 0017 + 0018 applied by user (SQL editor) + RLS probe passed BEFORE the merge;
  Adam Seow → `executive` 19:24 UTC via audited service-key write (`role_change_service_write`
  in audit_log; `app_metadata.role` propagation confirmed); org sync run 19:25–19:27 UTC —
  359 profiles updated, 338 employees written, 0 errors. **Executive guard verified live**:
  pass 2 re-upserted Adam's row mid-sync (updated_at 19:26:06) and the role held. **Titles
  backfilled 335/353** (18 nulls = `jobTitle` unset in Azure AD — correct null semantics);
  2 new-hire employees created (agent-matching at the next 05:00 bootstrap). Remaining:
  Adam's fresh sign-in (org-wide rollup, `/admin/*` redirects) — also a demo-day checklist
  item. Cosmetic follow-up: some Azure AD titles carry leading whitespace (e.g. Normando's
  " Technical Support Specialist") — a one-line `trim()` in graphSync's jobTitle mapping.
- **Session 26 implementation record (what PR #3 contains):**
  `executive` role end-to-end: `0017` adds the enum value + `visible_manager_ids()` executive
  branch (all active manager-role profiles org-wide, `executive` included) + JWT-claims
  `profiles_select_executive` policy — the migration only ADDs the value (unusable in its own
  transaction); assignment is a separate audited service-key write
  (`scripts/set-adam-executive.ts`, dry-run verified: adam.seow@hungerrush.com,
  senior_manager today; org scope 87 active manager-role profiles / 351 employees).
  **graphSync now preserves manually-assigned executives** — without this the next org-sync
  run (`POST /api/sync/org`, manual trigger; NOT on the daily cron — the 05:00 job only
  matches agent IDs) would silently reclassify Adam back to senior_manager. Frontend gates
  add executive beside senior_manager (AppLayout rollup nav, RollupPage); admin gates untouched.
  `employees.title` (`0018` + graphSync `jobTitle` mapping + scorecard-header line; backfills
  at the first post-deploy org sync). CLAUDE.md amendments: philosophy (visual/tonal frame),
  coral `#C4553A` attention accent (Cadence), Cadence trend semantics, executive in RBAC rules
  + decisions log. `docs/demo-smoke-checklist.md` written (executed on the Cadence UI at the
  demo; **Normando Bonadia Jr decision carried there — confirm with Alex, don't pre-implement**).
  RLS claim-simulation probe: `scripts/rls-probe-executive.sql` (temp-promote inside a rolled-back
  transaction; asserts org-wide visibility AND admin-policy exclusion). Tests 79 green,
  typecheck + lint clean. **Post-PR order (in the PR body): apply 0017 → 0018 → run probe →
  merge → `/health` sha → `set-adam-executive.ts --execute` → trigger `POST /api/sync/org`
  (backfills titles AND live-verifies the executive guard: Adam must still be executive
  after it) → Adam's JWT updates at his next sign-in.** Housekeeping: PR carries forward
  `6d67202` + `5eb6ffe` (session-25 close-out + Cadence adoption records) — they were
  committed after PR #1 merged and never reached master.
- **Session 25 (refactor Phase 1C — CLOSED, deployed and executed 2026-07-06):** all of §d
  live in prod at master `b255976` (PR #1; `/health` sha verified 17:46 UTC). `54722f6` commit 6
  (L2 — `week.ts` in shared, all 5 sites), `3e51a0f` commit 7 (L1 — frt/resolution from
  created-in-period tickets; **csat from ratings SUBMITTED in period** via
  `satisfaction_ratings?score=received`, org-fetch once per run), `4a344e1` commit 7b (L11:
  business:0/calendar>0 off-hours replies excluded; 0/0 instant replies stay), `112ec75` commit 8
  (L4), `9c9ca5e` commit 9 (L5 calendar-mapped sparklines), `63e2497` migration 0016 (**applied
  by user via SQL editor**), `64126ad` commit 10 (L6 — empty productive-state intersection ⇒
  null), `2a7d4ba` commit 11 (L8 PDF zeros), `5becfe2`+`063add2` correction scripts. Tests
  56→79. Verification: stash-controlled back-to-back prod syncs per fix (re-derivation tables in
  refactor-plan 1C notes). **Data corrections executed, both audited in `audit_log`**: 10b
  deleted 249 occupancy/adherence zero rows (weeks Jun 22+29); the deploy-week stale-semantics
  sweep deleted 123 old-semantics frt/resolution/csat rows after the 18:00 cron — week
  2026-07-06 is single-stamp, zero stale. **First new-code cron verified DB-side** (18:00:02
  stamp: 381 rows — tv 249 / resolution 63 / frt 58 / csat 11; Assembled re-enabled, wrote 0
  rows / 0 zeros = correct L6 null until WFM mapping matches). **S4 CLOSED, user-verified**:
  occupancy+adherence re-enabled through the admin UI, save held after reload. Historical
  completed weeks (Jun 22/29) keep old-semantics values by design (constraint 7) — expect
  frt/resolution/csat trend baselines to shift semantics at the Jul 12 snapshot.
- **Session 23 (refactor Phase 1B — CLOSED):** Metric registry refactor live in prod at `fd00d99`. `7113691`: MetricSpec + METRIC_SPECS in shared; `apps/api/src/metrics/` one module per metric (computes moved verbatim, L6/L9/L11 pinned); boring registry; connectors → fetch-shape (`prepareRun` + `fetchWeekData`, all three together; ConnectorMetricResult retired); **sync writes registry ∩ `is_active`** (a source with no active metrics is skipped — currently zero Assembled API calls); KpiTile/RollupPage labels from METRIC_SPECS. `9b7cda4`: add-a-metric recipe in docs/metrics.md. Tests 52→56 (composite empty-input decomposed per metric; expectations unchanged). **Parity PASS, user-verified**: 741-row dumps identical except 54 live-drift changes on 17 employees; 0 lines + 0 writes for the 4 toggled keys; Zendesk write counts identical (615). **Deploy incident resolved** (`cc54eb9`+`fd00d99`+`91084f9`): first runtime value import from shared broke `node dist/` boot; two failed deploys left a **rolled-back old container serving while the GitHub status said success** (18:00 cron ran old code). Api now boots via `./node_modules/.bin/tsx apps/api/src/index.ts` — **railway.toml `startCommand` is the authoritative boot path** — and `/health` returns the running `sha` (the only trustworthy deploy check). Post-deploy watch (extended to 2026-07-06): every run that executed ran new code cleanly (0 toggled-key writes; Sunday snapshot froze week Jun 29, 626 rows; Mon 05:00 bootstrap + 14:00 live clean) — **but ~18 scheduled live syncs Jul 2 22:00 → Jul 6 10:00 never executed: OPEN cron-reliability issue, Railway-side, tracked at the top of the refactor plan (user must check dashboard: app-sleep, restarts, memory)**.
- **Session 22 (refactor Phases 0 + 1A):** Phase 0 audit approved (`docs/refactor-plan.md` — read it before ANY refactor work; cross-session source of truth). 1A: characterization tests; paginated backup/dump scripts; L7 fixed; ESLint repaired. Four metrics set inactive 2026-07-02 (audited service-key write; admin UI saves broken — S4). Data correction approved → 1C commit 10b; semantics split approved (commit 7).
- **Session 20–21:** Agent matching 63→246/351 (105 unmatched are non-support); daily bootstrap cron 05:00 UTC. Playwright MCP install unresolved.
- **Next up — `docs/release-plan.md` is the approved sequencing (2026-07-06), it wraps the refactor plan:** ~~W0 cron reliability~~ **RESOLVED — false alarm** (Railway logs prove every cron fired on time since `91084f9`; the DB per-window counting method was invalid — `synced_at` is last-writer-wins; verify crons via Railway logs or current-window-only counts; vestigial `@scorecard/web` Railway service removed) → ~~W1 = Phase 1C + `0016`~~ **DONE session 25 (2026-07-06) — deployed, corrections executed, S4 closed** → **RESEQUENCED 2026-07-06: Cadence v2 (`docs/design/hungerrush-cadence/` — ADOPTION.md is the decision record) replaces the old Phase 3 design source, and the demo moves AFTER its implementation.** New order: W2 → Phase 2 hardening → Phase 3 = Cadence (2–3 sessions) → demo → W3/W4 → W5. → ~~W2 release readiness~~ **DONE session 26 (2026-07-06) — PR #3 merged (master `35bea86`) AND all post-merge steps executed: migrations applied + probed, Adam is `executive` (audited), org sync verified the guard live, titles backfilled 335/353; only Adam's fresh sign-in remains (demo-day item); James stays the only admin** → ~~Phase 2 hardening~~ **DONE session 27, closed 2026-07-07 — PRs #5 + #6 merged + live-verified (master `37f6779`); S5 hook contract + executive-aware guard landed; async 202 + SYNC_TRIGGER_KEY live; CORS check passed** → **Phase 3 = Cadence (sessions 28–29, 2026-07-07 — IMPLEMENTATION COMPLETE; PR #7 merged, session-29 PR #8 closes the phase on merge + browser verification)** → **small release demo to Alex Smith / Barb Maenza / Mike Pacilio / Adam Seow** (run `docs/demo-smoke-checklist.md`; Normando decision confirmed with Alex there) → W3/W4 metric expansion (Zendesk Talk calls, backlog, tickets_assigned) → W5 Assembled hours. Master-list disposition table for Alex/Barb is in the release plan. Philosophy clarification (user, 2026-07-06): coaching-first = visual/tonal frame; negative-direction metrics are in-scope content; no red / coaching language / no composites / no rank unchanged. Verification cautions that remain true for every future sync validation: verify completion DB-side (Railway proxy kills HTTP at 300s), trust only `GET /health` → `sha` for deploys (GitHub statuses post success for watch-path-skipped commits), and verify crons via Railway logs (`[cron]`) — historical `synced_at` window-counting is invalid.
- **Remaining feature work (post-Phase-3 fast-follow, not yet scheduled):** per-person
  context fields (workload/growth/ramping/personal) + manager edit UI — ADOPTION.md
  decision 3; the coaching-engine template branches already sit dormant in
  `apps/web/src/lib/coaching.ts` (new table + RLS + UI when it lands). S1 mobile
  navigation CLOSED in Phase 3 session 1.
- **Remaining hardening:** email nudge (needs `RESEND_API_KEY`). **Org-sync admin
  classification — FIX SHIPPED in audit PR 1 (`audit/admin-role-fix`, 2026-07-07,
  REVIEW.md 0.2):** classification now assigns manager-less accounts `role='employee'`
  (still flagged for review); `admin` joins `executive` as audited-write-only and the
  sync preserves both fail-CLOSED (a failed preserve-lookup writes no roles at all —
  fail-open would have demoted the only admin); `0019` makes the JWT role claim
  conditional on `is_active` (strip on deactivate; trigger fires on role AND is_active);
  one-time audited sweep `scripts/sweep-admin-roles.ts` reclassifies the 279 minted
  admins (keep-set determined from data), verified by `scripts/rls-probe-admin-sweep.sql`.
  Residual: existing-session survival after AD-disable is an IT-side empirical check
  (claims fix propagates at token refresh ≤1h). CORS lockdown landed in Phase 2 (PR #6). The old "connection pooling
  (`?pgbouncer=true`)" item is REMOVED as not applicable — nothing here opens a direct
  Postgres connection (supabase-js speaks HTTP to PostgREST); full explanation lives in
  the refactor plan's pgbouncer finding
- **Known data/logic issues:** now tracked with classifications in `docs/refactor-plan.md` §f (L1–L14) — the four previously listed here plus sparkline calendar gap, Assembled zero-writes, 1000-row truncation, PDF zero treatment, and others

---

## Development Commands

npm workspaces monorepo — always run `npm install` from root.

```bash
# Install (from repo root — required for workspace resolution)
npm install

# Dev servers
npm run dev:web          # Vite on http://localhost:5173 (frontend)
npm run dev:api          # tsx watch (backend, needs .env in apps/api/)

# Typecheck (all workspaces, or individually)
npm run typecheck                                    # all 3
npx tsc --noEmit --project apps/web/tsconfig.json    # web only
npx tsc --noEmit --project apps/api/tsconfig.json    # api only
npx tsc --noEmit --project packages/shared/tsconfig.json  # shared only

# Build
npm run build            # all workspaces
npm run build -w apps/web    # web only (tsc + vite build → apps/web/dist/)
npm run build -w apps/api    # api only (tsc → apps/api/dist/)

# Tests
npm run test             # all workspaces (vitest)
npm run test -w apps/web     # web only
npm run test -w apps/api     # api only

# Lint (web only)
npm run lint -w apps/web     # eslint src
```

**Deployment:** Vercel auto-deploys frontend from master (build uses `vercel.json` which runs `npm ci && npm run build -w apps/web`). Railway auto-deploys backend from master.

### Production URLs
- **Frontend (Vercel):** `https://hungerrush-scorecard.vercel.app`
- **Backend (Railway):** `https://scorecardapi-production.up.railway.app`

### Operational notes
- **Railway's edge proxy times out HTTP responses at 300s** (found 2026-07-02): a manual
  `POST /api/sync/run` returns `upstream error` after exactly 5 minutes while the sync
  keeps running in-container. Verify manual runs DB-side: rows share one `synced_at`
  stamp per run; completion = fresh-stamp count plateaus and fresh `ticket_volume` count
  equals employees processed (~247). Phase 2 hardening candidate (do not build early):
  make `/api/sync/run` return 202 immediately and run async.
- **Verify deploys via `GET /health` → `sha`** (returns `RAILWAY_GIT_COMMIT_SHA` of the
  running container, added 2026-07-02). The GitHub commit status (context
  `... - @scorecard/api`) is a useful early signal but proved unreliable during the 1B
  deploy incident: it reported success while a rolled-back old container was still serving
  and firing crons. Root cause found 2026-07-06: the service has **Railway watch paths** —
  commits outside them (docs-only, and notably railway.toml itself) post status success
  with description "No deployment needed - watched paths not modified" and do NOT deploy.
  Read the status description, then trust only the `/health` sha.

---

## What this is

A coaching-first 1:1 scorecard tool for HungerRush managers. Weekly metric data from Zendesk and Assembled surfaces in a clean UI managers use during 1:1 conversations. The philosophy is growth and momentum — never judgment or punishment.

**Philosophy amendment (user, 2026-07-06 — W2):** coaching-first governs the **visual/tonal
frame, not the content**. Negative-direction metrics (missed/declined calls, backlog, SLA
breach framing) are in-scope content — surfaced supportively as things to discuss, never
punitively. No composite scores, no rank, and the coaching-language rules are unchanged.

---

## Architecture principle — read before the stack table

Two ways data moves, and the distinction governs every design choice:

1. **Reads of data a user is allowed to see** go directly through the Supabase client with RLS
   enforcing access. No Express endpoint needed — RLS is the access control.
2. **Connector syncs, scheduled jobs, and anything touching external API secrets** go through
   the Express backend. The backend exists specifically for this — it is NOT a general-purpose
   API mirror of the database.

If you find yourself writing an Express route that just reads a table and returns it, stop —
that should be a direct Supabase query with an RLS policy instead.

---

## Stack — do not deviate without explicit approval

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Frontend host | Vercel |
| Backend (connectors + jobs only) | Node.js + Express + TypeScript |
| Backend host | Railway |
| Database + Auth + direct reads | Supabase (Postgres + RLS + Auth) |
| SSO | Microsoft Entra ID (formerly Azure AD) via Supabase Auth |
| Notifications | Email via Supabase (built-in) — weekly manager nudge |
| PWA | vite-plugin-pwa |

**Not included yet (add only if a real need appears):**
- **Redis** — Postgres is the cache. The sync job writes results to `metric_snapshots`; the
  frontend reads from Postgres, never from live APIs. Add Redis ONLY if sync jobs start hitting
  Zendesk/Assembled rate limits — and document the evidence when you do.

**Never introduce:** Firebase · Prisma · GraphQL · Next.js · any ORM · any full UI component library

---

## Repo structure — enforce exactly, do not reorganize

Monorepo with npm workspaces. The `packages/shared` workspace is the key to preventing
frontend/backend contract drift — both apps import types and Zod schemas from it.

```
/
├── CLAUDE.md
├── package.json              workspaces: ["apps/*", "packages/*"]
├── packages/
│   └── shared/src/
│       ├── types.ts          ALL shared domain types — single source of truth
│       ├── schemas.ts        Zod schemas; TS types inferred from these (z.infer)
│       └── metricSpec.ts     MetricSpec + METRIC_SPECS — code-side metric identity/labels
├── apps/
│   ├── web/src/
│   │   ├── components/        shared UI components
│   │   ├── features/          scorecard · notes · admin · auth
│   │   ├── hooks/             all data fetching (never fetch in a component body)
│   │   ├── lib/               supabase client · utils · constants
│   │   └── types/             web-ONLY types (props, UI state) — domain types come from shared
│   └── api/src/
│       ├── connectors/        one file per source, all implement DataSourceConnector (fetchers)
│       ├── metrics/           one module per metric (spec + pure compute) + boring registry
│       ├── routes/            thin handlers — validate → call service → return
│       ├── services/          all business logic
│       ├── middleware/        auth · rate limiting · error handling
│       └── types/             api-ONLY types — domain types come from shared
├── supabase/
│   ├── migrations/            numbered .sql files only — never edit existing ones
│   └── seed.ts                dev-only fake data
└── docs/
    ├── architecture.md        update after every schema change
    ├── metrics.md             metric definitions + coaching prompt logic
    └── decisions.md           append-only architectural decisions log
```

**Type rule:** any type describing a domain object (Employee, MetricSnapshot, etc.) lives in
`packages/shared`. The `types/` folders inside each app are only for that app's local types
(React prop shapes, internal API helpers). When in doubt, put it in shared.

---

## Connector interface — sacred, never change without updating all three connectors

Lives in `packages/shared/src/types.ts`. Evolved in Phase 1B (2026-07-02) from
compute-shape to fetch-shape — connectors fetch raw week data; the metric modules in
`apps/api/src/metrics/` compute from it (`ConnectorMetricResult` retired with that change).

```typescript
export interface DataSourceConnector<TRunContext, TWeekData> {
  name: string;
  isAvailable: boolean;
  // Run-scoped data fetched once per sync run (SLA target, org-wide activities),
  // passed back into every fetchWeekData call.
  prepareRun(periodStart: Date, periodEnd: Date): Promise<TRunContext>;
  // One agent's raw week data; null = agent unknown to this source (no write, not an error).
  fetchWeekData(agentRef: string, periodStart: Date, periodEnd: Date, run: TRunContext): Promise<TWeekData | null>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}
```

The sync writes **registry ∩ `is_active`** — a metric is collected only when it has both a
registry module and an active `metric_definitions` row; a source with no active metrics is
skipped entirely. Adding a metric: recipe in `docs/metrics.md`.

**Forethought stub:** `isAvailable: false` · `fetchWeekData` returns `null` · never throws · logs a warning only

---

## Database rules

- **Never drop a column** — add with a default instead
- **Never edit an existing migration** — always create a new numbered file
- **RLS on every table** — no exceptions. RLS is the primary access control for direct reads.
- **Every migration includes a `-- ROLLBACK:` comment block**
- Snapshot job is idempotent — check before insert, never duplicate a week's snapshot

**Core tables (locked names):**
`profiles` · `employees` · `metric_definitions` · `metric_snapshots` · `scorecard_sessions` · `session_notes` · `share_tokens` · `audit_log`

---

## Auth & RBAC rules

- Microsoft 365 SSO only via Supabase Auth — never build a password flow
- **Access control lives in RLS first.** Direct Supabase reads are governed by row-level policies.
  Express routes that wrap connector/job logic additionally validate the JWT in middleware.
- Role hierarchy: `admin` > `executive` > `senior_manager` > `manager` > `employee`
- Managers fetch only their own direct reports
- Senior managers see one level down (their managers' reports) — NOT the whole company
- Executives (added W2, 2026-07-06) see every active manager's team org-wide — admin-like DATA
  visibility only; admin pages and admin policies stay closed to them. The role is assigned
  only by audited service-key write (graph sync classification never produces or overwrites it)
- All scoping flows through one `SECURITY DEFINER` helper `visible_employee_ids()` that uses
  `auth.uid()` internally; every RLS policy references it (see DATABASE agent). Never inline
  hierarchy logic in individual policies — that is where scoping bugs hide.
- Share tokens: UUID v4 · 72-hour expiry · reusable until expiry · `used_at` records first access · every use written to `audit_log`

---

## Environment variables

```
# Railway (backend — never expose to the frontend)
SUPABASE_URL
SUPABASE_SERVICE_KEY            # bypasses RLS — backend jobs only, never sent anywhere
SYNC_TRIGGER_KEY                # x-sync-key secret for manual /api/sync/* triggers (Phase 2 — the service key must never double as an HTTP credential)
ZENDESK_SUBDOMAIN
ZENDESK_EMAIL
ZENDESK_API_TOKEN
ASSEMBLED_API_KEY
ALLOWED_ORIGIN                  # CORS allowlist origin, e.g. https://hungerrush-scorecard.vercel.app (wired in Phase 2 commit 16)

# Vercel (frontend — VITE_ prefix ONLY for these three)
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY          # anon key only — RLS does the real enforcement
VITE_API_URL
```

The Microsoft Entra (Azure AD) connection is configured in the Supabase dashboard under
Authentication → Providers, NOT via a backend env var. Supabase handles the OAuth flow; your
code never sees the tenant ID or client secret directly.

**Never** prefix a backend secret with `VITE_` — Vite bundles anything `VITE_`-prefixed into the
public JS bundle where anyone can read it. The service key in particular bypasses RLS — if it
leaks, every access control is void.

---

## UI rules

**Brand tokens — configure in tailwind.config.ts, use nowhere else (Cadence set, Phase 3
2026-07-07 — values from the `T` object in `docs/design/hungerrush-cadence/cadence-v2.jsx`;
`-deep`/`-mid` contrast tokens added by audit PR 4, 2026-07-08 — WCAG ratios computed and
recorded in tailwind.config.ts comments):**
```
hr-navy:        #0C1443   headings · nav · primary ink
hr-navy-soft:   #3A3F6B   eyebrows · secondary navy
hr-teal:        #3B8272   brand accent — fills/borders/dots/strokes; as TEXT only ≥18px bold or on navy
hr-teal-deep:   #2E6653   teal TEXT at body sizes (tints + white)
hr-teal-tint:   #EAF3F0   positive tint backgrounds
hr-coral:       #C4553A   the ONE attention accent — "discuss", never "alarm"; fills/dots/large stats
hr-coral-deep:  #A8442C   coral TEXT at body sizes (tints + white)
hr-coral-tint:  #FBF1EE   lead discuss-card background
hr-amber:       #E9930F   system degradation (stale sync) — fills/borders only
hr-amber-tint:  #FDF4E3   stale-banner background
hr-amber-deep:  #8A5A0B   amber TEXT (WarnBanner etc.)
hr-bg:          #F6F7F9   page background
hr-card:        #FFFFFF   card surface
hr-line:        #E3E6EE   borders · dividers
hr-gray:        #5C607E   secondary text
hr-gray-mid:    #687090   tertiary TEXT (labels · stamps · sublines)
hr-gray-light:  #9EA2BC   decoration ONLY (dots · accents) — NEVER text (2.5:1)
```
**The rule of thumb (audit PR 4): colored TEXT at body sizes uses the `-deep`/`-mid`
variant; base hues stay for fills, borders, dots, sparkline strokes, and large display
stats (≥18px bold passes as large text).**
The pre-Cadence names (hr-green, hr-sand, hr-text-*, …) are GONE — their transitional
aliases were retired 2026-07-07 with the last old surfaces (Phase 3 session 2). Only
the Cadence tokens above exist; a class referencing an old name silently renders
unstyled, so treat any hr-green/hr-sand/hr-text-* sighting in a diff as a bug.

**Typography (self-hosted woff2 in `apps/web/public/fonts/` — no Google Fonts @import,
no icon webfonts; lucide-react only):** Montserrat = headings (`font-heading`) ·
Inter = body (`font-sans`) · IBM Plex Mono = metric values (`font-mono`).
**Type scale (audit PR 4, 2026-07-08):** ONE tokenized scale below 16px — `text-xs` 11px
(labels/eyebrows/chips/stamps) · `text-sm` 12.5px (sublines/meta) · `text-base` 13.5px
(body) · `text-lg` 15px (emphasized/titles). These SHADOW Tailwind's core steps so an
accidental core class can't reintroduce an off-scale size; arbitrary `text-[Npx]` below
16px is a bug in review. Display sizes (16px+) stay per-surface.

**Performance state colors:** coral for discuss · teal for wins · gray for steady/new —
dots/fills use the base hues, body-size TEXT uses `-deep`/`-mid` (see the token rule
above). hr-amber is NOT a performance state — it marks system degradation (stale sync,
notes tone) only.
**Never use red for any performance state — AMENDED 2026-07-06 (Cadence adoption):** coral
`#C4553A` (warm terracotta) is the one sanctioned attention accent for performance states,
always framed as "discuss", never "alarm". True red stays reserved for genuine system errors —
failed save, lost connection — never for an employee's metrics. The coral token SHIPPED with
the Phase 3 Cadence token swap (2026-07-07) as `hr-coral`.

**Every KPI tile must show:** metric name (from DB) · value + unit · trend/status indicator ·
sparkline over the metric window (8 calendar weeks as of Cadence, 2026-07-07 — missing
weeks stay visible gaps, never packed) · coaching prompt (from DB). Last-updated timestamp: a section-level "synced"
chip is acceptable (amended 2026-07-02 with the accepted Phase 3 design) — EXCEPT on
SharedScorecardPage, where each tile must still show the synced timestamp.

**Coaching language:**
- ✅ Use: "improving" · "growing" · "opportunity" · "strong week" · "building toward"
- ❌ Never: "failing" · "below target" · "underperforming" · "score" · "red flag"

**Loading states:** skeleton loaders only — never spinners
**Empty states:** always include a message + a suggested action — never blank

---

## Data & scoring model

Two data windows shown on every scorecard, clearly labeled:
1. **This week so far** — latest synced data, refreshed every 4 hours
2. **Last week (completed)** — frozen snapshot from the Sunday 23:59 UTC batch job

**On scores — the rule and its one carve-out:**
- No single composite performance score is ever shown for an individual employee. That is the
  punitive framing this tool exists to avoid.
- Aggregate *trend direction* IS allowed and is necessary for the senior manager rollup —
  e.g. "6 of 8 of this team's metrics are improving this month." This points attention without
  ranking a person. Trend direction is computed, never stored as a grade.

**Trend semantics (adopted 2026-07-06 — Cadence, supersedes all earlier trend definitions):**
ONE definition everywhere — current value vs the **prior-period average**, ±6% steady
threshold, direction-aware, band metrics supported (healthy range, not a direction), sparse
history (<4 points) = "new" state (trends unlock at week 4). Applies to tiles/rows, rollup
chips, and frozen last-week views alike. **Amended 2026-07-07 (James):** count-unit metrics
are weekly sums, so their "current value" is the **last completed week** when the view shows
the in-progress week (`trendWindow` in `packages/shared/src/trend.ts`) — a partial Monday is
bias, not signal; rates/averages keep the live value so a mid-week CSAT drop stays visible.
Implemented in Phase 3 session 1; only the rollup chips still run pre-Cadence trend code
(they migrate with the rollup reskin).

---

## Approved dependencies

**Shared:** `zod` (schemas live here, imported by both apps)
**Frontend:** `react react-dom react-router-dom @supabase/supabase-js tailwindcss @tailwindcss/forms date-fns lucide-react jspdf vite @vitejs/plugin-react vite-plugin-pwa typescript` (recharts removed 2026-07-08, audit PR 2b — zero imports since the Cadence sparklines are hand-rolled SVG; re-approve deliberately if charting needs ever exceed them)
**Backend:** `express cors helmet express-rate-limit @supabase/supabase-js node-cron axios typescript tsx dotenv`
**Testing:** `vitest @testing-library/react jsdom supertest` (jsdom approved 2026-07-07 — the DOM env @testing-library/react requires; devDependency only)

To add anything not listed: stop · explain why · get explicit approval before installing.

---

## Phase tracker — update at the end of every session

| Phase | Description | Status |
|---|---|---|
| 1 | Scaffold, shared package, Supabase, Microsoft SSO, RBAC | ✅ |
| 2 | Zendesk + Assembled connectors, sync job, admin config UI | ✅ |
| 3 | Scorecard UI, KPI tiles, sparklines, coaching prompts, 1:1 notes | ✅ |
| 4 | Senior manager rollup, employee sharing, PDF export, email nudge | ✅ |
| 5 | Polish, onboarding tour, PWA, audit log, load test, prod deploy | ✅ |

---

## Non-negotiable rules for every session

1. Read this file first — every session, no exceptions
2. Update the phase tracker before ending the session
3. Prefer a direct Supabase + RLS read over a new Express route (see Architecture principle)
4. Never rename existing files or folders without flagging it as a breaking change
5. Never change the connector interface without updating all three connectors simultaneously
6. Never use `any` in TypeScript — use `unknown` + narrowing or define the type properly
7. Never store a secret in code — use the env var names above; never `VITE_`-prefix a backend secret
8. Never add a dependency not on the approved list without stopping to ask
9. One concern per file — if a file does two things, split it
10. Domain types live in `packages/shared` — app `types/` folders are for local types only
11. After any DB migration, update docs/architecture.md
12. Check coaching language on every user-facing string before finalizing it
13. If a request conflicts with this file, say so and propose a compliant approach

---

## Decisions log — append only, never delete

| Decision | Reason |
|---|---|
| No individual composite score; aggregate trend direction allowed | Coaching-first for individuals; rollup needs focus signal without ranking people |
| `display_order` not `weight` on metric_definitions | `weight` implies composite scores, violating the no-composite-score rule |
| PDF export must watermark + log to audit_log | Forwardable performance doc outside access controls is a liability for a non-punitive tool |
| Assembled /activities ignores agents[]/limit/offset — fetch once, cache, filter client-side | Endpoint returns all org activities regardless of params; must filter by agent_id after fetch |
| Assembled /v0/people `agent_id` field (not `id`) used for state/activity queries | Person `id` ≠ `agent_id` — using the wrong one returns empty results silently |
| JWT claims sync trigger for admin RLS | Profiles.role syncs to raw_app_meta_data; avoids profile-query recursion in RLS policies |
| Supabase client requires `global.fetch` override in production | supabase-js fetch wrapper constructs invalid HTTP headers in some browsers |
| Implicit OAuth flow with hash detection in AuthCallback | PKCE not supported by Supabase project config; client auto-parses hash via `detectSessionInUrl` |
| Connectors return null (not 0) for no-data scenarios | Null means "no data", zero means "measured zero"; returning 0 caused compound UI bugs |
| Snapshot upsert uses `ignoreDuplicates: false` | `true` prevented corrections on re-sync; upsert key already prevents true duplicates |
| TrendChip uses pre-computed improving/declining directly | Direction was double-applied, inverting colors for lower_is_better metrics |
| Dashboard preview query filtered to current week Monday | Prevents mismatch with scorecard page; both use `period_start = thisMondayStr` |
| Prev/next uses replace:true instead of push | Back button should return to dashboard, not replay each employee |
| PDF audit POST decoupled from export status | Audit failure was falsely showing "Failed" even though PDF downloaded successfully |
| Share tokens valid for 72 hours, not single-use | `used_at` records first access; token stays valid until `expires_at` |
| AppLayout title prop accepts ReactNode not just string | Enables clickable breadcrumb on ScorecardPage |
| Coaching prompts always visible, not hover-only | Touch devices can't hover; coaching prompts are the product's core value |
| Auto-scaling time format for seconds-unit metrics | formatMetricValue: <60min → "X.X min", ≥60min → "X.Xh" |
| Zendesk `searchTickets` uses `updated>=` date filter | Includes tickets updated but not created in period; known caveat, stale reply times can contaminate averages |
| Bootstrap matches via Assembled first, then direct Zendesk email matching | Assembled has only 76 people; direct Zendesk pass covers 246/351 employees; 105 are non-support with no Zendesk account |
| Zendesk Users API uses cursor pagination (`meta.has_more` + `links.next`), not `next_page` | `page[size]=100` triggers cursor mode; `next_page` is null; must check `meta.has_more` and follow `links.next` |
| Bootstrap runs daily at 05:00 UTC via cron, before first metric sync at 06:00 | Ensures new hires and role changes are matched before metrics flow; deactivated agents get zendesk_agent_id cleared |
| Connector interface evolved to fetch-shape (prepareRun + fetchWeekData); metric math lives in apps/api/src/metrics/ registry | Adding a metric used to touch 6+ files incl. UI components; now spec + module + registry line + migration, zero sync-logic change (Phase 1B, parity-verified) |
| ConnectorMetricResult retired; sync builds DB rows from compute() outputs | Its unit/rawSource fields were computed then discarded (F13); unit/labels come from metric_definitions + METRIC_SPECS at render |
| is_active gates sync, not just display; a source with zero active metrics is skipped entirely | Admin toggle starts/stops collection with no deploy; avoids pointless API calls (all 3 Assembled metrics are currently inactive → no Assembled calls) |
| MetricSpec owns code-side identity + nullLabel/shortLabel; DB owns name/coaching_prompt/display_order/is_active | No overlap, no drift; kills the per-component hardcoded label maps (D10/S11) |
| Zendesk week semantics split (1C commit 7): ticket_volume = updated-in-period; first_reply_time + resolution_rate = created-in-period; csat_score = ratings SUBMITTED in period via `satisfaction_ratings?score=received` (org-fetch once per run, grouped by assignee, end_time clamped to now−90s) | Reworked old tickets contaminated weekly quality metrics (~167h reply averages, L1); the ratings endpoint gives the truer csat semantic for one extra call chain per run — full table in docs/metrics.md |
| Off-hours replies (business:0 AND calendar>0) excluded from reply-time averages; instant replies (0/0) stay as measured zeros (1C commit 7b) | Zendesk records business:0 for replies outside business hours — they entered averages as fake instant replies and auto-passed SLA (L11) |
| Empty productive-state intersection ⇒ null for occupancy and schedule_adherence; zero OVERLAP with matching states stays a measured 0 for adherence (1C commit 10) | Enforces the null-vs-zero decision: an unmapped state taxonomy is "no measurement", not 0% — prod wrote 249 misleading zero rows this way (corrected by 10b) |
| Cadence v2 (`docs/design/hungerrush-cadence/`) adopted as sole Phase 3 design source; demo resequenced AFTER its implementation; coral #C4553A sanctioned as the attention accent (true red stays system-errors-only); coaching engine ships flags-only (context fields fast-follow); trend semantics = current vs prior-period average, ±6%, band metrics, sparse ⇒ "new" | User decisions 2026-07-06 at design review — ADOPTION.md is the binding record; supersedes the 2026-07-02 design bundle and its ±2% trend decision |
| `executive` role (W2): enum value + `visible_manager_ids()` branch (all active manager-role profiles org-wide, `executive` included) + JWT-claims profiles SELECT policy; admin policies untouched; assigned ONLY by audited service-key write; graph sync never produces or overwrites it | Adam Seow needs org-wide data visibility without admin pages; James stays the only admin; a profiles policy must never call a function that reads profiles (0004–0006 recursion), so the policy is JWT-based like 0014's |
| Migration 0017 only ADDs the enum value; the role assignment is a separate later write; all 'executive' comparisons in SQL are text (`role::text`, plpgsql text vars, JWT strings) | A new Postgres enum value cannot be used as an enum datum in the transaction that adds it, and James applies migrations as one SQL-editor paste |
| `employees.title` (nullable) mapped from Azure AD `jobTitle` by the org graph sync (0018; `POST /api/sync/org` manual trigger — the daily 05:00 cron only matches agent IDs, it never writes roles or titles) | Master-list "Role" row; renders under the name in the scorecard header and feeds the Cadence header directly; null = not known, per the null-vs-zero rule |
| One hook result contract (Phase 2, S5): every web data hook returns `{ …data, loading, error, refetch }`; failed same-key refetch keeps last good data, key change resets it, errors never swallowed (documented in agents/FRONTEND.md) | Cadence's per-source "unreachable — showing last sync" display consumes exactly this state; three hooks previously swallowed errors or stranded a previous employee's data behind an error |
| One auth pattern (Phase 2, S6): AuthProvider context = the single supabase auth subscription; `AuthGuard roles={[…]}` in App.tsx is the ONLY session/role gate (`/rollup` = senior_manager\|executive\|admin, `/admin/*` = admin) | Auth was checked 3 different ways with 2+ subscriptions per view; role logic inlined per page is where access-control drift starts |
| `POST /api/sync/run` returns 202 and runs in-container; completion is verified DB-side (one `synced_at` stamp per run) or in Railway logs | Railway's edge proxy kills HTTP responses at exactly 300s while the sync keeps running — the response was never a real completion signal (user-approved 2026-07-06) |
| Manual sync triggers authenticate with dedicated `SYNC_TRIGGER_KEY`, compared fail-closed (unset var ⇒ 403 for everything) | The RLS-bypass service key must never double as an HTTP shared secret; the old comparison also had a latent hole (unset key + missing header passed `undefined !== undefined`) (user-approved 2026-07-06) |
| CORS allowlist = `[ALLOWED_ORIGIN, http://localhost:5173]`, trailing slashes normalized; requests with no Origin header pass untouched | Locks browser cross-origin API use to the deployed frontend while curl/sync-triggers/health checks (no Origin header) keep working; localhost stays for dev against prod api |
| `/scorecard/:employeeId?` is the home surface (roster strip + briefing + evidence); DashboardPage/useDirectReports deleted; `/dashboard` = search-preserving redirect (Phase 3, 2026-07-07) | Cadence merges person-picking and the briefing into one deep-linkable surface; the redirect keeps old bookmarks and the rollup `?manager=` drill-down working; drill-down always shows the manager's FULL team |
| Evidence degradation = per-person `synced_at` age (9h bound, clears the 22:00→06:00 cron gap); copy says "No fresh ‹Source› data for this person — showing last sync (…)", never "unreachable" | A stale stamp cannot distinguish a source outage from one person no longer syncing (deactivated agent); the prototype's "unreachable" wording over-claims — deliberate copy repair in ADOPTION's own spirit |
| Count-unit trends anchor to the last completed week (`trendWindow`, shared); rates/averages keep the live current value; frozen views untouched — RESOLVED by James 2026-07-07 ("do what you recommend") after being flagged in PR #7 | A partial week's count is a biased sum (every Monday would read as a collapse and train managers to ignore coral), while rates are unbiased mid-week and must keep live signal (a Thursday CSAT drop belongs in the briefing); W4's backlog/tickets_assigned inherit the rule via `unit: 'count'` |
| jsdom added as an apps/web devDependency (James-approved 2026-07-07); component tests opt into the DOM per-file via `// @vitest-environment jsdom`, lib tests stay on node | @testing-library/react was on the approved list but is inert without a DOM environment; per-file pragma keeps pure-logic tests fast and the DOM dependency test-only (never in the bundle) |
| Org-sync classification never mints `admin` — manager-less accounts become `employee` (still flagged for review); `admin` joins `executive` as audited-write-only, preserved by the sync FAIL-CLOSED (a failed preserve-lookup writes no roles that run); 0019 stamps the JWT role claim only while `is_active = true` (strips on deactivate; trigger fires on role AND is_active); the 279 classification-minted admins reclassified by one audited sweep (audit PR 1, 2026-07-07) | REVIEW.md 0.2: 280 admin-role profiles existed and is_active was enforced nowhere in the claims/admin-RLS/web path — any manager-less human signing in held live admin, and a new manager-less human would have synced as an ACTIVE admin; "James stays the only admin" becomes enforcement, not luck |
| `employees.is_active` (0020): org-sync pass 5 reconciles rows against the full enabled-member email set — absent → inactive, returned → active, NEVER deleted; a circuit breaker skips deactivation when more than max(5, 20% of active rows) would flip in one run; UI badges inactive people "no longer synced" (roster chip, briefing header, rollup card count) and rollup tone counts exclude their frozen histories (audit PR 3, 2026-07-08) | REVIEW.md 3.1: ghost rows from duplicated/disabled AD accounts silently showed frozen metrics as if current; badging beats hiding (managers understand why a history froze) and exclusion-from-aggregates beats counting (a frozen person reads "new"/"steady" forever); the breaker exists because a thin Graph read must never mass-deactivate the org |

| Metric | Source | Formula |
|---|---|---|
| schedule_adherence | activities + agent_states | Overlap of productive states with scheduled activities / total scheduled productive time |
| occupancy | agent_states | Time in productive states / total logged-in time (excluding Offline) |
| handle_time | agent_states | Avg duration of individual customer-facing state entries |
