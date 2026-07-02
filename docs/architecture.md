# Architecture

## Current state

Phase 2 nearly complete — data pipeline confirmed working, one item remaining (admin config UI). Migrations 0001–0011 applied.

**Live sync results (2026-06-26):** 65 employees processed, 441 metrics written (3 Assembled + 4 Zendesk per employee), 0 errors, ~5 min duration. `sla_compliance` excluded — no SLA policies configured in Zendesk (value stored as null, not written to DB).

Graph sync ran against live Azure AD: 359 profiles, 339 employees created from real org structure. ~250 service accounts (conference rooms, shared mailboxes, etc.) flagged as admin — needs cleanup in Phase 4.

## Stack

| Layer | Technology | Host |
|---|---|---|
| Frontend | React 18 + TypeScript + Tailwind CSS | Vercel |
| Backend | Node.js + Express + TypeScript | Railway |
| Database + Auth | Supabase (Postgres + RLS) | Supabase |
| SSO | Microsoft Entra ID via Supabase Auth | — |

## Data flow

Two paths — the distinction governs every design decision:

1. **Direct Supabase reads** — for all data a logged-in user is allowed to see. RLS enforces
   access. No Express route needed. Frontend calls Supabase client directly.

2. **Express backend** — for connectors, scheduled sync jobs, and anything that must hold an
   external API secret. Not a general-purpose API mirror of the database.

## Sync pipeline

Since Phase 1B (2026-07-02) the sync is registry-driven. Metric math lives in
`apps/api/src/metrics/` (one module per metric: `spec` + pure `compute`); connectors are
thin fetchers returning one source's raw week data. `runSync` reads
`metric_definitions WHERE is_active = true` and writes **registry ∩ is_active** — a
source with no active metrics is skipped entirely (no API calls). Per-run data (Zendesk
SLA target, Assembled org-wide people/activity-types/activities) is fetched once in the
connector's `prepareRun` and passed into every `fetchWeekData` call. Recipe for adding a
metric: `docs/metrics.md`.

| Connector | Metrics | Notes |
|---|---|---|
| Assembled | `schedule_adherence`, `occupancy`, `handle_time` | `/activities` endpoint ignores all filter/pagination params — fetched org-wide once per run in `prepareRun`, filtered client-side by `agent_id`. Uses `agent_id` field (not person `id`) for state queries. |
| Zendesk | `ticket_volume`, `first_reply_time`, `csat_score`, `resolution_rate`, `sla_compliance` | SLA compliance computes to null (no row written) while no SLA policies are configured in Zendesk. |
| Forethought | — | Stub: `isAvailable: false`, `fetchWeekData` returns `null` |

Schedule: live refresh every 4h 6am–10pm UTC, weekly snapshot Sunday 23:59 UTC.
Weekly windows: live = Monday 00:00 UTC → now; snapshot = Monday 00:00 → Sunday 23:59:59 UTC.

## Domain model

Tables (migrations 0001–0011 applied):

| Table | Purpose |
|---|---|
| `profiles` | All system users (managers, senior managers, admins, employees with accounts) |
| `employees` | People being coached; `manager_id` → `profiles.id` of their manager |
| `metric_definitions` | Metric catalog: name, unit, source, coaching_prompt, direction, display_order |
| `metric_snapshots` | Weekly frozen metric values per employee |
| `scorecard_sessions` | 1:1 session records |
| `session_notes` | Notes written during a session |
| `share_tokens` | Read-only sharing links (72h expiry, single-use) |
| `audit_log` | All sensitive actions (share token use, admin changes) |

## RLS scoping

All row-level access flows through a single `SECURITY DEFINER` helper:

```sql
visible_employee_ids() → setof uuid
```

- `manager` → their direct reports only
- `senior_manager` → reports of the managers who report to them (one level down, not all)
- `admin` → everyone

Every table's SELECT policy uses this function. Hierarchy logic is never inlined in individual policies.

