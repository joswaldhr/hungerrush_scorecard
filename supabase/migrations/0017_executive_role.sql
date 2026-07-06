-- 0017_executive_role.sql
-- Adds the 'executive' role (W2 release readiness — docs/release-plan.md).
-- An executive gets admin-like DATA visibility, org-wide, with NO admin
-- capabilities:
--   - visible_manager_ids() gains an executive branch returning all active
--     manager-role profiles org-wide. visible_employee_ids() is unchanged —
--     it delegates to visible_manager_ids(), so every RLS policy built on it
--     (metric_snapshots, scorecard_sessions, session_notes, share_tokens,
--     employees) inherits the new scope with no policy edits.
--   - A JWT-claims profiles SELECT policy lets an executive read those manager
--     profiles for the rollup page. Same non-recursive pattern as 0014's admin
--     policies: a policy on profiles must never call a function that reads
--     profiles (see 0004-0006), so the check reads the token and the row's own
--     columns only.
--   - Every admin-only policy (metric_definitions update, audit_log select and
--     insert, profiles admin select and update) is untouched — they compare the
--     JWT role to 'admin' and keep excluding executives.
--
-- SQL-editor safety (single paste = one transaction): a new enum value cannot
-- be USED as an enum datum in the transaction that adds it. This file only
-- ADDs the value. 'executive' otherwise appears only in text comparisons —
-- a plpgsql text variable, a JWT claim string, and role::text lists (never an
-- enum literal). Assigning the role to a user happens separately afterward
-- (audited service-key write — the 0010 guard trigger blocks role changes
-- from any other context).

-- =============================================================================
-- 1. ENUM VALUE
-- =============================================================================

alter type user_role add value if not exists 'executive' after 'admin';

-- =============================================================================
-- 2. SCOPING FUNCTION — executive branch (baseline: 0014 version)
-- =============================================================================

-- executive: all active manager-role profiles org-wide ('executive' included
-- so an executive's own directly-managed employee rows stay visible). Unlike
-- the admin branch (every active profile), employee-role and inactive
-- profiles stay out. role::text keeps 'executive' a text comparison.
create or replace function visible_manager_ids()
returns setof uuid
language plpgsql security definer stable as $$
declare
  caller_id   uuid;
  caller_role text;
begin
  caller_id   := auth.uid();
  caller_role := (select role from profiles where id = caller_id);

  if caller_role = 'admin' then
    return query select id from profiles where is_active = true;
  elsif caller_role = 'executive' then
    return query select id from profiles
      where role::text in ('manager', 'senior_manager', 'admin', 'executive')
        and is_active = true;
  elsif caller_role = 'manager' then
    return next caller_id;
  elsif caller_role = 'senior_manager' then
    return query select id from profiles where manager_id = caller_id and is_active = true;
  end if;

  return;
end;
$$;

-- =============================================================================
-- 3. PROFILES VISIBILITY — executive reads manager profiles for the rollup
-- =============================================================================

create policy "profiles_select_executive" on profiles for select
  using (
    (auth.jwt()->'app_metadata'->>'role') = 'executive'
    and is_active = true
    and role::text in ('manager', 'senior_manager', 'admin', 'executive')
  );

-- =============================================================================
-- ROLLBACK:
-- -- Postgres cannot drop an enum value. First reassign any executive profiles
-- -- (service-key write — the 0010 guard trigger reverts role changes from any
-- -- other context), then:
-- drop policy if exists "profiles_select_executive" on profiles;
-- -- restore visible_manager_ids() to the 0014 version (no executive branch).
-- -- The orphaned enum value is harmless once no row and no function uses it.
-- =============================================================================
