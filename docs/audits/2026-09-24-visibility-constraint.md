# Visibility scope uniqueness

Migration `0013_visibility_scope_uniqueness` replaces the legacy unique index with a
`UNIQUE NULLS NOT DISTINCT` constraint over scope, manager, employee, metric, team, and line.
It requires PostgreSQL 15 or newer. PostgreSQL treats nulls as the same scope for uniqueness;
an empty string remains different from null. Application row locking remains in place.

The September 24 production census was read-only: PostgreSQL 18.6, 12 visibility rules,
zero duplicate scopes, and zero conflicting scopes. This is a point-in-time check; repeat
it immediately before any production migration. No production migration has been performed.

The isolated upgrade rehearsal starts at migration 0011 with synthetic stored metric data
and deliberate nullable-scope duplicates. Applying the upgrades refuses those duplicates
and rolls back, preserving both rows and the old index. After removing only the deliberately
duplicated fixture row, 0012 and 0013 apply successfully. The original visibility rule and
metric value survive; a subsequent null-scope duplicate is rejected, while an empty-string
line is accepted. Existing null correction, revision history, zero, failure-preservation,
and repeated-migration checks also pass. See `2026-09-24-staging-rehearsal.json`.

Deployment: apply with the normal transactional Drizzle migrator after the duplicate census
and backup/restore release gates. Do not execute the DROP INDEX statement separately.
If duplicates appear, the migration must fail; do not choose or delete a production rule
automatically. The table/index change needs a brief database lock. The current application
works with either constraint shape; the tightened constraint rejects unsafe direct writes.

Rollback, only if needed, replaces the constraint with the previous index in one transaction:

```sql
BEGIN;
ALTER TABLE metric_visibility_overrides DROP CONSTRAINT metric_visibility_overrides_unique_idx;
CREATE UNIQUE INDEX metric_visibility_overrides_unique_idx ON metric_visibility_overrides
  (scope, manager_user_id, target_employee_id, metric_definition_id, team_id, line);
COMMIT;
```

Rollback preserves rules but restores weaker null uniqueness. Reconcile migration tracking
with the deployment rollback plan rather than editing historical migration files. Hosted
staging upgrade and production rollout remain separate release steps.