Admin RLS policies use JWT claims instead of table queries to avoid recursion:
- `(auth.jwt()->'app_metadata'->>'role') = 'admin'`
- Role is synced from `profiles.role` to `auth.users.raw_app_meta_data` via trigger (migration 0010)
- A guard trigger prevents non-`service_role` callers from changing their own role

## Shared package

`@scorecard/shared` (`packages/shared/src/`) is the single source of truth for:
- Domain types (inferred from Zod schemas via `z.infer`)
- `DataSourceConnector<TRunContext, TWeekData>` interface (connector contract, fetch-shape
  since Phase 1B; `ConnectorMetricResult` retired — connectors no longer compute metrics)
- `MetricSpec` + `METRIC_SPECS` (code-side metric identity and UI labels; consumed by the
  api metric registry and the web components)

Both `apps/web` and `apps/api` import from here.

## Change log

| Date | Change | Migration |
|---|---|---|
| 2026-06-24 | Initial scaffold — no DB schema yet | — |
| 2026-06-24 | All 8 core tables, 3 enums, `visible_employee_ids()`, `get_metric_history()`, RLS policies | `0001_core_tables.sql` |
| 2026-06-24 | FK + query-pattern indexes | `0002_indexes.sql` |
| 2026-06-24 | Auto-create profile on auth.users INSERT (SSO trigger) | `0003_profile_on_signup.sql` |
| 2026-06-24 | Fix RLS infinite recursion in `visible_employee_ids()` — rewrite to PL/pgSQL with per-role branching, reads hierarchy from profiles only | `0004_fix_rls_recursion.sql` |
| 2026-06-24 | Fix RLS recursion v2 — split into `visible_manager_ids()` (profiles only) + `visible_employee_ids()` (delegates); employees policy uses `visible_manager_ids()` directly | `0005_fix_rls_recursion_v2.sql` |
| 2026-06-24 | Fix cross-table RLS cycle — drop `profiles_select_visible` (read employees), replace with `profiles_select_managed` (profiles only) | `0006_fix_profiles_rls_cycle.sql` |
| 2026-06-24 | Drop all admin RLS policies — they self-reference profiles causing recursion; admin ops use service key; Phase 2 will re-add via JWT claims | `0007_drop_admin_policies.sql` |
| 2026-06-24 | Table-level GRANTs for `authenticated` role on all tables + functions | `0008_grant_table_permissions.sql` |
| 2026-06-25 | Table-level GRANTs for `service_role` on all tables + functions — needed for backend/seed operations | `0009_grant_service_role.sql` |
| 2026-06-25 | JWT role claims: `guard_role_change()` prevents self-escalation, `sync_role_to_jwt()` copies profiles.role → auth.users.raw_app_meta_data, backfill for existing profiles | `0010_jwt_role_claims.sql` |
| 2026-06-25 | Add `display_order` column to `metric_definitions`; seed 8 metrics (5 Zendesk, 3 Assembled) with coaching prompts | `0011_metric_definitions_seed.sql` |
| 2026-06-26 | Re-add admin UPDATE policy on `metric_definitions` using JWT claims (`auth.jwt()->'app_metadata'->>'role'`); original profile-based policy dropped in 0007 | `0012_admin_metric_definitions_policy.sql` |
| 2026-06-26 | Add `session_action_items` table for structured 1:1 action items with completion tracking; RLS scoped via scorecard_sessions → visible_employee_ids(); GRANTs for authenticated + service_role | `0013_session_action_items.sql` |
| 2026-06-27 | Add `is_active` boolean to `profiles` (default true); mark ~250 service accounts inactive; update `visible_manager_ids()` to exclude inactive profiles; add JWT-based admin SELECT/UPDATE policies on profiles | `0014_profiles_is_active.sql` |
| 2026-06-29 | Re-add audit_log RLS policies using JWT claims (dropped in 0007); enables admin ExportLogPage to read audit_log directly via Supabase | `0015_audit_log_admin_policies.sql` |
| 2026-07-02 | Phase 1B metric registry (no schema change): metric math moved to `apps/api/src/metrics/`, connectors become fetchers, sync writes registry ∩ `is_active` | — |
