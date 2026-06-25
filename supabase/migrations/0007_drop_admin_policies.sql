-- 0007_drop_admin_policies.sql
-- Every admin policy contains: exists (select 1 from profiles ... and role = 'admin')
-- This triggers profiles RLS, and profiles_admin_all self-references profiles,
-- creating infinite recursion in any chain that touches profiles.
--
-- Phase 1 fix: drop all admin policies. Admin operations use the service key.
-- Phase 2 TODO: re-add using JWT claims — (auth.jwt()->'app_metadata'->>'role') = 'admin'
-- which reads from the token, not from any table.

drop policy if exists "profiles_admin_all" on profiles;
drop policy if exists "employees_admin_all" on employees;
drop policy if exists "metric_definitions_admin_all" on metric_definitions;
drop policy if exists "metric_snapshots_admin_insert" on metric_snapshots;
drop policy if exists "audit_log_admin_select" on audit_log;
drop policy if exists "audit_log_admin_insert" on audit_log;

-- =============================================================================
-- ROLLBACK:
-- create policy "profiles_admin_all" on profiles for all
--   using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- create policy "employees_admin_all" on employees for all
--   using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- create policy "metric_definitions_admin_all" on metric_definitions for all
--   using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- create policy "metric_snapshots_admin_insert" on metric_snapshots for insert
--   with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- create policy "audit_log_admin_select" on audit_log for select
--   using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- create policy "audit_log_admin_insert" on audit_log for insert
--   with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));
-- =============================================================================
