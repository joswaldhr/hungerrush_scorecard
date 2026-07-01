# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Read this file in full before writing any code or making any architectural decision.
> If a user request conflicts with anything here, flag it — do not silently override.

---

## Current Session Status

**Last updated:** 2026-07-01 (session 19)

### Current state
All 5 development phases, all 4 UI/UX redesign sprints, full layout redesign, visual polish pass, UX audit fixes, and data integrity audit complete. App is pilot-ready at `hungerrush-scorecard.vercel.app`.

**Session 19 — Data integrity audit:** 11-dimension audit across all data paths from API call to screen pixel. 5 fixes shipped:
1. **TrendChip direction inversion** (CRITICAL) — RollupPage was showing opposite color/direction for lower_is_better metrics; simplified to use pre-computed `improving`/`declining` counts from `useManagerRollup`
2. **Connector null-vs-zero** — Zendesk connector returned 0 for no-data (zero tickets, no replies, no resolved); now returns null. Removed 8 `|| value === 0` UI workarounds across KpiTile, ScorecardPage, SharedScorecardPage, DashboardPage
3. **PDF zero guard** — `pdfExport.ts` now treats value 0 as "No data" for stale DB rows predating the null fix
4. **Dashboard preview date filter** — `useDirectReports` preview query now filters to current week's Monday, matching scorecard page behavior
5. **Snapshot correction** — `syncService.ts` changed `ignoreDuplicates: true` to `false` so re-syncs update stale values

**Remaining:** mobile navigation (hamburger menu for screens under 1024px).

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

### UI/UX redesign sprints (all complete, committed to master)
- **Sprint 1:** KPI tile redesign — large values, direction badges, sparklines, null/zero states, tile ordering, compact 3-column grid, coaching prompts always visible
- **Sprint 2:** Dashboard upgrade — search, metric previews, sort toggle, last synced, prev/next navigation, admin nav cleanup, auto-scaling time format
- **Sprint 3:** Rollup redesign — data-first sorting, no-data collapse, trend chips with direction-aware colors, week indicator, drill-down to manager's team
- **Sprint 4:** Typography polish — slate type scale for content headings/labels (hr-navy preserved for nav), section spacing, uppercase section headers on scorecard, notes panel wrapped in card with label, login card redesign (accent bar, rounded-xl, tighter layout)

### Layout redesign (complete, committed to master)
- AppShell.tsx deleted, replaced by AppLayout.tsx — 220px hr-navy left sidebar (desktop), hidden on mobile
- Role-based nav: Users (dashboard), LayoutGrid (rollup, senior_manager+), SlidersHorizontal (metrics, admin), FileOutput (export log, admin)
- User identity block with initials avatar, email, sign-out always visible
- 52px white topbar with title, optional subtitle, and actions slot
- All 6 authenticated pages migrated (Dashboard, Scorecard, Rollup, MetricConfig, ExportLog + SharedScorecard uses LogoMark export only)
- LoginPage redesigned standalone (no sidebar) — navy brand mark, green accent bar, green CTA
- Polish fixes: compact stats cards, employee list card border, metric preview min-width, KPI tile gap tightened
- Latest commits: `1afa210` (layout redesign), `18a8717` (polish fixes)

### Visual polish pass (session 17, committed to master)
- AppLayout `<main>` given `bg-[#F7F6F3]` — white cards now have contrast against page background
- Dashboard stats cards: label-on-top layout, `text-[24px]` value + green sub text inline via `flex items-baseline`, last-synced splits date/time
- Employee list rows: `border-b border-[#F0EEE9] last:border-b-0`, `cursor-pointer`, `duration-100`
- Metric preview columns: `gap-6 pr-2`, `min-w-[72px] text-right` per column
- Null KPI tiles: `p-4 min-h-0`, sparkline hidden when null
- Scorecard section labels: `mb-3 mt-2` for breathing room
- Notes card wrapper confirmed: `bg-white rounded-xl border border-[#E8E6E1] p-5 mt-4` (was invisible before bg fix)
- Latest commits: `ce91be7` → `3cacb65` → `43b9cc9` → `5a9411b`

