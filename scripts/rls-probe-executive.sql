-- rls-probe-executive.sql — W2 executive-role RLS verification (release-plan W2).
-- Run in the Supabase SQL editor AFTER migration 0017 is applied, as a SEPARATE
-- paste (the enum value must be committed before it can be used here).
--
-- Probe 1 promotes Adam to executive TRANSACTION-LOCALLY (as service_role —
-- the 0010 guard trigger silently reverts role changes from any other
-- context), simulates the JWT he will hold after his next sign-in, asserts
-- org-wide visibility AND that every admin-only policy still excludes him,
-- then rolls back. Nothing persists, whatever the outcome. The real, audited
-- role assignment happens later via scripts/set-adam-executive.ts.
--
-- PROBE 1 — expected: one row, every column matching its stated expectation.
-- (Counts current as of 2026-07-06: 87 active manager-role profiles, 351
-- employees — small drift from org changes is fine; "0" expectations are not.)

begin;

set local role service_role;

update profiles set role = 'executive'
where email = 'adam.seow@hungerrush.com';

do $$
begin
  if not exists (
    select 1 from profiles
    where email = 'adam.seow@hungerrush.com' and role::text = 'executive'
  ) then
    raise exception 'Adam profile not found or role not set — is 0017 applied? Aborting probe.';
  end if;
end $$;

-- The JWT Adam holds after his next sign-in / token refresh.
select set_config(
  'request.jwt.claims',
  jsonb_build_object(
    'sub',  (select id::text from profiles where email = 'adam.seow@hungerrush.com'),
    'role', 'authenticated',
    'app_metadata', jsonb_build_object('role', 'executive')
  )::text,
  true
);

set local role authenticated;

with
  md_update_attempt as (
    -- no-op self-assignment; the 0012 admin policy should filter every row
    update metric_definitions set is_active = is_active returning key
  ),
  profile_update_attempt as (
    -- no-op; only own-row (0001) or admin (0014) may update other profiles
    update profiles set full_name = full_name
    where id <> auth.uid() returning id
  )
select
  (select count(*) from employees)                              as "employees visible (expect ~351 = org-wide)",
  (select count(*) from profiles)                               as "profiles visible (expect ~87 = active manager-role, org-wide)",
  (select count(*) from metric_snapshots)                       as "snapshots visible (expect four figures = org-wide)",
  (select count(*) from profiles where is_active = false)       as "inactive profiles (expect 0 - admin-only)",
  (select count(*) from profiles where role::text = 'employee') as "employee-role profiles (expect 0 - admin-only)",
  (select count(*) from audit_log)                              as "audit_log rows (expect 0 - admin-only)",
  (select count(*) from md_update_attempt)                      as "metric defs updatable (expect 0 - admin-only)",
  (select count(*) from profile_update_attempt)                 as "other profiles updatable (expect 0 - admin-only)";

rollback;

-- =============================================================================
-- PROBE 2 (optional, separate paste) — audit_log INSERT exclusion.
-- Expected result: ERROR "permission denied for table audit_log" — the
-- authenticated role has no INSERT grant (0008), which denies before RLS is
-- even evaluated; the 0015 insert policy would exclude non-admins after that.
-- The editor rolls the failed transaction back automatically.
-- =============================================================================
-- begin;
-- select set_config(
--   'request.jwt.claims',
--   jsonb_build_object(
--     'sub',  (select id::text from profiles where email = 'adam.seow@hungerrush.com'),
--     'role', 'authenticated',
--     'app_metadata', jsonb_build_object('role', 'executive')
--   )::text,
--   true
-- );
-- set local role authenticated;
-- insert into audit_log (actor_id, action, resource_type, resource_id)
-- values (null, 'rls_probe', 'probe', 'should-fail');
-- rollback;
