# CLAUDE.md

> Read this file in full before writing any code or making any architectural decision.
> If a user request conflicts with anything here, flag it — do not silently override.

---

## Current Session Status

**Last updated:** 2026-07-06 (session 25)

- All 5 phases, 4 UI/UX sprints, layout redesign, and data integrity audit complete — pilot-ready
- Production: `hungerrush-scorecard.vercel.app` (frontend) · `scorecardapi-production.up.railway.app` (backend)
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
- **Next up — `docs/release-plan.md` is the approved sequencing (2026-07-06), it wraps the refactor plan:** ~~W0 cron reliability~~ **RESOLVED — false alarm** (Railway logs prove every cron fired on time since `91084f9`; the DB per-window counting method was invalid — `synced_at` is last-writer-wins; verify crons via Railway logs or current-window-only counts; vestigial `@scorecard/web` Railway service removed) → ~~W1 = Phase 1C + `0016`~~ **DONE session 25 (2026-07-06) — deployed, corrections executed, S4 closed** → W2 release readiness (FRESH SESSION, **clear to start now**: `executive` role for Adam Seow — James stays the only admin; `employees.title`; philosophy amendment; smoke checklist) → **small release demo to Alex Smith / Barb Maenza / Mike Pacilio / Adam Seow** → W3/W4 metric expansion (Zendesk Talk calls, backlog, tickets_assigned) → W5 Assembled hours → W7 Phase 2/3. Master-list disposition table for Alex/Barb is in the release plan. Philosophy clarification (user, 2026-07-06): coaching-first = visual/tonal frame; negative-direction metrics are in-scope content; no red / coaching language / no composites / no rank unchanged. Verification cautions that remain true for every future sync validation: verify completion DB-side (Railway proxy kills HTTP at 300s), trust only `GET /health` → `sha` for deploys (GitHub statuses post success for watch-path-skipped commits), and verify crons via Railway logs (`[cron]`) — historical `synced_at` window-counting is invalid.
- **Remaining feature:** mobile navigation (hamburger menu for screens < 1024px) — recorded as gap S1 in refactor plan, owned by Phase 3 design
- **Remaining hardening:** CORS lockdown (refactor plan commit 16), email nudge (needs `RESEND_API_KEY`); connection pooling item retired — see pgbouncer finding in refactor plan
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
- Role hierarchy: `admin` > `senior_manager` > `manager` > `employee`
- Managers fetch only their own direct reports
- Senior managers see one level down (their managers' reports) — NOT the whole company
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
ZENDESK_SUBDOMAIN
ZENDESK_EMAIL
ZENDESK_API_TOKEN
ASSEMBLED_API_KEY

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

**Brand tokens — configure in tailwind.config.ts, use nowhere else:**
```
hr-navy:        #1E2E4A   headings · nav · primary text
hr-green:       #1D9E75   actions · positive indicators · brand accent
hr-green-dark:  #0F6E56   hover · active states
hr-green-light: #E1F5EE   subtle backgrounds · highlights
hr-gray:        #F5F5F4   page background
```

**Performance state colors:** amber-500 for attention · hr-green for positive · slate-400 for neutral
**Never use red for any performance state.** (Red is allowed only for genuine system errors —
failed save, lost connection — never for an employee's metrics.)

**Every KPI tile must show:** metric name (from DB) · value + unit · trend/status indicator ·
4-week sparkline · coaching prompt (from DB). Last-updated timestamp: a section-level "synced"
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

---

## Approved dependencies

**Shared:** `zod` (schemas live here, imported by both apps)
**Frontend:** `react react-dom react-router-dom @supabase/supabase-js tailwindcss @tailwindcss/forms recharts date-fns lucide-react jspdf vite @vitejs/plugin-react vite-plugin-pwa typescript`
**Backend:** `express cors helmet express-rate-limit @supabase/supabase-js node-cron axios typescript tsx dotenv`
**Testing:** `vitest @testing-library/react supertest`

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

### Assembled metric computation (when WFM activates)

| Metric | Source | Formula |
|---|---|---|
| schedule_adherence | activities + agent_states | Overlap of productive states with scheduled activities / total scheduled productive time |
| occupancy | agent_states | Time in productive states / total logged-in time (excluding Offline) |
| handle_time | agent_states | Avg duration of individual customer-facing state entries |