### UX audit fixes (session 18, committed to master)
**Batch 1 (commit `c97472c`):**
- NotesPanel: inline "Session saved" confirmation with 3s auto-dismiss
- ScorecardPage: error/not-found states render inside AppLayout (sidebar stays visible)
- ScorecardPage: "Your team" breadcrumb is clickable link to /dashboard; AppLayout title prop widened to ReactNode
- ScorecardPage: clipboard.writeText wrapped in try/catch with fallback URL input on failure
- ScorecardPage: PDF audit POST decoupled — audit failure no longer shows as export error
- ScorecardPage: prev/next uses replace:true to avoid polluting browser history
- DashboardPage: manager filter "All teams" link now navigates to /rollup instead of /dashboard
- OfflineBanner: "Back online" banner auto-dismisses after 4 seconds

**Batch 2 (commit `67f2dcd`):**
- AppLayout: sign-out button always visible at opacity-60 (was opacity-0 hover-only)
- LoginPage: "Signing in..." loading state + disabled button prevents double-click
- AuthCallback: error state styled as branded card with amber warning (was raw red text)
- KpiTile: coaching prompts always visible below sparkline (was hidden group-hover:block — invisible on touch)
- KpiTile: sparkline "4 weeks" context label when history data exists
- SharedScorecardPage: coaching-intent intro block before metrics; header changed to "Your Weekly Snapshot"
- NotesPanel: date picker bounded to last 4 weeks through today

**Not yet addressed from audit:**
- Mobile navigation (hamburger/drawer for screens below 1024px) — requires new component
- MetricConfigPage save success confirmation — minor, admin-only page
- TourModal skip button + "?" icon to re-trigger tour
- Trend chip notation on RollupPage (e.g., "3/5" → "3 of 5 ↑")

### Remaining follow-ups (non-blocking)
1. **Connection pooling** — add `?pgbouncer=true` to Supabase connection string in API, set pool size to 10
2. **CORS lockdown** — replace `cors()` wildcard with explicit Vercel origin allowlist in `apps/api/src/index.ts`
3. **Email nudge** — Monday 8am UTC cron, axios.post to Resend API (no new dep), needs `RESEND_API_KEY` from user
4. **Zendesk `updated` date filter** (HIGH) — `searchTickets` uses `updated>=${start}` which includes tickets updated but not created in the period; stale reply times contaminate first_reply_time averages. Switch to `created>=${start}` or filter post-fetch by `created_at`.
5. **UTC vs local timezone week boundary** (MEDIUM) — backend computes Monday via `Date.UTC`, frontend uses `date-fns startOfWeek` (local time). Managers in non-UTC zones may see a period_start mismatch near week boundaries.
6. **No auto-refresh** (MEDIUM) — data loads once on mount; no polling or refetch mechanism. Stale data if manager keeps tab open during a sync cycle.
7. **Assembled productiveStateNames assumption** (MEDIUM) — connector builds productive state names from activity_type names, but hasn't verified these match actual agent state strings from `/agents/state`
8. **SLA policy fetched per-employee** (MEDIUM) — Zendesk SLA policies fetched 63x per sync run instead of once and cached
9. **"Last Week" trend badge shows current-week direction** (MEDIUM) — KPI tiles in the "Last Week" section display trend computed from current-week data, not last-week trend
10. **Partial sync failure creates silent data-age gap** (MEDIUM) — if one connector fails for an employee, that employee's other metrics still update, creating inconsistent data freshness with no indicator
11. **Mobile navigation** — hamburger/drawer for screens below 1024px (deferred from session 18)

