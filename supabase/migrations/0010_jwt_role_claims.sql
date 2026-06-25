-- 0010_jwt_role_claims.sql
-- Syncs profiles.role → auth.users.raw_app_meta_data so RLS policies
-- can use (auth.jwt()->'app_metadata'->>'role') instead of querying profiles.
-- This is the fix for the admin policy recursion from migrations 0004-0007.

-- =============================================================================
-- 1. GUARD: prevent non-service callers from changing their own role.
--    Without this, a user could promote themselves via the profiles_update_own
--    policy, and the sync trigger below would propagate it to their JWT.
-- =============================================================================

create or replace function guard_role_change()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.role is distinct from old.role then
    if current_setting('role') != 'service_role' then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

create trigger before_profile_role_change
  before update on public.profiles
  for each row
  execute function guard_role_change();

-- =============================================================================
-- 2. SYNC: after a profile is inserted or its role changes, copy the role
--    into auth.users.raw_app_meta_data. Supabase includes raw_app_meta_data
--    in the JWT as app_metadata, so RLS policies can read it without any
--    table query — no recursion possible.
-- =============================================================================

create or replace function sync_role_to_jwt()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update auth.users
  set raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', new.role::text)
  where id = new.id;
  return new;
end;
$$;

create trigger after_profile_role_change
  after insert or update of role on public.profiles
  for each row
  execute function sync_role_to_jwt();

-- =============================================================================
-- 3. BACKFILL: sync all existing profile roles into auth.users right now.
--    Uses JSONB || to merge the role key without clobbering other metadata.
-- =============================================================================

update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role::text)
from public.profiles p
where u.id = p.id;

-- =============================================================================
-- ROLLBACK:
-- drop trigger if exists before_profile_role_change on profiles;
-- drop trigger if exists after_profile_role_change on profiles;
-- drop function if exists guard_role_change();
-- drop function if exists sync_role_to_jwt();
-- update auth.users set raw_app_meta_data = raw_app_meta_data - 'role';
-- =============================================================================
