-- 0016_grant_metric_definitions_update.sql
-- S4 root cause fix (docs/refactor-plan.md): 0008 granted authenticated only SELECT on
-- metric_definitions; 0012 added the JWT-claims admin UPDATE policy but nobody added the
-- table-level GRANT. Postgres checks table privileges BEFORE row-level security, so every
-- browser save in the admin metric-config UI failed with 42501 while the policy itself was
-- correct. Pulled forward from Phase 2 into Phase 1C (release plan W1) so the
-- occupancy/schedule_adherence re-enable after commits 10+10b can run through the admin UI
-- and double as the end-to-end S4 verification. Row-level enforcement is unchanged: the
-- 0012 policy still only lets admin JWTs through.

grant update on metric_definitions to authenticated;

-- =============================================================================
-- ROLLBACK:
-- revoke update on metric_definitions from authenticated;
-- =============================================================================
