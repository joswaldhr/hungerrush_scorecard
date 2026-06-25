-- 0008_grant_table_permissions.sql
-- Table-level grants for authenticated users. RLS controls row-level access;
-- these grants just allow the roles to query the tables at all.

grant select on profiles to authenticated;
grant update on profiles to authenticated;

grant select on employees to authenticated;

grant select on metric_definitions to authenticated;

grant select on metric_snapshots to authenticated;

grant select, insert, update on scorecard_sessions to authenticated;

grant select, insert, update on session_notes to authenticated;

grant select, insert on share_tokens to authenticated;

grant select on audit_log to authenticated;

grant execute on function visible_manager_ids() to authenticated;
grant execute on function visible_employee_ids() to authenticated;
grant execute on function get_metric_history(uuid, text, int) to authenticated;

-- =============================================================================
-- ROLLBACK:
-- revoke all on all tables in schema public from authenticated;
-- revoke execute on function visible_manager_ids() from authenticated;
-- revoke execute on function visible_employee_ids() from authenticated;
-- revoke execute on function get_metric_history(uuid, text, int) from authenticated;
-- =============================================================================
