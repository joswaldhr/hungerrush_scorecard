-- 0003_profile_on_signup.sql
-- Auto-create a profile row when a new user signs up via SSO.
-- Role defaults to 'employee'; the Graph sync updates it to the correct role.

create or replace function handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    'employee'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- ROLLBACK:
-- drop trigger if exists on_auth_user_created on auth.users;
-- drop function if exists handle_new_user();
-- =============================================================================
