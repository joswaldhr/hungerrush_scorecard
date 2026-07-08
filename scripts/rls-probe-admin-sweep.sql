-- rls-probe-admin-sweep.sql — audit PR 1 verification (REVIEW.md Track 0.2).
-- Run in the Supabase SQL editor AFTER migration 0019 is applied AND
-- scripts/sweep-admin-roles.ts --execute has run. Read-only intent: probe 2
-- simulates claims inside a transaction and rolls back; nothing persists.
-- Pattern: scripts/rls-probe-executive.sql.

-- =============================================================================
-- PROBE 1 — data state. Expected: one row, every column matching expectation.
-- =============================================================================

select
  (select count(*) from profiles where role::text = 'admin')
    as "admin-role profiles (expect 1)",
  (select count(*) from profiles where role::text = 'admin' and is_active)
    as "active admin profiles (expect 1)",
  (select email from profiles where role::text = 'admin' limit 1)
    as "the remaining admin (eyeball: James)",
  (select count(*) from auth.users u
     where u.raw_app_meta_data->>'role' = 'admin')
    as "auth users carrying an admin CLAIM (expect 1)",
  (select count(*) from auth.users u
     join profiles p on p.id = u.id and p.is_active = false
     where u.raw_app_meta_data ? 'role')
    as "inactive profiles still carrying ANY role claim (expect 0)";

-- =============================================================================
-- PROBE 2 — a swept profile's post-sweep session (fresh sign-in: no role claim).
-- Simulates the JWT such an account would now receive and asserts it can read
-- nothing org-wide and update nothing. SEPARATE PASTE. Rolls back.
-- Expected: one row, all zeros except "own profile row" which may be 0 or 1.
-- =============================================================================

begin;

select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',  (select id::text from profiles
             where role::text = 'employee' and is_active = false
             order by email limit 1),
    'role', 'authenticated',
    'app_metadata', '{}'::jsonb
  )::text,
  true
);

set local role authenticated;

with
  md_update_attempt as (
    update metric_definitions set is_active = is_active returning key
  ),
  profile_update_attempt as (
    update profiles set full_name = full_name
    where id <> auth.uid() returning id
  )
select
  (select count(*) from employees)          as "employees visible (expect 0)",
  (select count(*) from metric_snapshots)   as "snapshots visible (expect 0)",
  (select count(*) from scorecard_sessions) as "sessions visible (expect 0)",
  (select count(*) from audit_log)          as "audit_log rows (expect 0)",
  (select count(*) from profiles where id <> auth.uid())
                                            as "other profiles visible (expect 0)",
  (select count(*) from md_update_attempt)  as "metric defs updatable (expect 0)",
  (select count(*) from profile_update_attempt)
                                            as "other profiles updatable (expect 0)";

rollback;
