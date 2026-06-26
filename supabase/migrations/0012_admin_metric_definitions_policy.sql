-- 0012_admin_metric_definitions_policy.sql
-- Re-adds admin write policy for metric_definitions using JWT claims.
-- The original profile-based admin policy was dropped in 0007 (recursion).
-- Migration 0010 syncs profiles.role → auth.users.raw_app_meta_data,
-- so we can now check the role from the JWT without querying any table.

create policy "metric_definitions_admin_update" on metric_definitions for update
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- =============================================================================
-- ROLLBACK:
-- drop policy if exists "metric_definitions_admin_update" on metric_definitions;
-- =============================================================================
