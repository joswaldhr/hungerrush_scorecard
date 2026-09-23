# Audit implementation — current checkpoint

This is the authoritative progress and release-checkpoint document for the September 23
overhaul. The audit is a historical baseline; HANDOFF.md links here for current status.
Last updated: 2026-09-23. **Local implementation validated; not deployed.**

## Current ledger

| Area | Status | Evidence / remaining work |
|---|---|---|
| Audit and metric contracts | Complete | Baseline at ab062c3; audit and contracts in this directory |
| Reporting context and scope safeguards | Implemented locally | Navigation, organization and manager-scope regression tests |
| Atomic sync publication and freshness | Implemented locally | PostgreSQL rollback tests; untouched periods preserved |
| Null corrections and predecessor evidence | Implemented locally | Migration 0012; corrected null/zero and retained revisions tested |
| Combined implementation validation | Passed | 223 tests, typecheck, lint, production build |
| Migration and corrected-sync rehearsal | Passed locally | Separate staging database; 0011 -> 0012; synthetic stored-data assertions |
| Hosted staging / production parity | Not ready | Vercel preview and production share DATABASE_URL; local PostgreSQL 16.14 vs pilot 18.6 |
| Production rollout / historical repair | Not performed | Release gate below must be completed first |

## Git checkpoints

Branch: `codex/audit-reliability-checkpoints`. No push or deployment performed.

- `ece704c`: audit, measured baseline, and metric contracts.
- `f39d872`: organization/manager scope safeguards and isolated test configuration.
- `1373db1`: scorecard reporting-context consistency and navigation regression tests.
- `429d7f0`: atomic publication, source freshness, null corrections, revision migration,
  and pipeline/reconciliation tests. Increments 2 and 3 are one coherent data-pipeline
  commit because their final code and migration are coupled.
- Process documentation and the staging rehearsal script follow as a separate commit.

The combined checkpoint was validated; this ledger does not claim each intermediate
commit received a separate full build. Keep future commits focused and record their
checks here. Do not push master as a staging shortcut: it is the production branch.

## Working process from this checkpoint

1. Select one bounded audit finding and state the intended behavior and acceptance check.
2. Implement it with relevant regression coverage; update this ledger and any owning
   architecture/metric document. Preserve source uncertainty explicitly.
3. Review the diff and tests, then create a focused commit before starting another increment.
4. For database changes, rehearse an upgrade against existing synthetic or approved
   sanitized data, capture before/after evidence, and document rollback and compatibility.
5. Stop at the release gate before hosted rollout or historical replay. Use the next-work
   entry here after a restart rather than reconstructing progress from older handoffs.

## Release gate and next work

**Next priority: establish hosted staging isolation before accumulating more major changes.**
Read-only Vercel inspection on September 23 found no custom staging environment, production
branch `master`, and one DATABASE_URL setting targeted to both preview and production.
A preview URL alone therefore does not establish a safe staging database. No secrets or
Vercel settings were changed. No code was pushed because a preview could inherit that database.

Local checkpoint is complete. Hosted release remains gated on:

- A separate staging database, ideally PostgreSQL 18.6 to match the observed pilot; scoped
  credentials and a verified preview-only connection setting, distinct from production.
- Staging-specific auth/callback configuration and synthetic identities; do not reuse
  production cron secrets, heartbeat destinations, or write-capable vendor workflows.
- Apply migration 0012 before deploying the new publisher; verify the release commit,
  migration state, UI null/zero display, authorization, and a controlled sync trigger.
- Record a recoverable production backup/restore point and deployment rollback reference
  before production approval. Code rollback retains the additive revision table; data
  reversal requires reviewed snapshots, not blindly republishing old numbers.
- Review staged results with the user before any production migration/deployment or
  historical replay. This is the requested deployment checkpoint, not a claim of readiness.

After staging isolation: verify Zendesk Search/Talk completeness and semantics, then prepare
an auditable, narrowly scoped historical repair for false freshness and stale null facts.
Other open risks include overlapping reporting calendars, historical targets/team context,
source coverage quality in the manager UI, out-of-order sync observations, leases, revision
retention, and an authorized revision-history viewer. See the audit for the full backlog.

## Repeatable local staging rehearsal

