-- 0020_employees_is_active.sql
-- Audit PR 3 (REVIEW.md Track 3.1 — ghost employees). The org sync inserts and
-- updates employee rows by email but never reconciles disappearances, so rows
-- for duplicated/disabled AD accounts live forever and silently show frozen
-- metrics. Additive flag only — rows are NEVER deleted (metric_snapshots FK +
-- the history rule): the sync flips is_active=false when an email is absent
-- from the current Graph member set, and back to true when it reappears.
-- The UI badges inactive people ("no longer synced") rather than hiding them.

alter table employees add column is_active boolean not null default true;

-- Existing rows: everyone starts active; the first org-sync run after the
-- paired code deploy performs the real reconciliation.

-- =============================================================================
-- ROLLBACK:
-- alter table employees drop column if exists is_active;
-- -- (drop column is normally forbidden by the never-drop rule; permitted here
-- --  only as the rollback of THIS migration before any dependent code ships.)
-- =============================================================================