### Assembled API — confirmed working (session 2, bugs fixed session 4)
- **Base URL:** `https://api.assembledhq.com/v0`
- **Auth:** HTTP Basic (API key as username, empty password)
- **`GET /v0/people`** — 77 agents, response keyed by UUID (`{ people: { uuid: {...} } }`), includes `platforms.zendesk` for cross-referencing. Person `id` ≠ `agent_id` — use `agent_id` for state/activity queries.
- **`GET /v0/agents/state?agent_id=<uuid>&start_time=<unix>&end_time=<unix>`** — actual agent states (paginates correctly with `limit`/`offset`)
- **`GET /v0/activities`** — returns ALL org activities regardless of `agents[]`, `limit`, `offset` params. Must fetch once and filter client-side by `agent_id`. Response is a dict (`{ activities: { uuid: {...} } }`). Activity field is `type_id` (not `activity_type_id`).
- **`GET /v0/activity_types`** — 17 types (`{ activity_types: { uuid: {...} } }`), each has `productive` boolean (only "Phone + Email" and "In/Out Calls" are productive)
- **Reports endpoint** (`POST /v0/reports/adherence`) returns 400 with empty body — unusable, compute metrics from raw data instead
- **All timestamps are Unix seconds** (not milliseconds)

### Metric computation strategy (Assembled)
| Metric | Source | Computation |
|---|---|---|
| Schedule adherence | `activities` + `agent_states` | Overlap of actual productive states with scheduled productive activities / total scheduled productive time |
| Occupancy | `agent_states` | Time in productive states / total logged-in time (excluding Offline) |
| Handle time | `agent_states` | Average duration of individual customer-facing state entries |

---

## What this is

A coaching-first 1:1 scorecard tool for HungerRush managers. Weekly metric data from
Zendesk and Assembled surfaces in a clean UI managers use during 1:1 conversations.
The philosophy is growth and momentum — never judgment or punishment.

**Users:** frontline managers · senior managers (rollup view) · admins (config) · employees (read-only share)
**Data sources:** Zendesk (live) · Assembled (live) · Forethought.ai (stub — API not ready)
**Scale:** ~30+ managers, ~45–150 employees. This is a small-scale internal tool — favor simplicity over infrastructure that only pays off at large scale.

**Hosting note:** built on Supabase + Vercel for speed. A heads-up has gone to IT/security; if they
require everything inside the company Azure tenant, the stack can be migrated — the `packages/shared`
types, connector interface, and SQL migrations all carry over.

---

## Plain-language glossary (for quick reference)

- **RLS (Row Level Security):** database rules that decide which rows each logged-in user can see.
  Our primary way of making sure a manager only sees their own people.
- **RBAC (Role-Based Access Control):** who-can-do-what based on role (admin / senior manager / manager / employee).
- **SSO (Single Sign-On):** logging in with existing company Microsoft credentials, no new password.
- **JWT:** the secure token proving who a logged-in user is, checked on each request.
- **PWA (Progressive Web App):** a website that can be "installed" like an app on phone/desktop.
- **Connector:** a small module that pulls data from one outside source (Zendesk, Assembled).
- **Snapshot:** a frozen copy of a week's metrics, saved so the numbers don't change later.

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
│       └── schemas.ts        Zod schemas; TS types inferred from these (z.infer)
├── apps/
│   ├── web/src/
│   │   ├── components/        shared UI components
│   │   ├── features/          scorecard · notes · admin · auth
│   │   ├── hooks/             all data fetching (never fetch in a component body)
│   │   ├── lib/               supabase client · utils · constants
│   │   └── types/             web-ONLY types (props, UI state) — domain types come from shared
│   └── api/src/
│       ├── connectors/        one file per source, all implement DataSourceConnector
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

Lives in `packages/shared/src/types.ts` so both apps can reference the result shape.

```typescript
export interface ConnectorMetricResult {
  employeeId: string;
  metricKey: string;
  value: number;
  unit: string;
  periodStart: Date;
  periodEnd: Date;
  rawSource: Record<string, unknown>;
}

export interface DataSourceConnector {
  name: string;
  isAvailable: boolean;
  fetchAgentMetrics(agentId: string, periodStart: Date, periodEnd: Date): Promise<ConnectorMetricResult[]>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}
```

**Forethought stub:** `isAvailable: false` · returns `[]` · never throws · logs a warning only

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

**Every KPI tile must show:** metric name (from DB) · value + unit · direction indicator ·
4-week sparkline · coaching prompt (from DB) · last-updated timestamp

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