`scripts/staging-rehearsal.ts` requires an explicit loopback administration URL and never
loads .env. Each execution creates a uniquely named database, applies migrations through
0011, inserts a synthetic legacy value of 42, applies 0012, and runs the real publisher
with a synthetic connector. It asserts prior-row preservation, null correction, revision
history, confirmed zero, failed-sync preservation, and migration idempotency. It retains
the database for inspection and writes a credential-free report to
`2026-09-23-staging-rehearsal.json`. This is not a live-vendor or hosted-runtime check.

```powershell
$env:STAGING_ADMIN_DATABASE_URL = 'postgresql://cadence@127.0.0.1:55439/postgres'
pnpm exec tsx scripts/staging-rehearsal.ts
```

The local disposable cluster must be running first. Its data directory is
`$env:TEMP/cadence-audit-test-pg-20260923`; use a log file outside that directory to avoid
Windows file-sharing retries during crash recovery. The cluster is stopped after validation.
Latest result: PostgreSQL 16.14, migration 69 ms, 42 preserved before correction, then NULL
with three predecessor revisions, then confirmed 0; failed sync and repeated migration
preserved the last value. The JSON report records the retained database name and timestamp.

## Historical implementation notes

The sections below describe the individual increments as they were completed. Later
increments supersede earlier lists of pending items; the ledger above owns current status.


This working change implements the reporting-context and authorization containment portion of the September 23 audit. It does not claim the entire nine-phase overhaul is complete.

## Changes

- P0-05: period navigation renders values and exports only for the loaded requested week. Older responses cannot replace a newer selection. Missing query parameters restore the current week; invalid/impossible/future input is normalized consistently on client and server. Failure is retryable. Cache entries expire after one minute, are bounded to eight weeks, and window focus forces revalidation.
- P0-06: admin roster creation derives organization from the session; updates and related team/employee/metric/user/source references are scoped. Visibility deletion and roster mapping/candidate mutation predicates include ownership. New-hire and departure approval run in transactions, lock the candidate, and record the reviewer. Discovery derives connector type from the authorized source record.
- P0-07: a team filter intersects the caller's employee scope and applicable memberships. Organization checks also protect the domain boundary. Run lists, run detail, and the reconciliation page share scoped queries and recompute all counts from permitted employee results, including historical broad runs.
- Manager authorization excludes future assignments/memberships and filters teams/employees to the session organization.
- The test runner accepts an explicit loopback-only TEST_DATABASE_URL ending in _test. It never loads a developer's shared .env for tests.

## Validation environment

The installed PostgreSQL 16 binaries were used to create a separate disposable cluster under the operating system temporary directory, listening only on 127.0.0.1:55439, with database cadence_test. Existing Drizzle migrations were applied there. No migration or test writes were sent to the shared pilot database. PostgreSQL 18.6 production parity remains a separate release check.

