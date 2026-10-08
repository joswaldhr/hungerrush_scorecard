# Reporting readiness release

## Scope

PR56 candidate `a20b5028430eaa58a1be57ccaebd5f8ceca81b09` separates solved-report
recovery requests from the latest generic source activity in Data Health. Requests
are read-only, organization/account/source/team bound, and restricted to the
current planner's permitted periods. Duplicate, malformed or truncated evidence
does not become success. An expired lease becomes interrupted rather than running.
The manual sync endpoint is unchanged; its label now states its limited scope.

No metric values, formulas, targets, assignments, source configuration, schedules,
schema, credentials, disabled producers or demo behavior change. No effective-date
cutover or production canary publication is needed for this display-only change.

## Validation

- Local full suite: 1,236 tests / 153 files; typecheck and ESLint pass.
- Windows CRLF checkout fails the default whole-tree format check; the same check
  with automatic native line endings passes. Exact Linux CI uses the unmodified
  repository formatting check and passes.
- The local dependency junction is rejected by Turbopack's filesystem boundary;
  local webpack build passes. Standard production build passes in exact CI and
  isolated Preview, so no bundler/config workaround is shipped.
- Exact CI `37840660871` passes migrations, tests, source guards, lint/type and build.
- Exact Preview `dpl_GJN1LTC9eeswn5qkvWeQQmCFWRj4` is READY under the verified
  `codex/main-operational-upgrade` environment. The isolation gate passes before
  build; vendor/publication policies remain absent.
- Hosted synthetic component covers all eight queue states, separate retry timing,
  neutral completion, UTC attempt timestamps, light/dark themes, keyboard focus and
  contained horizontal scrolling at 390px. It is a generated fixture, not a new
  application route. The protected synthetic Data Health page renders the new
  source explanation and scoped manual-control description. No sync was clicked.
- Real PostgreSQL tests prove organization/team isolation, empty-assignment denial,
  account rebinding rejection, read-only behavior and exclusion of 101 obsolete
  period records. Hosted synthetic policies are intentionally absent, so the actual
  queue-to-page composition remains part of production read verification.

## Release and recovery

Fresh backup/restore receipt: `2026-10-08-readiness-restore.json` (must pass before merge).
Immediate compatible application rollback: `dpl_D4Ff1Txjjnqn2ue7KALjn8nLDgde`,
master `ba965977ac6ee4411a0650470876b69a68af01f6`. Keep the current production
environment and all 17 cron definitions unchanged. An application rollback needs no
database restore for this read-only change. Verify exact alias/SHA, sign-in and
authorized Data Health/scorecard reads after release; do not run extra syncs.

PR56 merged as `cbd8d5d2a367e2395bceb02f3652fc16e3106636`. Production
`dpl_BzXwfPfMHumJzDgowuhHdMZev6Pe` is READY and owns the live alias.
The 20:43 UTC encrypted backup restores all 35 tables / 389,060 rows with matching
digests; no existing application data changes during the isolated migration check.
All 23 production environment metadata entries and all 17 cron definitions match
the predecessor deployment. The login returns 200 and anonymous recovery returns
401. Authenticated administrator view-as Barbara displays only shared collection
and Menufy's two permitted reporting weeks, with completion and attempt times matching
the database receipt. The existing closed-week scorecard still loads. The generated
synthetic display correctly returns 404 in production. No sync control was invoked.
This is administrator preview evidence, not the manager's own sign-in acceptance.
Exact merged-master CI/build `37841640765` also passes.

## Independent findings

The current-week solved jobs are now complete. Aggregate retained-source and
platform invocation evidence is in `2026-10-08-recovery-current-week-verification.json`.
This does not certify the roster, other metric families or a full recurring day.

A manager-reported former team member still appears in the mapped Zendesk group,
both in today's Cadence observation and a fresh two-request read-only lookup. The
upstream account is active and unsuspended. Zendesk's `active` flag means not deleted;
it is not employment verification. No departure proposal exists. Correcting team
membership requires a dated reviewed override that survives rediscovery; employment
archival is a separate decision. No employee or vendor record was changed here.
