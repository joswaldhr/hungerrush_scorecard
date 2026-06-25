-- 0009_grant_service_role.sql
-- The service_role key bypasses RLS but still needs table-level grants.
-- Without these, the backend and seed scripts can't write to tables.

grant all on profiles to service_role;
grant all on employees to service_role;
grant all on metric_definitions to service_role;
grant all on metric_snapshots to service_role;
grant all on scorecard_sessions to service_role;
grant all on session_notes to service_role;
grant all on share_tokens to service_role;
grant all on audit_log to service_role;

grant execute on function visible_manager_ids() to service_role;
grant execute on function visible_employee_ids() to service_role;
grant execute on function get_metric_history(uuid, text, int) to service_role;

-- =============================================================================
-- ROLLBACK:
-- revoke all on all tables in schema public from service_role;
-- revoke execute on function visible_manager_ids() from service_role;
-- revoke execute on function visible_employee_ids() from service_role;
-- revoke execute on function get_metric_history(uuid, text, int) from service_role;
-- =============================================================================
