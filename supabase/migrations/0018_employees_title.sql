-- 0018_employees_title.sql
-- Adds employees.title — job title mapped from Azure AD's jobTitle by the daily
-- graph sync (W2 release readiness — docs/release-plan.md, master-list "Role"
-- row). Renders under the employee name in the scorecard header today and
-- feeds the Cadence header in Phase 3.
--
-- Additive and nullable: null = title not known (Azure AD jobTitle unset or
-- the row predates the sync mapping). Existing rows backfill at the next
-- 05:00 UTC bootstrap after the code deploy.

alter table employees add column title text;

-- =============================================================================
-- ROLLBACK:
-- alter table employees drop column if exists title;
-- =============================================================================
