-- 0002_indexes.sql
-- Foreign key indexes (Postgres doesn't auto-index FK columns) and query-pattern indexes.

-- employees: look up by manager
create index idx_employees_manager_id on employees(manager_id);

-- employees: look up by profile link
create index idx_employees_profile_id on employees(profile_id);

-- profiles: look up by manager (for senior_manager scoping in visible_employee_ids)
create index idx_profiles_manager_id on profiles(manager_id);

-- metric_snapshots: the main query pattern — employee + metric + period
-- (the unique constraint on (employee_id, metric_key, period_start) already creates an index,
--  but we add a covering index for the common sparkline query)
create index idx_metric_snapshots_employee_metric_period
  on metric_snapshots(employee_id, metric_key, period_start desc);

-- scorecard_sessions: look up by employee
create index idx_scorecard_sessions_employee_id on scorecard_sessions(employee_id);

-- scorecard_sessions: look up by manager
create index idx_scorecard_sessions_manager_id on scorecard_sessions(manager_id);

-- session_notes: look up by session
create index idx_session_notes_session_id on session_notes(session_id);

-- share_tokens: look up by token value (the unique constraint handles this, but explicit for clarity)
-- share_tokens.token already has a unique index from the unique constraint — skip.

-- share_tokens: look up by employee
create index idx_share_tokens_employee_id on share_tokens(employee_id);

-- share_tokens: look up by creator
create index idx_share_tokens_created_by on share_tokens(created_by);

-- audit_log: look up by actor and time
create index idx_audit_log_actor_id on audit_log(actor_id);
create index idx_audit_log_created_at on audit_log(created_at desc);

-- =============================================================================
-- ROLLBACK:
-- drop index if exists idx_audit_log_created_at;
-- drop index if exists idx_audit_log_actor_id;
-- drop index if exists idx_share_tokens_created_by;
-- drop index if exists idx_share_tokens_employee_id;
-- drop index if exists idx_session_notes_session_id;
-- drop index if exists idx_scorecard_sessions_manager_id;
-- drop index if exists idx_scorecard_sessions_employee_id;
-- drop index if exists idx_metric_snapshots_employee_metric_period;
-- drop index if exists idx_profiles_manager_id;
-- drop index if exists idx_employees_profile_id;
-- drop index if exists idx_employees_manager_id;
-- =============================================================================
