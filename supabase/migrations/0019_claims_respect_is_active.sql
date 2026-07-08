-- 0019_claims_respect_is_active.sql
-- REVIEW.md Track 0.2 (audit PR 1). The 0010 trigger stamped profiles.role into
-- auth.users.raw_app_meta_data unconditionally, so an INACTIVE profile still
-- carried a live role claim — and the JWT-claims admin policies (0012/0014/0015)
-- plus the web role gates read exactly that claim. From this migration on, the
-- role claim exists only while the profile is active: deactivating a profile
-- strips it, reactivating re-stamps it.
--
-- Deliberately NOT touched: the profiles policies themselves (0004–0006
-- recursion history — see docs/refactor-plan.md) and the 0010 guard trigger.
-- NOTE: claims changes reach a signed-in user at their next token refresh
-- (≤1h) or sign-in, not instantly — existing-session survival after AD-disable
-- remains an IT-side empirical check (REVIEW.md open question 2).

create or replace function sync_role_to_jwt()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_active then
    update auth.users
    set raw_app_meta_data =
      coalesce(raw_app_meta_data, '{}'::jsonb)
      || jsonb_build_object('role', new.role::text)
    where id = new.id;
  else
    update auth.users
    set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
    where id = new.id;
  end if;
  return new;
end;
$$;

-- Re-point the trigger: 0010 fired on role changes only, so an is_active flip
-- alone never re-synced the claim. Now both columns fire it.
drop trigger if exists after_profile_role_change on public.profiles;
create trigger after_profile_role_change
  after insert or update of role, is_active on public.profiles
  for each row
  execute function sync_role_to_jwt();

-- Backfill both directions right now:
-- strip the claim from every inactive profile's auth user…
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) - 'role'
from public.profiles p
where u.id = p.id and p.is_active = false;

-- …and (idempotently) re-stamp active ones.
update auth.users u
set raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb)
  || jsonb_build_object('role', p.role::text)
from public.profiles p
where u.id = p.id and p.is_active = true;

-- =============================================================================
-- ROLLBACK:
-- -- restore the 0010 function body (unconditional stamp):
-- create or replace function sync_role_to_jwt()
-- returns trigger
-- language plpgsql security definer set search_path = '' as $$
-- begin
--   update auth.users
--   set raw_app_meta_data =
--     coalesce(raw_app_meta_data, '{}'::jsonb)
--     || jsonb_build_object('role', new.role::text)
--   where id = new.id;
--   return new;
-- end;
-- $$;
-- drop trigger if exists after_profile_role_change on public.profiles;
-- create trigger after_profile_role_change
--   after insert or update of role on public.profiles
--   for each row execute function sync_role_to_jwt();
-- update auth.users u
-- set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
--   || jsonb_build_object('role', p.role::text)
-- from public.profiles p where u.id = p.id;
-- =============================================================================
