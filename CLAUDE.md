# HungerRush Manager Scorecard — Project Bible

> Read this file in full before writing any code or making any architectural decision.
> If a user request conflicts with anything here, flag it — do not silently override.

---

## Current Session Status

**Last updated:** 2026-06-27 (session 8)

### Completed this session
- **Scorecard page working with real data** — KPI tiles display correct values for ticket_volume, first_reply_time, csat_score, resolution_rate. Sparklines render single data point (correct — only 1 week of snapshots exists).
- **Null metric display fixed** — connectors now return `null` instead of `0` when no data exists (CSAT with zero ratings, Assembled with no WFM states, SLA with no policies). KpiTile shows metric-specific labels: "No ratings yet" (CSAT), "No schedule data" (Assembled), "Not configured" (SLA).
- **Stale DB rows cleaned** — deleted 267 misleading zero-value rows (63 sla_compliance, 15 csat_score, 63 each schedule_adherence/occupancy/handle_time). 237 clean snapshots remain.
- **1:1 notes and action items saving correctly** — scorecard sessions persist, action item checkboxes toggle and save.
- **Dashboard metrics filter** — defaults to "Has metrics only" (65 employees with data indicators).

### DB state (confirmed 2026-06-27)
- **237 snapshots** in `metric_snapshots` (cleaned from 504 — stale zeros removed)
- **65 employees** with agent IDs, **351 total employees**
- **Metrics with data:** ticket_volume (63), first_reply_time (63), resolution_rate (63), csat_score (48)
- **Metrics with no data (null):** sla_compliance (no Zendesk SLA policies), schedule_adherence/occupancy/handle_time (no Assembled WFM data)

### Where we stopped
Phase 3 complete. All exit criteria met.

### Next actions
1. **Phase 4: Senior manager rollup view** — aggregate trend direction across a manager's team (e.g. "6 of 8 metrics improving"), no individual composite scores
2. **Employee sharing** — UUID v4 share tokens, 72-hour expiry, single-use, read-only scorecard view, audit_log entry
3. **PDF export** — watermarked scorecard export with audit_log entry
4. **Email nudge** — weekly manager reminder via Supabase email

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
- Share tokens: UUID v4 · 72-hour expiry · single-use · every use written to `audit_log`

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
**Frontend:** `react react-dom react-router-dom @supabase/supabase-js tailwindcss @tailwindcss/forms recharts date-fns lucide-react vite @vitejs/plugin-react vite-plugin-pwa typescript`
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
| 4 | Senior manager rollup · employee sharing · PDF export · email nudge | ⬜ | A senior manager sees team trends; a manager can share a read-only card |
| 5 | Polish · onboarding tour · PWA · audit log · load test · prod deploy | ⬜ | Pilot managers using it in production |

**Current phase:** 4
**Last session:** 2026-06-27 (session 8) — Scorecard page confirmed working with real data. Fixed null metric display (connectors return null for no-data, KpiTile shows metric-specific labels). Cleaned 267 stale zero-value rows. 1:1 notes and action items verified saving. Phase 3 exit criteria met. Next: Phase 4 — senior manager rollup, employee sharing, PDF export, email nudge.

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