| Phase | Description | Status | Exit criteria (done = all true) |
|---|---|---|---|
| 1 | Scaffold · shared package · Supabase · Microsoft SSO · RBAC | ✅ | A manager can log in via M365 and see an empty dashboard scoped to their reports |
| 2 | Zendesk + Assembled connectors · sync job · admin config UI | ✅ | Sync job populates real metrics for seeded employees on a schedule |
| 3 | Scorecard UI · KPI tiles · sparklines · coaching prompts · 1:1 notes | ✅ | A manager can open an employee, see live metrics, and save 1:1 notes |
| 4 | Senior manager rollup · employee sharing · PDF export · email nudge | ✅ | A senior manager sees team trends; a manager can share a read-only card |
| 5 | Polish · onboarding tour · PWA · audit log · load test · prod deploy | ✅ | Pilot managers using it in production |

**Current phase:** Complete — all 5 phases delivered. All 4 UI/UX redesign sprints, full layout redesign, UX audit fixes, and data integrity audit complete. Pushed to production.
**Last session:** 2026-07-01 (session 19) — 11-dimension data integrity audit across all data paths (connectors → sync → DB → hooks → display). Found 16 issues; fixed top 5 in priority order: TrendChip direction inversion (CRITICAL — senior managers got exactly-wrong signals for lower_is_better metrics), connector null-vs-zero compound bug (root cause + 8 UI workaround removals), PDF zero guard, dashboard preview date filter, snapshot correction enablement. 11 unfixed findings documented in remaining follow-ups (items 4–10).

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

