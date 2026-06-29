-- 0015_audit_log_admin_policies.sql
-- Re-add audit_log RLS policies using JWT claims instead of profile queries.
-- Original policies (0001) were dropped in 0007 due to recursive profile reads.
-- JWT-based approach avoids recursion — same pattern as 0012 and 0014.

create policy "audit_log_admin_select" on audit_log for select
  using ((auth.jwt()->'app_metadata'->>'role') = 'admin');

create policy "audit_log_admin_insert" on audit_log for insert
  with check ((auth.jwt()->'app_metadata'->>'role') = 'admin');

-- =============================================================================
-- ROLLBACK:
-- drop policy if exists "audit_log_admin_insert" on audit_log;
-- drop policy if exists "audit_log_admin_select" on audit_log;
-- =============================================================================
