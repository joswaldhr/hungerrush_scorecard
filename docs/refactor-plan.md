# Refactor Plan — Phases 0–2

> Source of truth for the production-grade refactor. Written by Phase 0 (session 22, 2026-07-02).
> Every subsequent session: read CLAUDE.md + agents/FRONTEND.md + this file, execute ONE phase or
> sub-phase, update the status table below, then do the standard CLAUDE.md handoff.
>
> Inviolable constraints live in the originating prompt and CLAUDE.md; the short version:
> production keeps working at every commit · data-integrity fixes stay · RLS is the access model ·
> no composite scores, no red, coaching language · stack locked · connector interface may evolve
> only if all three connectors move together · historical snapshots never destructively migrated ·
> SharedScorecardPage stays public.

## Status

| Phase | Session | Status |
|---|---|---|
| 0 — Audit & plan | 22 | ✅ Complete — approved by user 2026-07-02, pushed `19c55e1` |
| 1A — Safety nets: tests, backup/dump scripts, truncation fix | 22 | 🔄 In progress |
| 1B — Metric registry refactor + parity + deploy watch | — | Not started |
| 1C — Logic fixes (one commit each) + approved data correction | — | Not started |
| 2 — Fluff removal & hardening | — | Not started |
| 3 — Design implementation | — | Separate prompt, blocked on 2 |

**⚠️ Standing reminder (do not lose):** after 1C commit 10 + correction 10b land, remind the user
to re-enable `occupancy` and `schedule_adherence` in the admin UI. The user toggled them (plus
`sla_compliance` and `handle_time`) `is_active = false` on 2026-07-02 so scorecards stop showing
false 0.0% during the refactor.

