-- 0006_fix_profiles_rls_cycle.sql
-- Root cause: profiles_select_visible reads from the employees table:
--   using (id in (select manager_id from employees where id in (select visible_employee_ids())))
--
-- This creates a cross-table cycle:
--   employees RLS → visible_manager_ids() → profiles RLS → profiles_select_visible → employees → RECURSION
--
-- Fix: replace with a profiles-only policy. The manager hierarchy already lives
-- in profiles.manager_id, so a senior_manager can see their managers' profiles
-- via (manager_id = auth.uid()) without ever touching the employees table.

drop policy if exists "profiles_select_visible" on profiles;

create policy "profiles_select_managed" on profiles for select
  using (manager_id = auth.uid());

-- =============================================================================
-- ROLLBACK:
-- drop policy if exists "profiles_select_managed" on profiles;
-- create policy "profiles_select_visible" on profiles for select
--   using (id in (select manager_id from employees where id in (select visible_employee_ids())));
-- =============================================================================
