# Validation and release runbook

Current environment state and release blockers are owned by the
[implementation ledger](audits/2026-09-23-implementation-progress.md). This runbook does not
declare production ready or authorize bypassing those technical gates.

## Development checks

Use an isolated PostgreSQL database. Test configuration never loads `.env`; local overrides
must be loopback and end in `_test`. The existing local audit cluster uses port 55439.

```powershell
$env:TEST_DATABASE_URL = 'postgresql://cadence@127.0.0.1:55439/cadence_test'
pnpm typecheck
pnpm lint
pnpm test
```

Application changes also require a production build with the appropriate isolated build
configuration. GitHub CI uses PostgreSQL 18, applies migrations, runs the full checks and
builds with dummy sign-in configuration. Read-only documentation edits do not require a new
behavioral test. Never point integration tests, fixture resets or rehearsal writes at the
shared `.env` database.

## Preview and scheduler

The audit branch is `codex/audit-reliability-checkpoints`; `master` deploys production.
Preview uses its separate Railway database and Entra sign-in registration. Check the exact
commit/deployment before claiming hosted verification. Use synthetic rows for UI tests and
keep current/previous periods, null/zero and unauthorized cases distinct.

The [scheduler report](audits/2026-09-24-shadow-scheduler.md) owns service IDs, current
disablement and the hosted authentication evidence. `ACTION_SHADOW_SOURCE_ID` is unset.
The dedicated shadow token does not authenticate the normal publishing cron route. A passed
auth-only probe means no source work happened; it does not prove live ingestion or restart.
Do not reuse the revoked temporary share session. Durable recurring Preview authentication,
source binding, live restart, retention and human attribution remain activation work.

For a sync incident, inspect the source-scoped run outcome, last successful source observation,
lease/checkpoint state and sanitized errors. A 200 response, a recomputation timestamp, or an
old last-good value is not proof of current source success. Do not repeatedly launch whole
exports after rate limits or completeness failures. Resume the retained checkpoint or use
bounded diagnostics. Preserve aggregate failure evidence without raw IDs or employee payloads.

## Migration and recovery checks

`scripts/staging-rehearsal.ts` creates a disposable local database and rehearses upgrades and
null/zero correction behavior. `scripts/migrate-approved-staging.ts` is guarded to the exact
approved Preview endpoint and preserves existing rows while applying the additive migrations.
Neither is part of the normal build. `scripts/rehearse-production-restore.ts` performs a
read-only production snapshot and restores it into an isolated local PostgreSQL 18.6 instance;
inspect its explicit prerequisites and output path before running it.

The September 24 restore verified 32 tables / 28,878 rows and migration compatibility.
That is historical evidence, not today's backup. Recovery copies are outside the repository
under restricted local storage and encrypted with Windows DPAPI. They are bound to the local
Windows identity; portable recovery and provider point-in-time recovery are not yet proven.
Do not claim that a local restore also restores database roles, hosted service configuration,
vendor state or credentials.

## Production release and rollback

1. Complete the ledger's technical gates and verify the exact candidate commit's checks.
2. Refresh and verify a recoverable backup immediately before rollout. Record the previous
   production deployment, migration state, candidate commit and active feature flags.
3. Apply compatible migrations explicitly using the rehearsed procedure. Do not enable
   version-2 publication or historical replay merely because code has deployed.
4. Deploy the reviewed candidate, then verify sign-in, scope boundaries, representative
   scorecards/exports and source publication outcomes. Record actual production evidence.
5. If application rollback is needed, use the recorded compatible deployment. Preserve additive
   tables and revision evidence. Data rollback requires reviewed snapshots and a separate repair;
   restoring stale values can reintroduce the defect. Never blindly reverse null corrections.

Unresolved source meaning must remain unavailable in the product. A release containing
containment is not certification of historical totals. Keep production rollout, metric-version
activation and historical repair as distinct, evidenced operations.