**Verification note:** Playwright MCP is not connected (session 21's install attempt unresolved).
Claude-in-Chrome tools exist but depend on the user's live browser session. Until that changes,
the user is the eyes for production UI verification; DB-level verification runs through read-only
scripts against Supabase (pattern established in Phase 0).

---

## a) Fluff inventory

### Dead files / exports (verified: zero importers via grep)

| # | Item | Location | Action |
|---|---|---|---|
| F1 | `useInstallPrompt` — entire hook, never imported | `apps/web/src/hooks/useInstallPrompt.ts` | Delete file (PWA install still works via browser-native prompt) |
| F2 | `openTour` export, never used (pilot-guide.md promises a "?" re-open button that doesn't exist) | `apps/web/src/features/onboarding/TourModal.tsx:129` | Delete export; fix pilot-guide.md (or add the button in Phase 3) |
| F3 | `clearAssembledCache` export, never called | `apps/api/src/connectors/assembled.ts:46` | Delete (cache self-expires after 10 min) |
| F4 | `MetricHistoryPointSchema` / `MetricHistoryPoint`, never imported | `packages/shared/src/schemas.ts:123-128` | Delete |
| F5 | `get_metric_history()` DB function — no `.rpc()` caller anywhere; frontend queries snapshots directly | `supabase/migrations/0001_core_tables.sql:138` | Leave in DB (never destructive-migrate); document as unused in architecture.md |
| F6 | `testConnection()` on all 3 connectors — nothing calls it (no admin health-check UI or route) | `zendesk.ts:186`, `assembled.ts:250`, `forethought.ts:16` | Keep in evolved interface (cheap; future admin health check) — judgment call, revisit in 1B |
| F7 | Unused `randomUUID` import | `supabase/seed.ts:4` | Delete import |
| F8 | Dead JSX: `allCurrentNull && <p>` can never render (allCurrentNull ⇒ the empty-state branch was taken); same predicate computed 3× | `apps/web/src/features/scorecard/ScorecardPage.tsx:168-170,301-303` | Simplify to one predicate; delete dead branch |
| F9 | `forethoughtConnector` defined but never imported by syncService — the stub exists but isn't wired | `apps/api/src/connectors/forethought.ts` | Keep stub (CLAUDE.md contract); 1B registry wires availability generically |
| F10 | `profiles.zendesk_agent_id` / `profiles.assembled_agent_id` columns + ProfileSchema fields — never read or written by any app code (bootstrap writes only `employees.*`) | `0001_core_tables.sql:25-26`, `packages/shared/src/schemas.ts:22-23` | Columns stay (never drop); remove from ProfileSchema only if typecheck stays green — else document |
| F11 | `supertest` + `@types/supertest` devDeps — zero test files exist in the repo | `apps/api/package.json:28-29` | Remove (Phase 1 tests are pure-function vitest; no HTTP tests planned) |
| F12 | `@testing-library/react` devDep — zero component tests, and current components are being retired in Phase 3 | `apps/web/package.json:28` | Remove now; re-add with Phase 3 when new components get tests |
| F13 | ConnectorMetricResult `unit` and `rawSource` fields — built by both live connectors, then **discarded** by syncService (never persisted; unit comes from metric_definitions at render) | `packages/shared/src/types.ts:8,11`; `syncService.ts:303-312,326-335` | Slim the result shape in the 1B interface evolution (all three connectors together) |
| F14 | Missing `/favicon.svg` referenced by index.html (silent 404) | `apps/web/index.html:5` | Fix reference or add file in Phase 2 |

### Duplicated logic (unify in Phase 1B/2)

| # | Pattern | Sites | Target |
|---|---|---|---|
| D1 | **Week-boundary math, two different semantics** — backend UTC Monday vs frontend *local* Monday (see defect L2) | `syncService.ts:20-29` (UTC); `useEmployeeMetrics.ts:24`, `useDirectReports.ts:22`, `useManagerRollup.ts:29`, `SharedScorecardPage.tsx:85` (all local) | One `currentWeekStartUtc()` / `weekStartStr()` util in `packages/shared`, used by web + api |
| D2 | `getSupabaseAdmin()` copy-pasted 4× | `syncService.ts:11`, `routes/share.ts:7`, `routes/audit.ts:7`, `services/graphSync.ts:46` | One `apps/api/src/lib/supabaseAdmin.ts` |
| D3 | Zendesk axios client factory duplicated | `connectors/zendesk.ts:12` and `syncService.ts:47` (`createZendeskClient`) | One factory in the zendesk connector, exported |
| D4 | Initials computed 2 ways — `getInitials()` (first+last) vs `charAt(0)` | `AppLayout.tsx:27` vs `DashboardPage.tsx:204`, `ScorecardPage.tsx:252`, `SharedScorecardPage.tsx:121` | One util in `apps/web/src/lib/` |
| D5 | Snapshot→per-metric view-model mapping duplicated | `useEmployeeMetrics.ts:59-75` ≈ `SharedScorecardPage.tsx:90-106` | One mapping util consumed by both |
| D6 | Trend computed 2 ways with different semantics — KpiTile badge (latest vs prior-average of history) vs rollup chip (thisWeek vs lastWeek) | `KpiTile.tsx:14-31` vs `useManagerRollup.ts:141-155` | Centralize as pure, tested functions in Phase 1B (two intentional variants, one module) |
| D7 | Amber error-banner JSX repeated ~6× | `DashboardPage.tsx:143`, `ScorecardPage.tsx:281,349`, `RollupPage.tsx:88`, `MetricConfigPage.tsx:70,76` | `<ErrorBanner>` component (structural; survives reskin) |
| D8 | Empty-state card JSX repeated ~6× | Dashboard/Scorecard/Rollup/MetricConfig/ExportLog | `<EmptyState message action>` component |
| D9 | `MetricUpdates` type defined 3× | `useMetricDefinitions.ts:5`, `MetricConfigPage.tsx:9`, `MetricCard.tsx:4` | Define once in the hook, import elsewhere |
| D10 | Metric-key→label maps hardcoded in components — `NULL_LABELS`, `SHORT_NAMES` | `KpiTile.tsx:47-53`, `RollupPage.tsx:7-16` | Move to MetricSpec / metric_definitions (this is a modularity leak: adding a metric today means editing these components) |
| D11 | Style inconsistencies: `process.env.X` vs `process.env['X']`; import specifiers `'../types/zendesk.js'` vs `'../types/assembled'` | api workspace | Unify during 1B (mechanical) |

### Config / tooling fluff

- **`test` scripts run `vitest` in watch mode** (`apps/*/package.json`) — "run the full test suite before every push" needs `vitest run`. Fix in 1A when tests first appear.
- **`ALLOWED_ORIGIN` env var is set in Railway and documented in `apps/api/.env.example:13` but ignored by code** — `index.ts:17` calls bare `cors()`. This is exactly the Phase 2 CORS lockdown, already staged.
- `apps/api/src/middleware/` contains only `.gitkeep` — CLAUDE.md's structure lists it, but auth checks live inline in routes. Keep the folder; the sync-route auth check (`routes/sync.ts:8-14`) moves there if touched. Related judgment call: `x-sync-key` compares against `SUPABASE_SERVICE_KEY` — reusing the RLS-bypass key as an HTTP shared secret widens its blast radius. Propose a dedicated `SYNC_TRIGGER_KEY` in Phase 2 (needs a Railway env add — user action).
- `docs/pilot-guide.md` drift: promises a "?" tour button (doesn't exist), a "New Session" button (inline form), a filter "dropdown" (pills). Refresh after Phase 3, not before.

---

## b) Metric architecture assessment

### Distance from target

Today, adding one Zendesk metric touches **at minimum 6 files**: `zendesk.ts` (compute + result row),
the `metric_definitions` migration, `KpiTile.tsx` (NULL_LABELS), `RollupPage.tsx` (SHORT_NAMES), and
possibly `formatMetric.ts` (new unit) and `useDirectReports.ts` (if previewed). Metric math lives
inside connectors (`zendesk.ts:89-140` `computeAllMetrics`; `assembled.ts:151-183` three compute
functions). The sync (`syncService.ts:263-371`) never reads `metric_definitions` — it writes whatever
connectors emit, so `is_active` currently gates **display only**, not sync. Zero test coverage exists.

What's already right: snapshots FK to `metric_definitions.key` (unknown keys can't be written),
frontend renders tiles purely from active definitions, `display_order`/`coaching_prompt` are
DB-driven, upsert idempotency works, and the assembled connector's interval math
(`mergeIntervals`/`totalDuration`/`overlapDuration`, `assembled.ts:110-143`) is already pure and
trivially testable.

### Target design (adapted to this codebase)

```
packages/shared/src/metricSpec.ts
  interface MetricSpec {
    key: string; source: MetricSource; unit: 'count'|'percent'|'seconds';
    direction: MetricDirection;
    nullLabel: string;        // KpiTile "no data" copy (kills D10)
    shortLabel: string;       // rollup chip label (kills D10)
  }
  // NOTE: name / coaching_prompt / display_order / is_active stay DB-owned
  // (admin-editable at runtime). MetricSpec owns code-side identity + labels
  // the DB doesn't have. No overlap, no drift.

apps/api/src/metrics/<metricKey>.ts       // one file per metric
  export const spec: MetricSpec;
  export function compute(data: ZendeskWeekData /* or AssembledWeekData */): number | null;

apps/api/src/metrics/registry.ts          // BORING: import array + Map lookups
  export const ALL_METRICS: MetricModule[];
  export function metricsForSource(source: MetricSource): MetricModule[];

apps/api/src/connectors/*.ts              // become thin fetchers
  zendesk:    fetchWeekData(agentId, start, end)  → { tickets, metricSets, slaTargetMinutes }
  assembled:  fetchWeekData(email, start, end)    → { states, activities, productiveTypeIds, productiveStateNames }
  forethought: isAvailable=false, fetchWeekData → null
  // SLA target and org-wide activities fetched ONCE per sync run and passed in (fixes L3)

apps/api/src/services/syncService.ts
  1. read metric_definitions WHERE is_active = true          ← is_active now gates sync too
  2. group active keys by source; skip a source with no active metrics
  3. per employee: fetch each needed source's week-data ONCE
  4. for each active metric of that source: value = compute(data); null → skip write
  5. upsert (unchanged conflict key, ignoreDuplicates: false)
```

Frontend consumption of `nullLabel`/`shortLabel`: export the spec map from `packages/shared` (specs
are isomorphic data), imported by KpiTile/RollupPage with the existing hardcoded maps as fallback
until Phase 3 rewires components.

`DataSourceConnector` interface evolves (fetch-shape instead of compute-shape) — all three connectors
change in the same commit, per constraint. `ConnectorMetricResult` slims down or retires (F13).

**Add-a-metric recipe** (to be written into docs/metrics.md in 1B with a worked example):
1 new file in `apps/api/src/metrics/` + 1 line in the registry + 1 migration inserting the
`metric_definitions` row. If the metric needs data the fetcher doesn't return yet, extend the
source's `WeekData` type — still no sync-logic change. Toggling `is_active` in the admin UI
starts/stops sync and display with no deploy.

### Migration path (production green at every commit)

The refactor is bug-for-bug compatible: compute functions move verbatim, characterization tests pin
current behavior (including the defects below), and the parity diff proves the pipeline end-to-end
before push. Logic fixes land only after parity, one commit each. Detailed sequence in section (d).

---

## c) Structural UI/UX gap list (survives any reskin — cosmetics intentionally excluded)

| # | Gap | Location | Phase |
|---|---|---|---|
| S1 | **No navigation below 1024px** — sidebar is `hidden lg:flex`, no hamburger, no alternative | `AppLayout.tsx:70` | 3 (design project owns nav chrome) — but the *requirement* is recorded here so it can't be dropped |
| S2 | OfflineBanner mounted only on DashboardPage — offline state invisible on scorecard/rollup/admin pages | `DashboardPage.tsx:96` | 2 (move into AppLayout) |
| S3 | TourModal has no skip/close: no X, no backdrop click, no Esc; `closeTour` doesn't persist, so navigating away resurrects the tour every dashboard visit until Done is clicked. Also no focus trap / `aria-modal` | `TourModal.tsx` | 2 (behavioral: any close persists dismissal; Esc/backdrop close) |
| S4 | MetricConfig save has no success feedback (button silently re-disables); errors render at page top, far from the card that failed | `MetricCard.tsx:117-136`, `MetricConfigPage.tsx:54-62` | 2 |
| S5 | Hooks swallow errors: useDirectReports ignores `snapshotRes.error` / `previewRes.error` (sections silently empty); useEmployee keeps stale data on error; no hook exposes refetch; patterns inconsistent across all 8 hooks | `useDirectReports.ts:46-51`, `useEmployee.ts:19-24` | 2 (one consistent hook result contract) |
| S6 | Auth checked 3 different ways — AuthGuard wraps routes, but ScorecardPage/RollupPage/ExportLogPage/MetricConfigPage each re-implement session/role checks inline; useAuth is called per-component (2+ subscriptions per view) | `App.tsx`, each page | 2 (AuthProvider context + role-aware guard; single pattern) |
| S7 | RollupPage manager cards are clickable `<div>`s — no keyboard access, no role, no focus ring | `RollupPage.tsx:107-111` | 2 (make it a button; dashboard rows already are) |
| S8 | ExportLogPage caps at 100 rows with no indication or pagination; enrichment fetches ALL profiles + employees client-side | `ExportLogPage.tsx:42-55` | 2 (add "latest 100" note + bounded lookups; full pagination only if pilot needs it) |
| S9 | LoginPage `signingIn` never resets if the OAuth redirect fails to fire — button stuck on "Signing in..." | `LoginPage.tsx:7-16` | 2 (reset on error) |
| S10 | No 404 route — `*` silently redirects to /dashboard, so typo'd deep links vanish without feedback | `App.tsx:58` | 3 (design owns the page; requirement recorded) |
| S11 | Metric null-labels and rollup short-labels hardcoded per metric-key in components — new metric = edit 2 components | `KpiTile.tsx:47`, `RollupPage.tsx:7` | 1B (moves into MetricSpec — also D10) |
| S12 | Document title static across routes; nav lacks `aria-current`; route changes don't move focus | app-wide | 3 (note for design implementation) |

Explicitly skipped as cosmetic/dead (design retiring): all color/token/spacing findings, the extra
non-CLAUDE.md tailwind tokens, Google-Fonts import strategy, dark-mode classes, skeleton shapes.

---

## d) Execution sequence

Rules: typecheck all workspaces after every commit · full test suite before every push · one
coherent unit per commit · never start a new phase above ~60% context — hand off instead.

### Phase 1A — Safety nets (1 session)

| Commit | Content | Verify |
|---|---|---|
| 1 | Test infra: `vitest run` scripts; export existing compute functions from connectors (no behavior change); **characterization tests** pinning CURRENT behavior — per metric: fixture→expected, empty→null (or 0 for ticket_volume), single item, zero-vs-null, lower_is_better, and the known-buggy behaviors as explicitly-labeled `// PRESERVE-FOR-PARITY` cases (e.g. occupancy returns 0 when no state names match) | `npm run test` green; typecheck green |
| 2 | `scripts/backup-snapshots.ts` (full table → timestamped CSV) + `scripts/dump-week-metrics.ts` (current week `employee_id\|metric_key\|value`, sorted). **HARD REQUIREMENT (user, 2026-07-02): both scripts explicitly paginate past PostgREST's 1,000-row default and print row counts in every output** — otherwise the parity baseline is truncated by the very bug in L7 and the diff could pass on incomplete data. Fetched count is verified against a server-side `count: 'exact'` head query. Run backup immediately; commit scripts (not the CSV) | Printed row count = server-side exact count |
| 3 | **FIX-EARLY L7** (read-path truncation — justification in section f): bound `useDirectReports` snapshot queries to current+last week and page/window the rollup query | User screenshots dashboard "With metrics" count = 247 and rollup chips populated; counts cross-checked against a read-only script |

Session boundary. Commit 3 is frontend-only and outside the sync parity surface — safe before the refactor.

### Phase 1B — Registry refactor (1 session, the riskiest one)

| Commit | Content | Verify |
|---|---|---|
| 4 | MetricSpec in shared · `apps/api/src/metrics/` one file per metric (compute functions moved verbatim) · registry · connectors → fetchers (SLA + org activities fetched once per run, passed into fetch context — L3 lands here structurally; **document that reply-time/SLA values may shift only if source data changed between dumps**) · syncService driven by registry ∩ `is_active` · characterization tests re-pointed at the new modules, still green | **Parity protocol** below, BEFORE push |
| 5 | docs/metrics.md add-a-metric recipe with worked example · CLAUDE.md decisions-log entries · this file's status update | — |

**Parity protocol (commit 4):**
1. Note the Railway cron fires at 06:00/10:00/14:00/18:00/22:00 UTC — run the whole protocol inside one window, timestamps recorded before and after each step so any interleaved cron write is identifiable.
2. `backup-snapshots.ts` → restore point (parity overwrites live current-week rows).
3. Run OLD sync (checkout pre-refactor commit or run against prod API `/api/sync/run`), dump baseline.
4. Run NEW sync back-to-back, dump again, diff.
5. Required: identical, or every line explained by fresher source data (live APIs move between runs — expect small drift in reply-time averages for agents with new activity; zero drift for agents with no new tickets).
6. **Explained-by-toggle (user action 2026-07-02):** `sla_compliance`, `handle_time`, `occupancy`,
   `schedule_adherence` were toggled `is_active = false` in the admin UI. The OLD sync ignores
   `is_active` and keeps re-writing occupancy/adherence 0-rows every 4h until 1B deploys; the NEW
   sync skips inactive metrics. Because upsert never deletes, the dump-level diff shows **no line
   changes** for those keys — the toggle manifests as (a) lower written-row counts in NEW sync
   logs (~124 fewer rows/run) and (b) stale `synced_at` on those rows. Do not mistake either for
   a parity failure.
7. **Show the user the diff before pushing.**
8. After push: **post-deploy watch** — wait for the next scheduled Railway sync; verify logs show ~247 employees processed, 0 unexplained errors, snapshot counts consistent. Phase 1C does not start until this passes.

Session boundary.

### Phase 1C — Logic fixes (1 session; one commit each; never folded into refactor commits)

Order chosen so each diff stays explainable. Per fix: (1) update that metric's tests to the NEW
correct behavior, (2) fix, (3) re-run sync, (4) report exactly which values changed and why.

| Commit | Fix | Expected diff |
|---|---|---|
| 6 | L2 UTC week boundary — shared week util replaces all 5 sites | No DB diff (read-path + sync agree on the same Monday; user near week edges sees correct week) |
| 7 | L1 stale-ticket contamination — **split APPROVED by user 2026-07-02**: first_reply_time and resolution_rate computed only from tickets **created** in period (`ticket.created_at` already fetched); ticket_volume stays updated-in-period (activity semantics). **CSAT**: first check whether Zendesk supports counting ratings *submitted* this week (`satisfaction_ratings` endpoint with a time filter) — the truer semantic; if it materially complicates the fetcher, fall back to created-this-week and document the tradeoff in docs/metrics.md either way | first_reply_time drops sharply for agents with reworked old tickets (Phase 0 saw max 601,127s ≈ 167h) |
| 8 | L4 Last-week trend badge — Last Week tiles receive history truncated to ≤ last week | UI-only |
| 9 | L5 Sparkline calendar slots — map history to 4 calendar-week positions | UI-only |
| 10 | L6 Assembled zero-writes — empty productive-state intersection returns null for all three assembled metrics (not 0%) | New syncs stop writing 0s |
| 10b | **Data correction — APPROVED by user 2026-07-02**, sequenced immediately AFTER commit 10 (deleting earlier would let the still-broken connector re-write 0s at the next 4-hour cron; note the OLD sync also ignores `is_active`, so the toggle alone doesn't stop the writes — commit 10 must be deployed first). Mechanics: timestamped CSV backup → delete the `occupancy`/`schedule_adherence` rows with `value = 0` → log the correction to `audit_log`. Null = no row in this schema, matching `handle_time` | ~249+ zero rows removed (count grows until commit 10 deploys — re-count at execution) |
| 11 | L8 PDF zero treatment — 0 renders as a value, only null renders "No data" | PDF-only |

Session boundary. (If context allows, 1C can absorb into 1B's session; plan for separate.)

### Phase 2 — Remove fluff & harden (1 session)

| Commit | Content | Verify |
|---|---|---|
| 12 | Dead code sweep: F1–F4, F7, F8, F14 + unused deps F11, F12 (verify against import graph before each removal) | typecheck + tests + build green |
| 13 | Duplication unification: D2–D5, D9 (D1 landed in commit 6; D6/D10 in 1B) | tests green |
| 14 | Hook/page consistency: S2, S5, S6 (one hook contract, AuthProvider, OfflineBanner in AppLayout) | user smoke-tests prod after deploy |
| 15 | Structural feedback: S3 (tour skip/persist), S4 (save confirmation), S7, S8, S9 | user verifies each interaction |
| 16 | **CORS lockdown — ALONE**: wire `ALLOWED_ORIGIN` into `cors({ origin })` (`index.ts:17`); deploy; immediately verify prod frontend loads data + shared-link page works before anything else lands | live prod check within minutes of Railway deploy |
| 17 | Housekeeping: pgbouncer finding (below) documented; CLAUDE.md handoff; declare ready for Phase 3 | — |

**pgbouncer finding:** CLAUDE.md lists "connection pooling (`?pgbouncer=true`)" as remaining
hardening. Not applicable: nothing in this codebase opens a direct Postgres connection —
`@supabase/supabase-js` speaks HTTP to PostgREST on both web and api. The connection-string flag
belongs to direct-pg clients (Prisma/pg). Action: remove the item from CLAUDE.md with this
explanation. If a direct-pg dependency ever appears, revisit.

---

## e) Pre-flight state check (production, 2026-07-02 ~14:05 UTC; last sync 14:00:01 UTC)

**The full sync for newly matched employees is confirmed complete for the current week.**
247 of 351 employees have `zendesk_agent_id` (matches CLAUDE.md's 246 ±1 from a later bootstrap);
all 247 produced a `ticket_volume` row for week 2026-06-29. 65 have `assembled_agent_id`.

| metric_key | total rows | wk 2026-06-22 | wk 2026-06-29 (current) |
|---|---|---|---|
| ticket_volume | 310 | 63 | 247 |
| first_reply_time | 220 | 63 | 157 |
| csat_score | 105 | 53 | 52 |
| sla_compliance | 0 | 0 | 0 |
| resolution_rate | 220 | 63 | 157 |
| schedule_adherence | 123 | 62 | 61 |
| occupancy | 126 | 63 | 63 |
| handle_time | 0 | 0 | 0 |
| **TOTAL** | **1,104** | 367 | 737 |

*(Correction, same day: the per-week totals originally read 304/800 — arithmetic slip summing the
per-metric column, caught by the first `dump-week-metrics.ts` run: 367 and 737, verified against
server-side exact counts. Per-metric numbers were and are correct.)*

Reading the state:
- **Only two weeks of data exist** (range 2026-06-22..2026-06-29). Sparklines have ≤2 bars; rollup trends only compute for the original 63 employees (the 184 newly matched have no last-week row and will get their first complete pair after Sunday 2026-07-05's snapshot). Expected, self-healing.
- **This-week gaps are null-skips, not failures**: 90 of 247 agents have tickets but no reply-time metric rows yet; 91 have `ticket_volume = 0` (measured zero — matched but no ticket activity).
- **sla_compliance: zero rows ever** — no SLA policies configured in Zendesk (connector returns null). The tile shows "Not configured" on every scorecard. Candidate for `is_active = false` once 1B makes the toggle gate sync too.
- **handle_time: zero rows ever / occupancy & adherence: ALL values are exactly 0** — see L6. 249 misleading zero rows in prod.
- Value sanity (this week): ticket_volume max 330; first_reply_time max 601,127s (~167h — L1 evidence); csat avg 83.3; resolution avg 74.7.
- Baseline: typecheck green on all 3 workspaces; zero test files exist; working tree clean at `f1d0660`.

---

## f) Logic audit

Classification: **PRESERVE-FOR-PARITY / FIX-AFTER** = reproduce bug-for-bug through the 1B refactor,
fix as its own 1C commit. **FIX-EARLY** = read-path bug outside the sync parity surface, fixed in 1A.
**INVESTIGATE** = needs a product decision before classifying.

| # | Defect | Location | Class |
|---|---|---|---|
| L1 | **Stale-ticket contamination**: `searchTickets` filters `updated>=start` — old tickets reworked this week enter the average; first_reply_time this week hit 601,127s (~167h). Also affects csat/resolution/sla inputs | `zendesk.ts:35` | PRESERVE → FIX-AFTER (commit 7; product confirm on volume semantics) |
| L2 | **UTC vs local week boundary**: sync writes `period_start` from UTC Monday; all 4 frontend sites compute *local* Monday. For US timezones, Sunday evening local = Monday UTC → "no data this week" until local midnight; near-boundary weeks mismatch | `syncService.ts:20` vs `useEmployeeMetrics.ts:24`, `useDirectReports.ts:22`, `useManagerRollup.ts:29`, `SharedScorecardPage.tsx:85` | PRESERVE → FIX-AFTER (commit 6) |
| L3 | **SLA policy fetched per employee** — 247 identical `/slas/policies` calls per sync (currently all returning null — no policies configured) | `zendesk.ts:155` | FIX-AFTER structurally in 1B (fetch once per run, passed into fetcher context); no value change expected — documented in parity |
| L4 | **"Last Week" tiles show a current-week trend badge** — full `history` (incl. current partial week) is passed to Last-Week KpiTiles; `getTrend` compares latest history point (current week) vs prior average | `ScorecardPage.tsx:332-342` + `KpiTile.tsx:14-31` | PRESERVE → FIX-AFTER (commit 8) |
| L5 | **Sparkline bars are sequence-packed, not calendar-mapped** — a missing week collapses; bars don't align to calendar weeks | `KpiTile.tsx:55-61` | PRESERVE → FIX-AFTER (commit 9) |
| L6 | **NEW — Assembled writes 0% for unmapped states**: `productiveStateNames` is built from activity-type *names*, compared against agent-state *state* strings; intersection is empty in prod, so occupancy = 0 and adherence = 0 are written as "measured" values for 63 agents (249 rows, 100% zeros both weeks) while handle_time correctly nulls out. Violates the null-vs-zero decision; scorecards show misleading "0.0%" tiles today | `assembled.ts:151-183,218-225` | PRESERVE → FIX-AFTER (commit 10: empty intersection ⇒ null for all three). Existing rows: Open Question 1 |
| L7 | **NEW — 1000-row silent truncation, live today**: `useDirectReports` selects `employee_id` from the ENTIRE snapshots table (1,104 rows > PostgREST's 1,000 default → "has data" flags arbitrarily wrong); `useManagerRollup` selects 2 weeks × all employees (~1,037 rows and growing) → rollup chip counts wrong. Worsens every week | `useDirectReports.ts:31-37`, `useManagerRollup.ts:91-95` | **FIX-EARLY** (1A commit 3 — frontend read path, not sync parity surface) |
| L8 | **PDF treats 0 as "No data"** — `value !== 0` gate; 91 agents legitimately measured 0 tickets this week and would export as "No data" | `pdfExport.ts:69` | PRESERVE → FIX-AFTER (commit 11) |
| L9 | Dead guard: `resolutionRate = ticketVolume === 0 ? null : ...` unreachable inside the `tickets.length > 0` branch | `zendesk.ts:137` | Fold into 1B move (identical behavior); noted so the parity reviewer isn't surprised |
| L10 | Zendesk search API hard-caps at 1,000 results — busiest agent already at 815 tickets/week under the `updated>=` filter | `zendesk.ts:27-47` | WONTFIX for now — L1's created-filter reduces exposure; add a log-warning at >900 results in 1B |
| L11 | `first_reply_time` uses business-hours minutes; a reply outside business hours records 0 and drags averages down (min = 0 in prod this week) | `zendesk.ts:110` | INVESTIGATE during commit 7 (likely: exclude 0-business-time tickets from the average or fall back to calendar) |
| L12 | "This Week" trend arrows compare a *partial* week against completed weeks — every count-style metric trends "attention" early in the week by construction | `KpiTile.tsx:14-31` | INVESTIGATE / product decision — default WONTFIX (documented as working-as-designed; revisit with Phase 3 design) |
| L13 | graphSync counts creates-vs-updates via `status === 201` on upsert (unreliable in supabase-js) — logging accuracy only | `graphSync.ts:266` | WONTFIX (cosmetic logging) |
| L14 | `share.ts` comment claims "current week only" but fetches all snapshots — behavior is actually what the shared page needs (history for sparklines); the comment lies | `routes/share.ts:89` | Fix comment in Phase 2 |

## Open questions — ALL ANSWERED by user 2026-07-02

1. **Zero-value assembled rows: correction APPROVED** — executed as commit 10b (see 1C table),
   sequenced after the state-matching fix so the broken connector can't re-write 0s.
   **Constraint 7 clarified by the user:** it protects *real history*, not measured-wrong values.
   Any such correction requires (a) the user's explicit approval and (b) a timestamped backup —
   this one has both. Future sessions: never generalize this into casual snapshot deletion.
2. **Semantics split APPROVED** for `first_reply_time` and `resolution_rate` (created-this-week);
   `ticket_volume` stays updated-this-week. CSAT: investigate ratings-submitted-this-week first
   (see commit 7); created-this-week is the accepted fallback; document tradeoff in docs/metrics.md.
3. **Toggles done by user 2026-07-02** in the admin UI: `sla_compliance`, `handle_time`,
   `occupancy`, `schedule_adherence` all set `is_active = false`. The last two are temporary —
   see the standing reminder at the top: re-enable after 1C commit 10 + 10b. Their absence from
   sync writes appears in the 1B parity run as explained-by-toggle (protocol step 6).
