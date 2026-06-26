-- 0014_profiles_is_active.sql
-- Adds is_active boolean to profiles. Marks all admin accounts inactive except
-- james.oswald@hungerrush.com (the real admin). Updates visible_manager_ids()
-- and visible_employee_ids() to exclude inactive profiles so they disappear
-- from dashboards, rollup views, and all RLS-scoped queries.
--
-- Also adds an admin UPDATE policy on profiles (JWT-based, no recursion) so
-- the Profile Management UI can toggle is_active without the service key.

-- =============================================================================
-- COLUMN
-- =============================================================================

alter table profiles add column is_active boolean not null default true;

-- =============================================================================
-- SERVICE ACCOUNT CLEANUP
-- =============================================================================

update profiles
set is_active = false, updated_at = now()
where role = 'admin'
  and id != (
    select id from profiles where email = 'james.oswald@hungerrush.com'
  );

-- =============================================================================
-- SCOPING FUNCTIONS — filter out inactive profiles
-- =============================================================================

-- visible_manager_ids(): now excludes inactive profiles.
-- Admin case: returns only active profiles (not all).
-- Manager case: returns caller only if active.
-- Senior manager case: returns active managers under caller.
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
  elsif caller_role = 'manager' then
    return next caller_id;
  elsif caller_role = 'senior_manager' then
    return query select id from profiles where manager_id = caller_id and is_active = true;
  end if;

  return;
end;
$$;

-- visible_employee_ids(): delegates to visible_manager_ids() (unchanged logic,
-- but inherits the is_active filter from visible_manager_ids above).
create or replace function visible_employee_ids()
returns setof uuid
language plpgsql security definer stable as $$
begin
  return query select id from employees where manager_id in (select visible_manager_ids());
  return;
end;
$$;

-- =============================================================================
-- ADMIN POLICY — profiles UPDATE via JWT claims (no recursion)
-- =============================================================================

create policy "profiles_admin_update" on profiles for update
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- Admin also needs SELECT on all profiles to see the management page
create policy "profiles_admin_select" on profiles for select
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- =============================================================================
-- GRANTS
-- =============================================================================

grant all on profiles to service_role;

-- =============================================================================
-- ROLLBACK:
-- drop policy if exists "profiles_admin_select" on profiles;
-- drop policy if exists "profiles_admin_update" on profiles;
-- -- restore visible_manager_ids() to 0005 version (without is_active filter)
-- -- restore visible_employee_ids() to 0005 version
-- alter table profiles drop column if exists is_active;
-- =============================================================================
