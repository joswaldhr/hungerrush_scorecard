# Architecture

## Current state

Phase 1 scaffold complete. No database migrations applied yet.

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

## Domain model

Tables (all pending migration `0001_core_tables.sql`):

| Table | Purpose |
|---|---|
| `profiles` | All system users (managers, senior managers, admins, employees with accounts) |
| `employees` | People being coached; `manager_id` → `profiles.id` of their manager |
| `metric_definitions` | Metric catalog: name, unit, source, coaching_prompt, direction |
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

## Shared package

`@scorecard/shared` (`packages/shared/src/`) is the single source of truth for:
- Domain types (inferred from Zod schemas via `z.infer`)
- `ConnectorMetricResult` and `DataSourceConnector` interfaces (connector contract)

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
