-- 0005_fix_rls_recursion_v2.sql
-- Root cause: PostgreSQL's RLS recursion guard fires before SECURITY DEFINER
-- bypass takes effect. Any function called from an employees RLS policy that
-- reads the employees table triggers "infinite recursion detected."
--
-- Fix: split into two functions:
--   visible_manager_ids()  — reads ONLY profiles (safe to call from employees RLS)
--   visible_employee_ids() — reads employees via visible_manager_ids() (safe for
--                            other tables' RLS since the employees policy no longer
--                            calls visible_employee_ids())
--
-- The employees policy now uses visible_manager_ids() directly.

-- Step 1: new helper that derives visibility from profiles only
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
    return query select id from profiles;
  elsif caller_role = 'manager' then
    return next caller_id;
  elsif caller_role = 'senior_manager' then
    return query select id from profiles where manager_id = caller_id;
  end if;

  return;
end;
$$;

-- Step 2: rewrite visible_employee_ids() to delegate to visible_manager_ids()
-- Still used by metric_snapshots, scorecard_sessions, session_notes, share_tokens
create or replace function visible_employee_ids()
returns setof uuid
language plpgsql security definer stable as $$
begin
  return query select id from employees where manager_id in (select visible_manager_ids());
  return;
end;
$$;

-- Step 3: replace employees SELECT policy — uses visible_manager_ids(), not visible_employee_ids()
drop policy if exists "employees_select_visible" on employees;
create policy "employees_select_visible" on employees for select
  using (manager_id in (select visible_manager_ids()));

-- =============================================================================
-- ROLLBACK:
-- drop policy if exists "employees_select_visible" on employees;
-- create policy "employees_select_visible" on employees for select
--   using (id in (select visible_employee_ids()));
-- drop function if exists visible_manager_ids();
-- -- then re-run 0004 to restore visible_employee_ids() to its 0004 version
-- =============================================================================