| Date | Decision | Reason |
|---|---|---|
| Project start | React + Supabase + Railway | Low-ops · modular connectors · strong RLS · fastest path to a working demo |
| Project start | Supabase + Vercel over all-Azure | Company already trusts third-party data tools (Zendesk, Assembled); speed prioritized; IT flagged, stack kept portable in case they require Azure |
| Project start | Express backend scoped to connectors/jobs only | Supabase + RLS handles reads; Express earns its place only for secret-holding scheduled syncs |
| Project start | Redis deferred, not included | Postgres is the cache; frontend reads snapshots, not live APIs. Add Redis only on proven rate-limit pressure |
| Project start | `packages/shared` for domain types + Zod schemas | Single source of truth prevents frontend/backend contract drift |
| Project start | No individual composite score; aggregate trend direction allowed | Coaching-first for individuals; rollup still needs a focus signal that doesn't rank people |
| Project start | Microsoft 365 SSO only | Company standard · no separate passwords |
| Project start | Forethought stubbed as unavailable | API not ready · interface locked for future drop-in |
| Project start | Two data windows (live + snapshot) | Current context + stable record for 1:1 discussion |
| Project start | PDF export must watermark + log to audit_log | A forwardable performance doc outside access controls is a liability for a non-punitive tool |
| Project start | MCP servers deferred to Phase 2+ | Phase 1 needs none; add the Supabase MCP only once the DB exists, and point it at local/staging only — never production |
| Project start | Slack removed entirely | Company does not use Slack; weekly manager nudge will use email via Supabase instead |
| 2026-06-24 | Auto-create profile trigger on auth.users INSERT | Ensures a profile row exists immediately after SSO login; Graph sync then updates role and manager_id |
| 2026-06-24 | Graph sync via Microsoft Graph client credentials | Pulls org structure from Azure AD; classifies roles by direct-report hierarchy; sync route protected by service key header |
| 2026-06-24 | Dashboard reads employees directly via Supabase + RLS | No Express route for reads — RLS via visible_employee_ids() is the access control, per architecture principle |
| 2026-06-25 | service_role needs explicit table GRANTs | Supabase default privileges don't always cover migration-created tables; migration 0009 adds ALL grants for service_role |
| 2026-06-25 | Seed data instead of Graph sync for Phase 1 verification | Graph sync blocked on Azure app registration permissions (IT contacted); manual seed data unblocks testing |
| 2026-06-25 | `display_order` integer instead of `weight` on metric_definitions | A weight column implies computing weighted composite scores, which violates the no-composite-score rule and would mislead future developers; display_order controls UI ordering only |
| 2026-06-25 | JWT claims sync trigger for admin RLS | Profiles.role syncs to auth.users.raw_app_meta_data so RLS policies can check `(auth.jwt()->'app_metadata'->>'role')` without querying profiles — prerequisite for all admin policies going forward |
| 2026-06-25 | Assembled /v0/people fetched per-employee during sync | Acceptable for current scale (~77 agents); cache within sync run before Phase 3 when real employee count increases |
| 2026-06-25 | ~250 flagged admin accounts from Graph sync are service accounts | Conference rooms, shared mailboxes, integration users, external contacts — needs admin UI task in Phase 4 to mark non-person accounts inactive |
| 2026-06-25 | Graph sync now runs against live Azure AD | IT granted User.Read.All + Directory.Read.All; 359 profiles, 339 employees created from real org structure; replaces seed data approach |
| 2026-06-26 | Assembled /activities endpoint ignores agents[] filter — must filter client-side by agent_id after fetching | Confirmed via live API testing: endpoint returns all agents' activities regardless of agents[] param; connector post-filters to the requested agent_id |
| 2026-06-26 | Zendesk SLA compliance returns null when no policies configured — UI shows "Not configured" instead of 0% | HungerRush Zendesk account has zero SLA policies; storing 0% would mislead managers into thinking compliance is failing rather than unconfigured |
| 2026-06-26 | Assembled /activities endpoint ignores limit/offset/agents[] — fetch once, cache, filter client-side | Endpoint returns all org activities (~1,558) regardless of params; pagination caused infinite loop; single fetch + cache across sync run eliminates 195+ redundant API calls |
| 2026-06-26 | Admin config UI uses direct Supabase read/write with JWT-based RLS | No Express route — admin UPDATE policy on metric_definitions uses `auth.jwt()->'app_metadata'->>'role'` (migration 0012), avoiding the profile-query recursion that killed the original admin policies |
| 2026-06-26 | ENTRA_CLIENT_SECRET rotated | Current value in apps/api/.env; previous secret expired or was rotated by IT |
| 2026-06-26 | Action items stored as separate table (`session_action_items`) not JSONB | Structured completion tracking with individual row updates for checkbox toggle; RLS scoped through scorecard_sessions → visible_employee_ids(); cascade delete on session removal |
| 2026-06-26 | Scorecard metrics fetched as single bulk query + client-side grouping | `get_metric_history()` DB function is per-metric (8 RPC calls per page load); single query for all snapshots in 4-week range + group by metric_key is 1 query total |
| 2026-06-27 | Sparklines show single point until weekly snapshots accumulate — correct behavior | Only one week of synced data exists; sparklines will fill in automatically as the Sunday batch job creates weekly snapshots over time |
| 2026-06-27 | Assembled 0% metrics are genuine no-data — display null not zero | WFM state tracking not active for any HungerRush agents; all 63 agents had zero states/activities; connectors now return null when denominator is 0, so "No schedule data" displays instead of misleading 0% |
| 2026-06-27 | CSAT 0 means no ratings, not 0% satisfaction — connector returns null when rated count is 0 | `roundPercent(0, 0)` was returning 0; now returns null so UI shows "No ratings yet" instead of "0.0%" |
| 2026-06-27 | Stale sla_compliance rows deleted — 63 rows with value=0 from a sync when SLA policies briefly existed | Zendesk confirms zero SLA policies; connector already returns null when no policies; cleanup prevents misleading display |
| 2026-06-27 | Share tokens valid for full 72 hours, not single-use | Single-use caused bad UX if employee closed tab accidentally; `used_at` records first access timestamp but token stays valid until `expires_at` |
| 2026-06-27 | Service accounts marked inactive via `is_active = false`, not deleted | Preserves audit trail and profile references; ~250 admin service accounts deactivated in migration 0014; real admins re-activated via Profile Management UI |
| 2026-06-27 | `jspdf` approved for PDF export | Client-side PDF generation; minimal dependency; programmatic watermark control without a backend route |
| 2026-06-29 | Email nudge via axios.post to Resend API — no `resend` package | Single HTTP POST with existing `axios` dependency; free tier covers ~30 managers; Resend shared domain for pilot |
| 2026-06-29 | Onboarding tour stored in localStorage, not DB | Per-device, no auth required to check; shows once per browser; "?" icon re-triggers; no migration needed |
| 2026-06-29 | PWA workbox: CacheFirst for shell, NetworkFirst for Supabase API | App shell rarely changes (cache wins); API data should be fresh when online but available offline from 24hr cache |
| 2026-06-29 | Vercel + Railway deploy from repo root, not app subdirectory | npm workspaces require install from root to resolve `@scorecard/shared`; vercel.json uses `installCommand: "echo 'skip'"` and consolidates into `buildCommand` |
| 2026-06-29 | Default Vercel URL for pilot, custom domain later | `hungerrush-scorecard.vercel.app` — avoids DNS setup during initial deployment |
| 2026-06-29 | Supabase client requires `global.fetch` override in production | supabase-js internal fetch wrapper constructs invalid HTTP headers in some browsers; passing native `fetch` directly bypasses the issue |
| 2026-06-29 | Implicit OAuth flow with manual hash detection in AuthCallback | PKCE not supported by Supabase project config; AuthCallback waits for Supabase client to auto-parse hash fragment via `detectSessionInUrl`, then polls `getSession()` |
| 2026-06-30 | Auto-scaling time format for seconds-unit metrics | first_reply_time and handle_time values can be very large (business hours); formatMetricValue auto-scales: <60min shows "X.X min", ≥60min shows "X.Xh" |
| 2026-06-30 | Dashboard metric previews via bulk query in useDirectReports | Single query fetches latest ticket_volume + first_reply_time for all visible employees; no per-employee queries; joined client-side by employee_id |
| 2026-06-30 | Prev/next navigation via React Router location.state | Employee list passed from dashboard to ScorecardPage; no extra query; disabled gracefully on direct URL navigation |
| 2026-07-01 | Coaching prompts always visible, not hover-only | Touch devices (tablets in 1:1s) couldn't access hover; coaching prompts are the product's core value — hiding them behind hover contradicts the product philosophy |
| 2026-07-01 | Prev/next uses replace:true instead of push | Clicking through 5 employees created 5 history entries; back button should return to dashboard, not replay each employee |
| 2026-07-01 | PDF audit POST decoupled from export status | Audit endpoint failure was showing "Failed" to the user even though the PDF downloaded successfully; audit is fire-and-forget from the user's perspective |
| 2026-07-01 | AppLayout title prop accepts ReactNode not just string | Enables clickable breadcrumb on ScorecardPage ("Your team → Name" where "Your team" is a Link) |
| 2026-07-01 | SharedScorecardPage header changed to "Your Weekly Snapshot" | "HungerRush Scorecard" is an internal product name meaningless to employees; "Your Weekly Snapshot" is employee-facing and non-clinical |
| 2026-07-01 | Clipboard fallback URL input on writeText failure | clipboard API can fail in background tabs or restricted contexts; fallback shows selectable URL so the share token isn't wasted |
| 2026-07-01 | Connectors return null (not 0) for no-data scenarios | Zero is a valid metric value (e.g., 0 tickets); returning 0 for "no data" caused compound bugs — UI added `|| value === 0` workarounds that then hid legitimate zeros. Null means "no data", zero means "measured zero". |
| 2026-07-01 | TrendChip uses pre-computed improving/declining directly | `useManagerRollup` already accounts for direction when computing improving/declining counts; TrendChip was double-applying direction logic, inverting colors for lower_is_better metrics |
| 2026-07-01 | Snapshot upsert uses `ignoreDuplicates: false` | Previous `true` setting prevented corrections on re-sync — if a connector initially wrote a wrong value, subsequent syncs couldn't update it. The upsert key (employee_id, metric_key, period_start) already prevents true duplicates |
| 2026-07-01 | Dashboard preview query filtered to current week Monday | Previously fetched latest snapshot regardless of period_start, creating mismatch with scorecard page which filters to current week. Now both use `period_start = thisMondayStr` |
| 2026-07-01 | PDF export treats value 0 as "No data" | Guard against stale DB rows written before the null fix; once old zero-value rows age out of the 4-week window, this guard becomes redundant but harmless |