PowerShell command for an already provisioned isolated test database:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://cadence@127.0.0.1:55439/cadence_test'
pnpm exec vitest run --maxWorkers=2
```

The URL above describes this local disposable trust-authenticated cluster; it is not a production credential. An override pointing to a remote host or a database without the _test suffix is rejected. Existing Docker/CI defaults remain compatible. If provisioning another instance, use its own test-only credentials.

## Regression cases

Browser-component tests cover loading/export exclusion, Back with an absent query parameter, out-of-order responses, failure/retry, cache expiration/focus refresh, and invalid dates. Database integration tests exercise foreign references for each admin resource, protected deletes/discovery/review, atomic concurrent approval, a one-employee team reconciliation, scoped historical aggregate counts, and future assignments.

## Remaining work and release boundaries

### Verification results

| Check | Result |
|---|---|
| Full isolated suite | 19 files, 207 tests passed. |
| Final authorization/navigation regression run | 42 tests passed, including the added same-day membership expiry test. The suite now contains 208 tests total. |
| Final admin compatibility rerun | All 14 admin-scope tests passed, including the existing Terminated employment-status option. |
| Typecheck | Passed after the final authorization boundary changes. |
| Lint/format | Passed; only the pre-existing unused transactionFn warning in run-sync.test.ts remains. |
| Production build | Passed; compilation 8.7 seconds and TypeScript 22.0 seconds. No deployment performed. |
| Browser | Current week Sep 20–26: 66 tickets; previous week Sep 13–19: 115. Previous showed a loading state with no prior rows/export, Back to the URL without a week restored 66/current dates, and Forward restored 115/prior dates. No browser errors were reported. |

Authorization treats effectiveFrom as inclusive and effectiveTo as exclusive: a membership
closed today must not continue granting access today. The reconciliation membership filter
uses the same end-boundary convention for overlap with the requested reporting interval.

The temporary verification app server was stopped after browser checks. The isolated test
cluster can be restarted with the installed PostgreSQL binaries and its existing temporary data
directory; it is independent of the shared pilot database and normal localhost:5432 service.

P0-01/02 source freshness/null corrections, P0-03/04 source contract/completeness, and P0-08 historical calendar/target semantics remain open. This increment does not rewrite historical values, change approved targets, trigger a production sync, or deploy code. Those data changes need the versioned publication and migration/reconciliation work in the roadmap; passing these tests must not be represented as certification of current source metrics.

No schema migration is introduced by this increment. Deployment rollback is an application rollback, but reverting the authorization or period fixes would reintroduce the audited risks. Keep the audit baseline immutable and add new evidence rather than editing it into a claim of repaired production data.

## Increment 2 — atomic metric publication (2026-09-23)

Implemented locally after the request to keep going. No deployment, vendor sync,
production migration, or historical repair was performed.

- `runSync` now commits source records, normalized facts, affected metric values,
  the completed run checkpoint, and source last-success timestamp in one transaction.
  Fetch or publication failures preserve the previous committed dataset and report
  zero published rows. A source from another organization is rejected before run creation.
- Metric computation requires an explicit source/run/connection scope. It writes only
  employee-period groups affected by changed records in that run, while including
  unchanged contributing facts from that source in each affected aggregate. Other
  weeks retain their numeric values, calculation timestamps, and freshness metadata.
- Freshness is the earliest source observation among numeric contributors, conservatively
  separated from calculation time. Provenance includes source, run, and fact IDs;
  calculationVersion follows the definition version. `latest` ordering is explicit by
  observation timestamp, then fact ID, instead of relying on unspecified row order.
- Manual sync failures return HTTP 503. Cron reports failure and withholds its healthy
  heartbeat when any source fails or is skipped, or when there are no sources. Roster
  discovery runs only after successful publication. The CLI shares the same publication path.
- Exhausting the orchestration page limit fails the fetch. Single-week mode still
  intentionally consumes one connector week; this does not validate vendor-internal
  Search/Talk pagination or completeness.

Validation: 21 test files / 218 tests passed in the isolated loopback PostgreSQL test
cluster (33.03 seconds). New database tests assert actual stored output (12 -> 13 when
one contributor changes, untouched prior week remains 9, freshness remains the original
source timestamp), unchanged-payload idempotency, fetch-failure preservation, and rollback
of source/facts/values/checkpoint after a database trigger forces metric publication to
fail. Five route tests cover failure statuses, skipped/absent sources, and heartbeat gating.
TypeScript passed. Production build and final lint results are recorded below.

No schema migration or backfill is required for this increment. Rollback is a code rollback,
though returning to the old publisher would reintroduce false freshness and non-atomic writes.
The removed unscoped computation API requires callers to use `runSync`; all repository
callers have been updated. Existing historical freshness remains incorrect until a separately
validated repair. Deployed cron execution and real vendor output remain unverified for this
change; local tests are not a substitute for that rollout check.

Still open: null corrections and omitted facts, unchanged-hash reprocessing after mapping or
normalizer changes, correction revision history, historical calendar overlap, source coverage
quality, vendor semantics, and sync concurrency leases. The existing ingest fallback still
cannot recover within an aborted PostgreSQL transaction; the enclosing publisher now fails
closed instead of reporting a partially successful run. Null correction work was deliberately
separated from this increment because replacing old values needs explicit retained evidence.

Final increment-2 checks: `pnpm exec tsc --noEmit`, `pnpm lint` (ESLint plus Prettier),
and `pnpm build` all passed. Build compilation took 9.6 seconds and build TypeScript
checking took 6.6 seconds. The isolated test cluster was stopped after validation.

## Increment 3 — auditable null corrections (2026-09-23)

Scope: correction publication, not a historical backfill or vendor-definition change.

- New `sync_revisions` table retains the prior source record, normalized fact, and metric
  value before a sync replaces each row. The snapshot includes the prior payload/value,
  observation and calculation timestamps, and available provenance. The correction's
  sync run links the revisions to its source and organization. Snapshot writes use the
  same transaction as publication; a failed correction leaves neither changed rows nor
  misleading revision records. No revision browsing endpoint is exposed.
- A normalized fact omitted by a corrected source record is retained with null values
  and a correction reason. Explicit null facts and omitted facts both reach the affected
  metric group. All-null groups overwrite obsolete numeric values with NULL and quality
  `missing`. Numeric aggregates still ignore null contributions and mark mixed groups
  `partial`; genuine zero remains zero. This quality flag describes stored contributors,
  not verified completeness of the external source.
- The shared aggregation helper and reconciliation now retain a latest null observation
  rather than resurrecting an older non-null observation. Ordering uses source observation
  time and fact ID. Other numeric formulas are unchanged; this fixes missing-data semantics
  within the existing definition version. Prior rows are retained, and only changed records
  are processed by ordinary syncs. Effective rollout date is the eventual deployment date,
  not the date this local change was written.
- `reprocessUnchanged: true` is an explicit internal runSync option for a reviewed replay;
  it is not enabled by the manual or cron routes. It allows repairing the audited case
  where a corrected payload is already stored but obsolete facts survived hash skipping.
  No shared-database replay has been run. An entirely absent source record is not treated
  as a deletion: that requires a verified complete source inventory.
- Publication locks the source row during its transaction, keeping concurrent same-source
  revision snapshots consistent. This does not prevent redundant network fetches or solve
  out-of-order upstream observations; job leases remain separate work.
- Employee/period reattribution of an existing fact fails publication with an explicit
  repair-required error. Moving both old and new groups needs a reviewed reassignment
  operation. The invalid per-row fallback inside an aborted PostgreSQL transaction was
  removed; ingestion errors now abort the publication directly.

### Migration and rollout

Migration: `drizzle/0012_cool_wasp.sql`, generated snapshot and journal included. Creates one
empty table, two indexes, and a foreign key to sync_runs. Apply this additive migration
before deploying the new publisher. Old code can coexist with the table. No backfill or
application downtime is expected; allow a short lock window for the foreign key DDL.
Execution should take seconds at this schema size, but production timing is unmeasured.
The migration was applied to the disposable local PostgreSQL database only and survives
restart. Validate table/index/FK creation and correction rollback before rollout.

Rollback: revert application code and retain the additive table and revision evidence.
Do not drop it or restore old metric values blindly: replaying prior values could revive
known errors. Any data reversal needs a reviewed source/run/employee/period selection and
comparison of current rows to the snapshots. Revision retention is currently indefinite;
it contains source payloads and employee identifiers, so use the same restricted database
access and backup policy as source_records. No public API, automatic pruning, or broader
permissions are introduced. Retention limits and a scoped administrative history viewer
remain follow-up work. The run foreign key prevents deleting referenced runs accidentally.

### Validation evidence

PostgreSQL fixtures exercise 13 -> NULL (`missing`) -> 0 (`partial` while another
contributor is missing), omitted-fact retraction, and explicit replay of an unchanged
payload whose obsolete fact/value is 88. Assertions inspect the retained prior value,
source snapshots, fact snapshots, and rollback of revision rows on a forced metric-write
failure. Tests also reject period reattribution and confirm latest-null behavior in the
shared reconciliation helper. No live source sync, production migration, or repair ran.
The PC restarted during final verification; results below refer to the resumed checks.

Final resumed validation: 21 files / 223 tests passed (149.69 seconds), including the
PostgreSQL correction and rollback cases. TypeScript, ESLint/Prettier, and production
build passed; build compilation took 27.7 seconds and build TypeScript 14.2 seconds.
Migration re-check after the PC restart succeeded. No production rollout was performed.

Process checkpoint validation: the repeatable local staging rehearsal passed, including
upgrade of an existing synthetic dataset and corrected publication. No application code
changed while organizing these commits; the 223-test application checkpoint remains the
last full suite. The rehearsal script was formatted and separately typechecked/linted.
