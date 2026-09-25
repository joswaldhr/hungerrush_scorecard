# Audit implementation — current checkpoint

This is the authoritative progress and release-checkpoint document for the September 23
overhaul. The audit is a historical baseline; HANDOFF.md links here for current status.
Last updated: 2026-09-25 (20:22 UTC). **Core, metric-display and roster corrections are deployed. Both-week CSAT source-ticket sets match for Menufy and POS. Menufy inbound sets match 1,927 named legs across both weeks; POS matches 2,012 legs for one week. The replacement CSAT candidate passes 118 offline cases, repeated Menufy source parity and live POS collection for all 39 active identities. Adapter CI passes 628 tests / 73 files. The staff census matches all 62 active employees; explicit policy and per-team selection are implemented. Hosted staging is migrated through 0015 and synthetic CSAT publication passes. Neither migration 0015 nor replacement collection is active in production. Binding/cutover, hosted and release gates remain unfinished: 0/40 newly certified assignments. Human metrics, recurring shadow/v2 publication and historical repair remain disabled.**

## Hosted CSAT qualification — September 25, 20:22 UTC

Commit `0881ac0` passed CI 36184492751 / 36184488065: 647 tests / 79 files,
PostgreSQL migrations, lint, TypeScript and build. Preview deployment
`dpl_4ZHp9Zg8Czx8NoaW9jnWzQUL9f4a` is READY. Hosted staging upgraded through 0015,
preserving all 21,262 rows across 32 application tables.

The fresh read-only production backup at 20:15 UTC restored all 39,798 rows across 33
tables with exact digests. Widening the restored copy through 0015 preserved application
data. Production schema and configuration remain unchanged.

The first synthetic attempt stopped at an outdated one-organization fixture guard; the
script now selects the named synthetic organization and leaves the separate disabled shadow
organization untouched. The next attempt exposed a real publisher integration defect:
normalization always received a null team, so valid team-bound CSAT snapshots were rejected.
The transaction rolled back. The fix resolves and locks active employee/team rows during
publication; missing identities and changed teams reject the batch. The PostgreSQL regression
now exercises a non-null team through the actual publisher, plus missing and reassigned
identities. All 28 focused pipeline tests pass, including the extended 18 publication cases.

The fixed hosted synthetic rehearsal passed replacement, precise 100/3 storage, version 2,
legacy revision retention, zero-write identical replay, explicit null correction and final
fixture restoration. Preview displays 33.3% / 75.0%, America/Chicago, version 2 and the
unverified-target explanation. Hosted history also shows the corrected values and retained 99% legacy predecessor, precise-contract predecessors and null corrections. Actual hosted CSV bytes were downloaded and inspected: 2,309 bytes, UTF-8 BOM, six rows, correct displayed percentages/context and unavailable human counts. PDF/PNG byte verification remains separate. No vendor
requests or production writes were used for the hosted publication rehearsal.

## Bounded CSAT invocation — September 25, 20:15 UTC

The complete two-team read-only rehearsal finished in 146.427 seconds using 152 GETs:
62 active employees, 85 normalized facts, and zero differences against independent
calculations or retained prior observations. See `2026-09-25-combined-csat-runtime.json`.
Policy/staff increment `d2809ca` passed both CI runs 36181714899 / 36181709051
(634 tests / 75 files, migrations, lint, TypeScript and build).

The dedicated one-week route now uses a global 240-request / 240-second fetch budget,
strict account endpoint checks and no automatic retries. Legacy collection skips CSAT
only for policy-owned teams and periods, including manual refreshes. Publication rejects
employee/team changes during collection and source account-binding changes. Missing
identities, ambiguous assignments, foreign organizations and partial fetches fail closed.
Sixty-three targeted cases across nine files, TypeScript and focused ESLint pass.
No policy or new cron schedule is configured. Production remains unchanged.

Migration operators now include 0015 with bounded lock/statement waits. Exact backup
restore comparison remains byte-representation strict; migration comparisons normalize
only the widening numeric cast. Hosted migration/publication/export inspection and a
fresh production restore rehearsal remain release gates, not completed checks.

## CSAT adapter checkpoint — September 25, 19:30 UTC

**19:45 UTC continuation:** adapter commit `f9840fd` passed CI 36180161226 / 36180157579
(628 tests / 73 files, migrations, lint, TypeScript and build). Live POS collection now
qualifies all 39 active identities and exactly matches all 105 closed-week rated tickets.
The repeated Menufy observation covers all 23 active identities and retains the exact
4,357-ticket report cohort with no source changes. A four-request staff census matches all
62 active employees. The prospective source/team policy parser, explicit per-team metric
selection and frozen replacement calculation version pass 24 targeted tests; staff census
guards pass three tests. See `2026-09-25-csat-rollout-plan.md`: measured runtime requires a
separate bounded CSAT invocation, not sequential addition to the existing 195–235-second
sync. Production configuration, schema and cron entries remain unchanged.

Source-contract context now also includes a canonical account/agent/group/brand fingerprint.
The adapter retains minimal source fields, numerator/denominator ticket sets and explicit
nulls. Actual normalizer + PostgreSQL publication replaces a legacy score, keeps its revision,
preserves a repeating fraction, skips an identical replay and retracts an empty correction.
Forty-two targeted cases, TypeScript and focused ESLint pass. A private offline replay matches
all 23 retained live cases / 46 facts / 4,357 cohort tickets, without source requests or DB writes.

The previous context/precision increment passed CI 36179269877 / 36179265357 at `7572eb8`
(623 tests / 72 files, migration, lint, TypeScript and build). Its local formatting issue was
corrected. Current adapter CI follows. The production fetch path, source data and schema remain
unchanged; see `2026-09-25-csat-release-candidate.md` for the remaining activation gates.

## CSAT publication safeguards — September 25, 19:20 UTC

The latest prior candidate commit `8f68d0e` passed CI 36177033773 and 36177028398.
This next increment preserves explicit source-contract/timezone context in facts, published
values, scorecards, historical snapshots, retained revisions and exports. Incompatible
contributors roll back atomically; comparison values and existing targets are withheld when
their definitions are not compatible or qualified. Legacy observations retain their own
meaning. A CSAT snapshot cannot be combined with a second percentage summary.

PostgreSQL exposed float4 precision loss (`100/3` became `33.333332`). Migration 0015 widens
only `normalized_facts.numeric_value` and `metric_values.numeric_value`; the new CSAT contract
also avoids legacy two-decimal storage rounding. The isolated local 0014 -> 0015 migration
succeeded on empty metric tables. A separate populated temporary-table test runs the actual
migration SQL and preserves six prior values per table, then verifies a new one-third value.
No production schema or source configuration changed. Existing lost precision is not repaired.

The database integration set passes 34 tests, including publication rollback, comparisons,
history, revisions and the populated precision migration. Source-context/description cases
passed eight tests. Updated browser-component/export checks pass fifteen tests. TypeScript
passed; full lint is running at this checkpoint. Production requires a fresh backup/restore, publication coordination and bounded
lock waits before this table rewrite. Retain the widened columns for application rollback.
The remaining candidate gates are in `2026-09-25-csat-release-candidate.md`; raw source sets
and employee mappings remain private. Hosted Cadence export-file bytes remain unverified.

## Current ledger

| Area | Status | Evidence / remaining work |
|---|---|---|
| Audit and metric contracts | Complete | Baseline at ab062c3; audit and contracts in this directory |
| Reporting context and scope safeguards | Published to production | Navigation, organization and manager-scope regression tests; production current/previous week and history checks passed |
| Atomic sync publication and freshness | All four scheduled metric publications passed; roster correction deployed | Offsets 0/1/2/3 published 192/1,067/1,080/1,074 values with zero metric errors and exact reporting intervals; no running rows remain. Offsets 1–3 returned 200. Offset 0 returned 503 after publication; PR25 corrects overlapping-line roster discovery. Corrected scheduled roster execution remains unverified; see 2026-09-25-scheduled-sync-verification.md |
| Null corrections and predecessor evidence | Staging verified | Migration 0012; corrected null/zero and retained revisions tested |
| Combined implementation validation | Roster correction candidate and master CI passed | PR25: 581 tests / 66 files, PostgreSQL 18 migrations, lint, TypeScript and production build; candidate CI 36106916272/36106921476 and master CI 36107218863 passed |
| Migration and corrected-sync rehearsal | Passed locally and hosted | Local 0011 -> 0014; hosted staging upgraded through 0014 with all prior rows preserved |
| Hosted staging / production parity | Database, core UI, worker authentication and bounded ingestion/recovery passed | Separate PostgreSQL 18.6 and Entra app; four fresh ingestion processes, expired-lease takeover and replay verified; source disabled after rehearsal; recurring scheduling remains open |
| Zendesk completeness | Safety guards and human-only shadow policy implemented | 2,415-ticket export reconciled; Talk boundary verified; retained full-week census reproduced one default lookup omission, resolved by inactive/deleted-inclusive diagnostic; historical eligibility, human provenance and independent parity remain open |
| Production rollout / historical repair | Core, metric-display and roster corrections deployed; no historical repair | PR25 merged at 467c2fa, production dpl_5MWPNsFU8DRv2zzKg7TgAi1noGE1 READY; fresh backup restored 33 tables / 32,796 rows exactly |

## Git checkpoints

Branch: `codex/audit-reliability-checkpoints` published to origin. Automatic Preview deployment was enabled after credential isolation and staging sign-in setup. PR22/24/25 are merged; current application release is `467c2fa`. The dated sections below retain their original historical status.

- `ece704c`: audit, measured baseline, and metric contracts.
- `f39d872`: organization/manager scope safeguards and isolated test configuration.
- `1373db1`: scorecard reporting-context consistency and navigation regression tests.
- `429d7f0`: atomic publication, source freshness, null corrections, revision migration,
  and pipeline/reconciliation tests. Increments 2 and 3 are one coherent data-pipeline
  commit because their final code and migration are coupled.
- `4adcdee`: process documentation, release gate, and isolated staging rehearsal.

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
5. Continue autonomously under the user's September 24 authorization; do not request another
   routine checkpoint approval. Complete the technical release gates before production
   rollout or historical replay. Use this ledger after a restart rather than older handoffs.

The user subsequently reaffirmed full execution permission in direct response to the
staging scheduler access gate. That pending setup is authorized; do not ask for it again.
The dedicated token is saved only in this branch's Preview settings and the Railway
scheduler, plus the audit-branch-restricted GitHub staging environment. Auth-only rehearsals
passed; see the scheduler report for evidence and cleanup.

On September 24 the user set Monday, September 28 as the required usable date and clarified
that they do not work Saturday/Sunday. Friday, September 25 is therefore the handoff target.
Prioritize the core release over further optional audit expansion; do not imply that this
target guarantees resolution of vendor attribution evidence.

## Release gate and next work

**September 25 follow-on request: investigate and correct all POS/Menufy Zendesk metrics.**
The user asked for a deep investigation and an accuracy plan after scheduled verification.
See `2026-09-25-zendesk-metric-accuracy-plan.md` for the complete assigned-metric matrix,
manager-report discovery, independent event/leg reconciliation and publication gates.
The user supplied manager identities privately as report-discovery starting points and
does not know the report names. This expands the prior core-release scope into metric
correctness; it does not certify the current meanings or activate shadow/v2/historical repair.
The user authorized execution. Live findings, the aggregate census and the 23-key /
40-assignment acceptance ledger are now recorded in `2026-09-25-zendesk-live-findings.md`,
`2026-09-25-metric-accuracy-census.json` and `2026-09-25-metric-acceptance-ledger.md`.
The subsequent plan review added a 90-minute first execution checkpoint, independent
source-population and calculation checks, evidence-specific historical qualification,
independently releasable correction batches, and progress that does not count unavailable
metrics as completed. Code review confirmed the existing reconciliation tool compares
normalized facts to published values and defaults to 5% tolerance for non-count metrics;
it cannot serve as the independent accuracy certificate. A separate offline reference now
calculates creation-cohort first reply and solved-date CSAT from minimal private snapshots,
with no connector/normalizer imports or database/vendor writes. Ten focused tests,
TypeScript, focused ESLint and formatting passed. Live GETs reproduced stored first-reply arithmetic but exposed a
last-update filter excluding 133 prior-week created tickets in the incident sample. A
separate solved-date census with the exact report groups matched one visible CSAT row;
Central time gives 12 surveyed tickets where UTC gives 13. This is sample numeric parity,
not full ticket-set/team/two-week qualification. No new production formulas are published.

The next investigation increment expanded Menufy CSAT to all 23 report rows and both closed
weeks: 46 exact good/bad/surveyed count and displayed-percentage matches. It caught a
diagnostic search omission of 44 ratings with comments; the corrected 4,315-ticket census
matches the expanded source count and has complete metric-set coverage. One incident
employee/week also matches all 12 exact surveyed ticket IDs from Explore decomposition.
The report covers 19 active employees; the other four have verified zero current-assignee
solved tickets in the padded interval. Full-population ticket-set parity and production
qualification remain open. See `2026-09-25-menufy-csat-parity.json`. Both first-increment CI
runs for 37aa246 passed; draft PR27 contains the diagnostic work, not a production rollout.

POS CSAT now has 64 exact good/bad row-week matches (34 and 30 rows), using 226 unique
rated tickets with complete metric sets. The saved Last Week report actually uses the last
30 days; comparisons used unsaved corrected weekly ranges and were discarded. Its 20-group
scope includes five deleted groups; continuation parameters had to be preserved to obtain a
complete group inventory. Three active POS identities have verified zero rated-ticket counts.
The rated-only diagnostic does not claim a survey denominator or response rate. Both CI runs
for bff1258 passed. Production formulas remain unchanged; call attribution is next.

**Next priority: Friday, September 25 release handoff for Monday, September 28 use.**
The user is unavailable Saturday and Sunday. Do not plan user participation on those days.
Freeze optional enhancements and prioritize release blockers and core workflow verification.
See `2026-09-25-release-plan.md` for acceptance checks and deferred work. Zendesk attribution
research remains a metric-activation gate, not an excuse to expand the containment release.
Hosted staging isolation,
separate Entra sign-in, migrations through 0014, and synthetic null/zero UI checks are complete.
Automatic Preview deployment is enabled for the audit branch. See the dated hosted reports
and latest entries below; earlier isolation checkpoints are historical.

Remaining activation and operating checks:

- Hosted worker authentication, controlled ingestion, fresh-process checkpoint resumption and
  simulated expired-lease takeover passed on September 24. Complete recurring scheduling,
  retention and operational monitoring before ongoing activation.
- Complete Zendesk completeness work and review metric semantics before historical repair.
- The core rollout used a fresh validated September 24 production backup and recorded the
  previous deployment. Production migrations through 0014 preserved application data.
  Refresh this evidence before a later rollout. Portable recovery/provider PITR remain open.
  Code rollback retains the additive revision table; data reversal requires reviewed snapshots.
- Preserve reviewable staged results and a concrete rollback plan before production changes.
  The user authorized continued execution on September 24; routine checkpoint approval is
  no longer a gate. Missing access or unresolved business semantics still cannot be guessed.
- All four scheduled metric publications were observed September 25; offset 3 ran on PR25.
  A scheduled execution of its corrected current-week roster path remains unverified.
  Complete hosted export-file byte inspection when browser download access is available;
  neither metric publication nor export-content tests establish downloaded file bytes.

Stored reporting intervals, observation ordering, sync leases, and atomic reconciliation
claims now have regression coverage. Remaining risks include historical targets/team context,
independent source reconciliation, worst-case fetch budgets/resumability, revision retention,
historical context reconstruction, recurring failure alerting and scheduled roster confirmation. Visibility uniqueness is
now enforced in production. See the
audit for the full backlog; these safeguards do not complete the entire overhaul.

## Repeatable local staging rehearsal

`scripts/staging-rehearsal.ts` requires an explicit loopback administration URL and never
loads .env. Each execution creates a uniquely named database, applies migrations through
0011, inserts a synthetic legacy value of 42, applies migrations through 0014, and runs the real publisher
with a synthetic connector. It asserts prior-row preservation, null correction, revision
history, confirmed zero, failed-sync preservation, and migration idempotency. It retains
the database for inspection and writes a credential-free report to
`2026-09-24-staging-rehearsal.json`. The original September 23 report is retained. This is
not a live-vendor or hosted-runtime check. The new rehearsal also verifies that duplicate
nullable visibility scopes abort the upgrade without losing rows or the old index.

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

The September 24 run upgrades through 0013 in 127 ms after the deliberate duplicate-refusal
check, preserves existing visibility data, and rejects direct duplicate null scopes while
allowing an empty-string line. Hosted staging currently remains at 0012.

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


## Hosted staging setup - access checkpoint

Railway provisioning access was checked after the request to continue. No Railway CLI,
local Railway configuration, environment token, or connected provisioning tool is available.
The Railway dashboard in the Codex browser requires sign-in. The sign-in tab is left open
for the user; do not copy passwords or tokens into this document. Existing Vercel API
access is available, but cannot provision a Railway database by itself.

Once signed in, inspect the existing project and create an empty staging environment with
only a separate PostgreSQL service. Do not duplicate production services, credentials, or
live data. Verify the actual PostgreSQL version and incremental service cost before any
paid upgrade or new subscription. Use synthetic fixtures initially.

Bind the staging database to the `codex/audit-reliability-checkpoints` branch's Preview
DATABASE_URL setting. Preserve Production settings. Use staging-specific auth and a
synthetic connector/controlled trigger; a branch-specific database alone does not isolate
inherited vendor credentials or heartbeat destinations. Inventory and isolate those
settings before pushing or deploying. Apply migrations, load synthetic data, verify the
branch deployment and stored correction results, and record evidence here before the
production approval checkpoint.

Provider references checked September 23:
[Railway environments](https://docs.railway.com/environments) documents empty environments;
[Vercel environment scoping](https://vercel.com/docs/environment-variables/manage-across-environments)
documents branch-specific preview variables. No hosted resource or Vercel setting has
been changed at this access checkpoint.


### Hosted staging environment created; database budget pending

The user signed into Railway. Verified project `overflowing-radiance` contains
`hungerrush_scorecard` and its production PostgreSQL service, using
`ghcr.io/railwayapp-templates/postgres-ssl:18`. Created **Empty Environment**
`cadence-staging` (no copied services or variables), environment ID
`4e86528b-7329-4d73-a651-9f0fb3d07755`, in project
`16252abf-3f91-44f8-a7b4-0d430bbc8834`. Creation was confirmed in the dashboard.
This supersedes the sign-in blocker above. Production resources were not modified.

The database has NOT been created or deployed. Provisioning introduces metered Railway
usage, so a $10/month staging budget was requested before committing that cost. This is
an operational budget, not a verified per-service billing cap. Do not apply a workspace
hard limit that could stop production. No approval has been received at this checkpoint.

A fresh Vercel variable inventory also confirmed Preview inherits Zendesk credentials,
Graph application credentials, Microsoft sign-in credentials, and AUTH_SECRET in addition
to DATABASE_URL. CRON_SECRET is production-only. Preview isolation must cover these
inherited credentials before deployment, not just the database. No Vercel changes or
code pushes have been made.

Cost reference: [Railway usage pricing](https://docs.railway.com/pricing/understanding-your-bill).


### Hosted staging database provisioned and Preview secret scoped

The user approved the $10/month operational staging budget, then explicitly approved
password-protected public database access and saving the credential in this branch's
Vercel Preview settings. These approvals supersede the pending-budget checkpoint above.
The budget is not a provider-enforced spending cap.

Created PostgreSQL service `Postgres-B35O`
(`f6a324de-5ae5-4e13-a9cc-84a3feb37cf9`) in `cadence-staging`, using the PostgreSQL 18
SSL image. Configured a 1 vCPU / 1 GB maximum and idle sleep. Public networking and the
DATABASE_PUBLIC_URL variable were deployed successfully. No production data was copied.
The public endpoint accepted a TCP connection and PostgreSQL SSL negotiation; this is
not yet an authenticated database connection or certificate-validation test.

Published `codex/audit-reliability-checkpoints` after commit `de6e624` disabled automatic
Vercel deployments for this exact branch in vercel.json. Vercel refused branch-scoped
variables until the branch existed in GitHub. Saving DATABASE_URL then succeeded as a
Sensitive secret scoped exclusively to Preview and this branch. A read-only Vercel API
inventory verified that scope and the separate pre-existing production/preview entry.
The latest deployment inventory still contained only master deployments. No production
settings were edited and no audit preview was deployed.

Railway CLI authorization was declined because it requested broader persistent account
permissions; the existing browser session sufficed. No CLI credential was granted.
No credentials are stored in this ledger or committed files.

Remaining before enabling this branch's deployment: isolate inherited vendor/Graph and
auth settings, apply hosted staging migrations, run synthetic stored-data assertions,
and verify the Preview deployment and authentication. DATABASE_URL configuration alone
is not evidence that the application can connect. Keep the branch deployment hold until
these prerequisites are met. The last full application suite remains 223 passing tests;
this checkpoint changes deployment configuration only.


### Hosted database rehearsal passed; staging sign-in pending

Executed the actual publisher against the new Railway staging database on PostgreSQL
18.6. The script accepts hosted operation only with the exact approved environment ID,
host, port, and database; it rejects any existing user tables before creating fixtures.
The original loopback-only local administration mode remains available. No production
connection string or vendor credentials were used. Temporary local input stayed in
process memory and was discarded when validation completed.

Evidence: `2026-09-23-hosted-staging-rehearsal.json`. Migration 0011 -> 0012 took 1,273 ms
and preserved the synthetic legacy value 42. Correcting it to null produced missing
quality and three revision snapshots, including prior metric value 42. A subsequent
zero remained zero with source freshness preserved; an injected fetch failure left the
published row unchanged. Re-running migrations preserved it too. The error log for the
synthetic outage is an expected assertion, not a failed rehearsal.

Both the rehearsal and branch DATABASE_URL require TLS (`sslmode=require`). This encrypts
transport using Railway's self-signed certificate; it does not verify the server identity
against a trusted certificate authority. Certificate trust configuration remains a
separate hardening item, not a completed claim.

Vercel now has branch-specific overrides for every inherited Preview key. Vendor,
Graph, legacy Supabase/API, and Microsoft sign-in values are blank; AUTH_SECRET and
CRON_SECRET are independently generated Sensitive secrets; SYNC_HEARTBEAT_URL is blank.
Production/global entries were verified unchanged during isolation. DATABASE_URL remains
a Sensitive secret scoped only to this branch and Preview. Optional blank environment
values now parse as unset, while required keys still fail validation and the production
SSO guard remains in place.

The user was unsure whether a staging Entra registration exists. Portal sign-in is now
complete. Owned applications showed only Support Scorecards; searching all registrations
for score returned that app, and cadence returned zero results. Prepared the new-app form
with name HungerRush Cadence Staging and Single tenant only - HungerRush. Registration
has NOT been submitted. Requested approval for registration, the form's Microsoft Platform
Policies acceptance, and saving the new staging sign-in credential only to this branch's
Vercel Preview settings. This is a new access/terms approval, separate from the approved
Railway database setup. Do not enable the branch deployment until staging registration,
callback, and synthetic user mapping are configured. Full Preview runtime, UI null/zero rendering, and sign-in checks
remain unperformed. No production migration, deployment, or historical repair ran.

Validation for this increment: five focused environment tests passed, including the
production SSO startup guard with empty overrides. Targeted ESLint/Prettier and TypeScript
checks passed. A non-approved hosted endpoint was rejected before connecting. The last
full application suite remains the prior 223-test checkpoint; it was not rerun here.

Commits: `a58dab5` records hosted rehearsal; `f73d3cd` isolates empty Preview overrides.
Both are pushed to the audit branch. After pushing, the latest Vercel deployments still
showed only master; the audit branch deployment hold is intact.


### Staging sign-in and hosted Preview validated

User approved the prepared registration and setup. Created `HungerRush Cadence Staging`,
single-tenant HungerRush, client ID `12229084-a38a-4d21-8987-e6743ef616ec`, object ID
`613f32f6-68e0-4762-b277-3c669b564387`. Created a 180-day client credential and saved it
as a Sensitive secret exclusively for the audit branch's Vercel Preview. Updated the
matching branch client ID and tenant issuer. Production registration and settings were
not changed. Registered the exact HTTPS Web callback below; implicit token flows were
left disabled.

Preview alias:
https://hungerrush-scorecard-git-code-20e6ca-water-hungerrush-scorecard.vercel.app
Callback path: `/api/auth/callback/microsoft-entra-id`.

Removed the temporary branch deployment hold in `eb119cf`. Vercel deployment
`dpl_5eScpueKJ9dgHCZPogMQq2xsxpu8` became READY at full commit
`eb119cfb5834dfbec01f6b2864daa9ad920d9900` with target Preview (not production).
Microsoft sign-in and consent completed and returned to the hosted 1:1s page.

The guarded `scripts/staging-preview-fixture.ts` added one non-admin manager mapping for
the user's signed-in work account, one synthetic team, and zero/missing metrics to the
existing synthetic rehearsal organization. It refuses any other host/environment or a
populated user mapping and runs its changes in one transaction. The application showed
only the assigned Synthetic employee, zero as 0.0, and null as an em dash with No Data.
Previous-week navigation loaded Sep 13-19 and changed comparison labels to Sep 6-12.
Accessing /admin as this non-admin manager redirected to /one-on-ones.

Evidence: `2026-09-23-hosted-preview-validation.json`. Direct unauthenticated HTTP was
intercepted by Vercel deployment protection (302 to its SSO endpoint). Attempting to open
the cron endpoint in the browser was blocked by the browser client. Therefore hosted
cron authorization/trigger behavior is NOT claimed verified; the prior local route tests
and hosted synthetic publisher rehearsal remain the evidence for those layers. No live
vendor calls, production migrations, production deployments, or historical repairs ran.

Fixture execution, targeted ESLint, and typecheck passed. No application source changed
in this step; Vercel's actual Preview build succeeded. The broader audit remains open,
including source completeness and the production release gate above.


## Zendesk Search completeness guard — September 23

Replaced silent Search truncation with a complete-cohort guard shared by the weekly ticket
query and current backlog query. Counts over 1,000, changing counts, repeated/invalid IDs,
missing results, empty nonterminal pages, and pagination loops now throw before publication.
Exactly 1,000 unique results with a stable reported total are accepted without requesting
an inaccessible page 11. Vendor request failures propagate. The existing atomic publisher
preserves published facts and successful freshness when connector fetching fails.

This deliberately trades availability for correctness: an oversized employee cohort fails
that sync attempt instead of publishing partial values for everyone. Search Export or a
validated partitioning strategy remains necessary to ingest larger cohorts. Stable counts
and unique IDs detect these failures but do not prove a point-in-time snapshot while the
vendor search index is changing. No metric formula, target band, or historical data changed.

Validation: 10 focused pagination tests, project typecheck, focused ESLint, and diff whitespace
checks passed. No live vendor calls, production writes, or historical replay performed.
Talk modified-since pagination, creation-window filtering, stable-ID deduplication, exhaustion
rules, and first-answering-agent versus per-agent metric semantics remain open. Talk-specific
vendor documentation uses count/next_page semantics that differ from Support incremental
exports; resolve that contract before substituting an assumed end-of-stream rule.

Vendor reference: https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/


## Zendesk Talk completeness guard — September 23

Removed the unsafe created-after-week early stop and the successful return after the
50-page budget. Talk now follows modified-since pagination until an explicitly empty
response, validates each page count, and throws for missing/stalled continuation or budget
exhaustion. It deduplicates stable call IDs using the latest updated_at, rejects conflicting
equal-time versions and malformed IDs/timestamps, and filters the final cohort to both UTC
creation boundaries. The exclusive upper boundary includes fractional seconds at week end.
No Support-only end_of_stream assumption remains.

Validation: 13 Talk fixtures plus the 10 Search fixtures pass, covering old-created/newly
modified calls, pages entirely beyond the reporting week, repeated and revised calls,
empty exports, page limits, loops, missing continuations, inconsistent counts, malformed
records, conflicting corrections, and request failures. Project typecheck and focused
ESLint passed. No live vendor requests, production writes, or historical replay performed.

This is a conservative safety checkpoint, not completed live completeness acceptance.
Talk's documented next_page remains a URL at exhaustion; the count property is documented
but a short-page threshold is not explicit. Requiring count=0 may fail exports that repeat
a nonempty boundary forever. Such failures now preserve existing published data instead
of accepting an unproven cohort. Verify live cursor metadata/ID totals and implement a
scalable export/checkpoint strategy before production release; 50 requests plus rate-limit
backoff can still exceed hosting limits. Existing sync observation ordering and lease risks
also remain open. Whole-call durations and first-answering-agent attribution are unchanged;
this does not establish per-agent offers, acceptance events, or handling effort.

Reference: https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/


## Vendor-verified pagination follow-up — September 23

This supersedes the conservative Search-cap and empty-only Talk termination checkpoints.
A read-only live Talk probe returned 320 calls followed by the identical final call, cursor,
and end_time twice, with no end_of_stream. The collector now accepts that repeated boundary
only when every call is identical to a retained version and the cursor and watermark are
unchanged; new/conflicting records, regressing watermarks, loops, and budgets still fail.
This verifies the observed terminal shape, not every historical call/agent metric.
Metadata-only evidence is in `2026-09-23-talk-cursor-probe.json`.

Ticket searches now use Search Export cursor pagination with `filter[type]=ticket`, preserving
the assignee/date/status query criteria. Explicit has_more=false completes an export. This
removes the offset API's 1,000-ticket limit; the safety budget of 100 pages (10,000 tickets
at the requested page size) fails rather than truncates. Duplicate IDs, broken continuation,
missing completion metadata, and vendor failures remain errors. The exporter has a lower
100 requests/minute account limit; existing bounded concurrency and 429 handling apply.
Read-only response shape and reconciliation evidence is recorded in
`2026-09-23-search-export-probe.json`. No application sync or production writes were run.

Validation: 24 focused Search/Talk fixtures passed, including a 1,200-ticket export and the
observed repeated Talk boundary. Live data was held in memory; reports contain aggregate
metadata and an ID-set digest only, not ticket/call contents or credentials.


## Overlapping sync observation ordering — September 23

Successful sync metadata now records the source-record keys observed, including unchanged
payloads. While holding the existing source publication lock, a run rejects publication
when a completed later-started run already observed any overlapping key. Different weeks
remain independent. Superseded runs fail without replacing source records, facts, values,
revisions, or the last-success checkpoint. This is a conservative run-start ordering guard,
not proof of vendor snapshot isolation or a lease that avoids duplicate network work.
Existing pre-change runs lack this metadata; deploy with old in-flight invocations drained.

Validation: all 18 orchestration/PostgreSQL publication tests passed, including delayed-old
fetches after both changed and unchanged newer results and concurrent disjoint weeks.
Typecheck and focused ESLint passed. The preceding export increment also passed typecheck
and focused ESLint; live Search reconciliation matched 2,415 unique IDs to counts before
and after across 25 export pages. No production publication or historical repair occurred.


## Zendesk credential destination guard — September 23

Vendor pagination links now must resolve to the configured HTTPS Zendesk origin and
/api/v2/ path, with no embedded credentials or fragments. Fetch redirects are rejected.
Seven focused tests cover foreign hosts, HTTP downgrade, path escape, embedded credentials,
and valid relative/absolute API requests. This prevents pagination data from widening the
authorization destination. Typecheck and focused lint passed.


## Overall status evidence — September 23

Empty scorecards now show No Data. Available data without evaluable targets shows No Target.
Mixed missing/available values or any incomplete quality status shows neutral Partial Data,
rather than an overall performance judgment. Confirmed zero remains valid data. Individual
metric comparisons remain visible. Briefing text and distributions preserve these distinct
states instead of treating them as successful performance. This does not yet resolve the
separate in-progress-week judgment or historical membership/calendar issues.

Validation: all 273 tests across 26 files passed against the isolated local database,
including 11 new status fixtures. Project typecheck, full lint/format checks, and production
build passed. No production deployment was performed. HANDOFF's stale shared-Preview warning
was corrected to point to the established isolated staging configuration.


## Effective configuration dates and target ambiguity — September 23

Scorecard queries now select definitions, assignments, and targets effective at the reporting
period start, using inclusive effectiveFrom and exclusive effectiveTo (the membership
convention already used by the app). Conflicting equal-precedence target rules produce
No Target rather than choosing whichever row the database returned first. Identical
rules still resolve normally. Existing target values, including Menufy ranges, are unchanged.

Validation: 42 focused query/target tests passed, including PostgreSQL cases for future and
expired targets and out-of-interval definitions/assignments; typecheck and focused lint passed.
Historical employee line/team snapshots, role mapping, period identity/legacy interval access,
and versioned configuration edits remain open. This increment does not claim to reconstruct
historical context that the database never retained.

Hosted Preview eceade63e8b0c4cb028da6efa6053b06a13b9ec7 is READY
(deployment dpl_6xM84u7neHJcZeQw2Y9y9of49bgK). Authenticated browser verification showed
neutral Partial Data overall, confirmed zero 0.0, No Target for the zero metric, and No Data
for the missing metric. Production remains on ab062c33f70e2152b8786f6a8ade5a7e0ab96697.


## In-progress reporting context — September 23

For a current UTC reporting interval with sufficient data and targets, the overall status
is now neutral In Progress. Individual target comparisons retain their approved values,
with a visible provisional/full-week explanation included in the capture area and exported
period label. Missing/partial data and missing targets still take precedence over a period
status. Completed periods retain the existing performance assessment. Briefing descriptions
and distributions carry the same distinction. No target bands or calculations changed.

Validation: 41 focused status/navigation/briefing tests, typecheck, and focused ESLint passed.


## Durable sync claims and dead-job recovery — September 23

Run creation now takes the source row lock and atomically checks a durable source/week lease
stored in sync_runs metadata before fetching. A whole-source run conflicts with every week;
different week scopes can proceed independently. Busy attempts are recorded as skipped and
return an unsuccessful result without vendor calls. Database time controls a ten-minute
expiry (longer than the hosted 300-second invocation limit). The owner renews between
connector pages and must renew again under the publication lock before writing values.
The next claim for that source marks expired running jobs failed with a lease_expired error;
a returning expired owner cannot publish. No schema migration is required.

Limitations: recovery is on the next source attempt, not an independent scheduled reaper.
An individual fetch taking longer than ten minutes fails renewal; resumable ingestion is
still needed for workloads that cannot fit the hosting budget. Existing legacy running
rows use started_at plus ten minutes until replaced by a leased run. Drain old deployed
workers at rollout because they do not enforce the lease protocol.

Validation: 20 focused orchestration/PostgreSQL tests passed, including concurrent claims,
whole-source versus single-week conflict, independent weeks, expiry takeover, and stale
owner rejection. All 280 tests across 27 files then passed; full lint, typecheck, production
build, and a fresh local 0011->0012 synthetic upgrade/replay rehearsal passed.

A read-only current-week Talk export completed in six requests / 15.97 seconds: 4,700 raw
rows, 4,694 unique calls, six boundary/revision duplicates, and 73 calls created outside
the week excluded, leaving 4,621 weekly calls. No rate-limit waiting occurred. This verifies
one observed export, not independent per-agent metric semantics or a worst-case runtime SLA.
See `2026-09-23-talk-week-probe.json`. No live sync, production write, or historical repair ran.


## Export snapshot context — September 23

CSV now includes employee, explicit current/comparison dates and UTC, source observation,
quality, calculation version, and target scope for each metric. Spreadsheet formula-like
text is escaped. Text exports carry the same context. PDF/PNG capture now freezes a DOM
copy before asynchronous library loading, includes employee/reporting headers and data
details, and disposes the temporary copy afterward; navigation cannot replace the pending
export's rows. UI and exports now use the same status labels. No target-row ID or immutable
historical target snapshot is claimed: only the resolved scope is currently available.

Validation: nine export/navigation tests, typecheck, and focused ESLint passed. Tests cover
historical dates, zero versus missing, CSV quoting/formula text, capture identity and data
details, disposal, and navigation after capture. Hosted visual export verification follows.


Export follow-up: all 283 tests, full lint, typecheck, and production build passed at 5b7ff45.
The hosted PNG was downloaded and visually inspected: employee header, both dated periods
with UTC, provisional-period note, confirmed zero, missing value, and source-quality/version
details rendered legibly with no clipping. The temporary export clone is hidden from the
accessibility tree to avoid duplicate announcements while rendering. Synthetic output:
`C:/Users/JamesOswald/Downloads/synthetic-employee-scorecard-2026-09-23.png`.


## Exact count reconciliation — September 23

Count-valued metrics now require exact equality during internal reconciliation. A one-ticket
or one-call difference cannot be classified as a match merely because it is below the general
percentage tolerance. Other value types retain their configured tolerance. The reconciliation
page describes this distinction and still identifies the comparison as stored-source-fact
consistency, not an independent vendor audit. Twenty-one focused tests, typecheck, and focused
lint passed. Independent event/agent ledgers and versioned non-count tolerances remain open.


## Source evidence for version-1 calculations — September 23

Zendesk summary payloads now retain sorted ticket/call/rating IDs and unrounded numerators
and denominators for time averages and CSAT. Evidence names explicitly identify the current
assignee/last-updated ticket cohort and first-answering-agent whole-call attribution. The
existing normalization formulas, metric keys, and target bands are unchanged. First future
publication will record the added evidence as a source-payload revision; past evidence is
not reconstructed automatically. Null sample sets remain distinct from confirmed zero, and
invalid numeric observations fail instead of publishing NaN.

Ratings now reject duplicate/invalid IDs and cyclic/excessive pagination rather than inflate
CSAT counts or loop indefinitely. Five focused real-connector fixtures passed, including
ID/denominator preservation, unchanged normalized values, missing/zero samples, duplicate
ratings, and cyclic pagination; typecheck passed. Payload retention/storage growth still
needs an operational policy. The business-definition question remains pending with the user.


## Employee backup payload retention — September 23

Six tracked raw JSON backup files were removed from the current repository tree after
creating a Windows DPAPI CurrentUser encrypted archive and verifying each decrypted byte
stream against its SHA-256. The already-pseudonymized audit baseline was also archived as
an additional precaution; its repository copy contains no email or UUID patterns and remains
available for audit evidence. New `/backups/` output is ignored to prevent routine recommits.
No application source imports the removed backup payloads.

Archive: `C:/Users/JamesOswald/.codex/private-backups/cadence/20260923-171945`.
The local manifest records original paths, sizes, hashes, and commit; RESTORE.txt describes
recovery. All seven archived files passed round-trip verification. DPAPI requires this
Windows user profile/key material: this is local confidential recovery storage, not a
portable disaster-recovery backup or verified production restore point. Git history remains
unchanged and still contains older copies; repository access review and coordinated history/
retention cleanup remain release work. No external transfer or credential rotation occurred.


## Connector identity source scope — September 23

Numeric Zendesk identity resolution now filters the Cadence identity lookup by data-source
ID as well as external email. Matching email addresses in different source instances cannot
resolve to the other instance's employee. A real PostgreSQL regression creates two
organizations/sources with the same synthetic email and verifies both resolve correctly.
The test, typecheck, and focused lint passed. Source-evidence focused lint also passed.


## Stored historical reporting intervals — September 23

The scorecard now links to a read-only stored-period view. It selects exact start/end
intervals, preserves overlapping reporting calendars separately, and enforces both employee
and organization scope. The normal weekly query also matches both dates so a shorter
interval sharing a start date cannot replace the intended week's value. Stored history
shows values, recorded quality, observation time, and calculation version without applying
current targets or claiming reconstructed historical employee context.

Validation: all 292 tests across 30 files passed against the isolated local test database;
the production build passed. Two new PostgreSQL cases verify overlapping intervals, regular
weekly selection, invalid selections, and access controls. A concurrent fixture collision
in preliminary runs was resolved by rerunning sequentially; those failed runs are not
counted as validation. Full ESLint passed; Prettier found one pre-existing new identity-test
formatting issue, corrected before commit. Hosted verification follows.


## Database error confidentiality — September 23

Fault-injection tests demonstrated that serializing a Drizzle error exposed SQL parameters
in operational logs, and its message could also be stored in sync_errors. Database failures
now produce a generic message and validated SQLSTATE code, retaining the surrounding sync
run identifier without SQL, row values, driver details, or nested causes. Ordinary Error
reasons remain available for diagnosis. This is database-error containment, not a blanket
redaction policy for arbitrary application messages or historical log deletion.

Validation: 22 focused logger, orchestration, and PostgreSQL publication tests passed. The
real synthetic database failure now logs only DatabaseError / P0001; a Drizzle regression
asserts private fixture content is absent from logs and the persisted-message formatter.
Typecheck and focused ESLint passed.


## Reconciliation cooldown claims — September 23

Reconciliation now locks its organization row and checks the cooldown with the database
clock in the same transaction that creates the run. Simultaneous requests cannot both pass
the earlier HTTP preflight check and start duplicate work. Losing requests return HTTP 429.
The five-minute policy is unchanged; this is an atomic start claim, not a resumable worker
or an expired-run recovery mechanism. No schema migration is required.

Validation: 19 focused PostgreSQL/access-scope/rate-limit tests, typecheck, and focused lint
passed. The new concurrency case starts two requests together, observes one successful run
and one rate-limit rejection, and verifies a later run succeeds after the cooldown.

Hosted history verification at 39db808 passed: the page showed confirmed zero separately
from missing data, retained observation/version details, and selecting September 13–19
changed both the URL and displayed interval. The desktop screenshot was legible without
clipping. No production data changed.


## Visibility save concurrency and combined validation — September 23

Visibility saves now lock the parent metric and perform their read/write in one transaction.
Concurrent application requests for the same nullable scope create one rule; an existing
duplicate set fails for review rather than choosing an arbitrary row. Organization scope
is rechecked while acquiring the lock. Empty-string line values are matched distinctly
from null. Direct database writers remain subject to the legacy nullable unique index; a
duplicate census and nulls-not-distinct database migration remain separate follow-up work.

Validation: all 296 tests across 32 files passed, including the concurrent nullable-scope
save regression, access boundaries, reconciliation claims, and sanitized database failures.
Full ESLint, Prettier, TypeScript (production build), and production build passed. No
production migration, deployment, historical replay, or business-formula change occurred.

## Action-metric version 2 shadow implementation — September 23 (September 24 UTC)

Following the user's continuation instruction, work proceeds in the recommended direction:
new event/agent-leg contracts with existing history and targets preserved. Added ticket-event
export validation and actor-based distinct-ticket projection, plus minimal agent-leg export
and leg-grain completion/missed/declined evidence. They remain outside the active connector.
See `2026-09-23-action-metric-v2-contract.md` for exact counting and unresolved attribution.

Eight new synthetic regression cases passed alongside all 15 existing Talk cases. They cover
actor attribution, repeated resolution deduplication, unknown prior state, incomplete
coverage, conflicting events, pagination failures, transfers, missing/zero durations, and
unknown leg statuses. Typecheck passed. A read-only source probe processed 657 events and
69 legs; all three sampled resolutions matched the separate ticket-audit endpoint. Reports
contain aggregate counts only. No application values or target bands were changed.

Closed-day follow-up: September 23 UTC returned 11,954 events (13 pages) and 2,530 legs
(four pages), including 14 missed, one declined, and one unreachable eligible-agent leg.
All three sampled resolution audits matched. Identity/audit verification brought the total
to 39 requests; one rate-limit retry waited 46 seconds. Persistent export checkpoints and
source-specific employee/automation attribution remain prerequisites for activation.
All 304 tests across 34 files, full lint/format, TypeScript, and production build passed.

## Resumable ticket-event ingestion — September 23

Added a database-backed shadow checkpoint using separate existing source-record namespaces.
Each invocation fetches one page; events and cursor commit together, stale competing fetches
cannot rewind progress, and conflicting history aborts before advancement. Source ownership
is enforced. Incomplete intervals remain unavailable; reads do not initialize checkpoints.
Zendesk's opt-in deferred retry mode persists a 429 retry window instead of sleeping inside
a hosted request. Existing connector retry behavior and all metric publications are unchanged.

Focused PostgreSQL checks passed for restart after failure, concurrent workers, conflicting
events, provider lag, organization boundaries, persisted retry deadlines, and forced
checkpoint-write rollback. All 313 tests across 35 files, full lint/format, TypeScript, and
production build passed. This does not activate a
scheduler or cover resumable call-leg ingestion, retention, or employee/service-account
attribution. The existing read-only vendor probe still performs no database writes.

## Resumable call-leg ingestion — September 24

Added a separate call-leg checkpoint with atomic page/cursor writes, stale-worker rejection,
persisted rate-limit deferral, and the verified Talk exhaustion boundary. Every observed
version is retained in a revision namespace; the latest timestamp determines the current
leg and same-time conflicts fail. Inserts/upserts are batched. Only closed intervals older
than two minutes are accepted, avoiding a frozen incomplete current-period cohort.

Six new PostgreSQL cases plus all eight ticket-checkpoint cases passed; TypeScript passed.
The cases cover revision retention, older late arrivals, contradictory revisions, source
scope, retries, concurrent workers, open intervals, and stalled boundaries. The active
publisher is unchanged. Worker scheduling and actor attribution follow this increment.

## Bounded action worker and live local restart rehearsal — September 24

The authenticated shadow route requires an explicit source opt-in and runs at most six page
attempts per request. Ticket and leg streams resume independently; an unfinished pair is
not skipped across midnight. Completed days catch up in order after downtime. The worker
does not publish metrics or update source success timestamps. No hosted activation occurred.
Vercel's team API confirms Hobby, which supports only daily cron jobs; a frequent schedule
requires a supported separate scheduler. No paid plan changes were made.

All 325 tests across 38 files, typecheck, full lint/format, and production build passed.
`scripts/rehearse-action-worker.ts` separately exercised real read-only Zendesk requests
with writes restricted to a loopback `_test` database. It loads only Zendesk keys from .env.
Three independent process invocations resumed 0 -> 3 -> 7 -> 13 ticket pages and 0 -> 3 -> 5
leg pages, ending with 11,954 ticket events and 2,532 legs. A fourth invocation made zero
vendor requests and retained those counts. All four reports confirm zero normalized facts
and unchanged source-success timestamps. Reports contain aggregate evidence only.

The earlier source probe had 2,530 legs. These observations occurred at different times;
the two-record difference is not proof of an ingestion error or independent reconciliation.
An explicit correction/re-observation policy is required before activation. Scheduler
ownership, hosted trigger/restart, source binding, immutable employee attribution,
automation classification, retention, and monitoring remain open.

## Source identity verification — September 24

Added a strict exact-email identity observer and read-only aggregate census. It rejects
ambiguous accounts, incomplete search pagination, and contradictory observations, and strips
unrelated personal fields. Four focused regressions, TypeScript, formatting, and focused
ESLint passed. The preceding worker checkpoint (d3f7854) is READY on Vercel Preview.

The live read-only check covered all 97 Zendesk mappings: 73 exact matches, 24 missing,
zero ambiguous matches, and zero duplicate numeric IDs. All 62 currently active Cadence
employees matched active, unsuspended agent/admin accounts. Current mappings have no stored
verification timestamps or numeric IDs. No identity rows or metric values were modified.
`2026-09-24-action-identity-census.json` and `2026-09-24-action-identity-verification.json`
retain aggregate results; account identifiers and email addresses are omitted.

This verifies current matching, not historical roles, human account ownership, or manual
action attribution. Immutable mapping observations and an explicit late-correction policy
remain the next implementation work before enabling version-2 calculations.

## Shadow scheduler ownership — September 24

The shadow route now claims a source-level lease before selecting or fetching work. A
simultaneous trigger reports busy with a retry timestamp and makes no vendor requests.
Database time controls six-minute expiry (longer than the hosted invocation budget), and
token-conditional release prevents a crashed owner's cleanup from deleting a replacement
lease. Errors release the current lease while retaining export checkpoints. No schema
migration is required; production and Preview ingestion remain disabled.

Seven focused route/PostgreSQL cases, TypeScript, formatting, and focused lint passed.
Checks demonstrated one concurrent owner, expiry recovery, stale-owner release rejection,
cross-organization rejection, busy-route short-circuiting, and release after worker failure.
This protects route invocations; direct calls to page primitives still need coordination.

## Immutable re-observation and correction comparison — September 24

An explicit observation UUID now creates a separate ticket/leg export for an existing
interval. Retry resumes that observation; completed originals remain immutable. Daily
catch-up excludes these records. Internal comparisons require both exports to be complete
and list additions/removals/changes without publishing anything. Partial observations
remain unavailable; no missing record is silently treated as a deletion or zero.

All 18 focused checkpoint/worker PostgreSQL tests, typecheck, formatting, and focused lint
passed. The new regression demonstrates unchanged original evidence, unavailable partial
comparison, exact added/removed/changed IDs, idempotent completion, invalid-ID rejection,
and independence from daily scheduling. A live read-only Zendesk re-observation used four
processes with local-only writes and a persisted rate-limit delay. Its final comparison
matched 11,954 events and 2,532 legs exactly with zero differences and zero normalized facts.

## Frozen identity evidence — September 24

Added immutable source-scoped identity snapshots with explicit current observation times.
Failures, ambiguous shared account IDs, changed mappings, and wrong-organization access
save no partial snapshot. Concurrent captures produce one retained winner. Reusing an
observation does not refetch, so roster changes cannot silently alter past evidence.
Historical eligibility and human activity attribution remain explicitly unknown.

Five PostgreSQL regressions and a three-account live-source rehearsal passed. Production
mapping reads ran in a read-only transaction; writes were limited to synthetic loopback
fixtures. All three exact matches survived a simulated roster change and retry used no
vendor requests. Sample email fixture rows were removed; reports contain aggregates only.
All 339 tests across 41 files, full lint/format, TypeScript, and production build passed.
This capture primitive remains offline; it is not yet a scheduled identity refresh or a
manager-facing metric calculation. The automation-versus-manual metric definition has
been asked as a business clarification while independent infrastructure work continues.

## Railway staging scheduler — September 24

Deployed a dependency-free hourly function in the existing staging environment, with no
public domain and no restart loop. The platform's Run now test completed and logged disabled;
no vendor or worker requests ran. Its hardcoded staging destination, redirect rejection,
timeout, strict response handling, and dedicated shadow-only credential have regression
coverage. An explicit auth-only probe supports testing while ingestion remains disabled.
See `2026-09-24-shadow-scheduler.md` for service/deployment IDs and activation requirements.

Full application validation before this increment passed 339 tests across 41 files.
Scheduler and route focused tests passed; production build and TypeScript passed. No
scheduler credential has been provisioned. Browser policy requires confirmation before
granting the scheduler new access; this is a specific access gate, not a routine checkpoint.

## Database visibility uniqueness — September 24

The read-only production census found PostgreSQL 18.6 and 12 visibility rules with no
duplicate or conflicting scopes. Migration 0013 replaces the nullable unique index with a
NULLS NOT DISTINCT constraint. The current application remains compatible with either
shape; direct database writers can no longer create duplicate null scopes after migration.

The upgraded local rehearsal deliberately created duplicate legacy rules, demonstrated a
failed transactional upgrade with both rows and the legacy index intact, then removed only
the designated duplicate fixture and upgraded successfully through 0013. It preserved the
original rule and metric data, rejected a duplicate null scope, and retained empty-string
versus null semantics. The prior corrected-sync, revision, zero, failure, and idempotence
checks also passed. Full validation: 346 tests across 42 files, lint/format, TypeScript, and
production build. See `2026-09-24-visibility-constraint.md` for deployment and rollback.
Neither hosted staging nor production has received migration 0013 yet.

The scheduler access confirmation and automation-attribution definition remain pending.
The scheduler code and credential isolation are published at 4ccf88c and that Preview is
READY. Railway's disabled Run now test completed successfully; auth-probe source changes
are staged but not deployed. No scheduler token has been generated, saved, or transmitted.

## Production recovery rehearsal — September 24

A full custom-format PostgreSQL 18.6 snapshot was exported read-only, encrypted with
Windows DPAPI, decrypted and SHA-256 verified, then restored into a new password-protected
loopback PostgreSQL 18.6 cluster. All 32 tables / 28,878 rows matched the shared snapshot's
content digests. Migrations 0012 and 0013 passed on this restored copy without changing any
existing application table contents. The temporary database, plaintext dumps and password
were removed after verification. The encrypted archive and manifest remain in private
recovery storage outside Git. TypeScript passed; Preview 59bc8e8 is READY.

See `2026-09-24-production-recovery.md` and the aggregate rehearsal JSON. This establishes
application-data recovery, not portable off-machine disaster recovery or provider PITR.
Global roles/ownership and external service configuration are not restored by this test.
No production or hosted staging migration has been applied.

## Bounded checkpoint reads — September 24

The shadow scheduler now reads checkpoint state without materializing completed ticket or
leg cohorts. Completed observations still retain and expose their evidence through the
explicit export readers. All 18 checkpoint/worker PostgreSQL regressions and TypeScript
passed, including completed retries, resumption, correction comparison and daily selection.

## Atomic automatic roster approval — September 24

Automatic discovery approval now commits employee, identity, membership and reviewed
candidate together. A failed membership insert rolls back the prior inserts before saving
one pending candidate. Database errors retain their SQLSTATE through the sanitized logger;
the candidate's email and SQL payload are not logged. Manager-account exclusion is scoped
to the source organization. Nine roster integration tests pass, including an injected real
database failure and a different-organization manager account; TypeScript passed.
Discovery concurrency, multi-group/line policy and departure deduplication remain open.

## Serialized roster discovery — September 24

Vendor fetches complete before the source database row is locked. Reconciliation then
rechecks mapping configuration and organization ownership and commits through one source
transaction, with per-candidate savepoints for the pending fallback. Simultaneous discovery
runs cannot create duplicate new hires or pending departures. Changed mappings and duplicate
or unmapped returned identities fail before writes. Pending departures are reused; existing
historical duplicates are not deleted. Eleven roster integration regressions pass, including
simultaneous invocations and a mapping change during fetch. Multi-group/line policy remains
open and is not inferred from whichever vendor group happens to be returned first.

Combined validation after these increments: all 350 tests across 42 files, full lint/format,
TypeScript and production build passed. The production restore rehearsal also passed on
PostgreSQL 18.6. No production schema change, historical replay or v2 publication occurred.

## Conflicting roster membership — September 24

Zendesk discovery no longer silently selects the first team for an email. Repeated account
membership in groups mapped to the same team is deduplicated; conflicting team assignments
or separate numeric accounts sharing a case-insensitive email abort discovery before any
reconciliation writes. Four connector regressions cover both traversal orders, compatible
groups, and shared-email accounts. Existing line propagation remains separate work.

## Roster discovery completeness — September 24

Membership traversal now requires explicit completion, validates returned group/account IDs,
and rejects repeated cursors or more than 100 membership pages per group. Duplicate user IDs
are fetched once. Every requested account must be returned exactly once with the fields used
by discovery; missing/duplicate/unrequested accounts abort the operation rather than producing
a partial roster that could create false departures. No partial discovery reaches database
reconciliation. Seven connector tests and TypeScript passed. This is a fail-closed bound,
not resumable roster discovery or proof that source membership is an employment decision.

## Roster line preservation and hosted migration — September 24

Configured lines now travel through discovery into automatic hires and pending candidates.
Migration 0014 adds nullable suggested_line without guessing a value for existing candidates.
Conflicting team/line mappings fail closed. Manual approval retains the suggested line only
for the suggested team; switching teams clears it and the review screen explains this.
The review copy now accurately describes automatic small-batch approval.

Local 0011-to-0014 upgrade rehearsal passed, preserving a legacy candidate with null line.
A fresh encrypted production snapshot restored all 32 tables / 28,878 rows exactly, then
upgraded through 0014 without changing existing application data. Production stayed read-only.
The separate staging-only operator deployment dpl_13jvbWaW3w5BHw5jfVdfaqSvpgGf is READY;
it applied through 0014 and verified all 32 public tables / 28 staging rows unchanged.
No project-wide build settings or connection credentials were changed. See the roster-line
migration report for the guards and rollback compatibility. All 360 tests across 43 files
pass, including automatic/pending line preservation and clearing after a manual team change.
Full lint/format, TypeScript and production build also passed before publishing the application
changes. Ordinary deployments do not run the explicit migration operator.

## Scorecard keyboard controls — September 24

Week navigation no longer blurs the active control. The date picker focuses its input,
closes on Escape with focus returned, and closes when focus leaves. Its trigger and popup
now share an outside-click boundary. Period labels announce changes politely.
The export menu exposes menu semantics, Arrow/Home/End navigation, Escape focus return,
and outside-focus dismissal without stealing focus. Three new interaction regressions
plus nine existing navigation/export cases pass; focused lint and TypeScript pass.
Hosted browser verification follows the Preview deployment.

Hosted verification at 6001fc7 passed: ArrowDown opened the export menu focused on PDF,
End focused Print, Escape returned to Export, Tab exited to Previous week, and the date
picker focused its input then returned to its trigger on Escape. No export was sent or
downloaded during these keyboard checks.

## Employee picker completeness — September 24

The picker now places unexpected lines in Other and missing/unknown teams in Unassigned
team, with an assignment-review note. It renders only the already-authorized employee list;
no query scope or access changes. Three rendering regressions confirm every supplied person
appears exactly once, an entirely unassigned roster remains visible, and ordinary single-team
null-line rosters retain their flat presentation. Focused lint and TypeScript passed.

## Honest integration capabilities — September 24

Data Health offers manual sync only for the shipped Zendesk connector, labels Assembled
retired and other unimplemented types unsupported, and removes the misleading Entra roster
counters. Historical records are retained. Unsupported sources do not trigger polling for
old running jobs. Manual sync validates its body instead of silently syncing Zendesk when
another type was requested; empty legacy requests remain compatible. Eleven focused cases
pass, including unsupported/malformed rejection before rate-limit or sync work and UI
visibility of the supported action. No source configuration or production records changed.

## Per-metric data details — September 24

Each metric now offers a native keyboard-accessible disclosure for recorded quality,
source-observation time in UTC, calculation version and applied target scope. Partial or
unverified non-null values carry a visible qualifier next to the number. Missing metadata
stays Not recorded; no timestamp or version is invented. Rows use semantic row headers.
The interactive disclosure is excluded from image capture and print; existing export
provenance remains in the frozen snapshot. Three focused rendering cases and the three
export regressions pass, along with focused lint and TypeScript. Hosted verification follows.

## Local fixture reset safety — September 24

The fixture seed now refuses hosted URLs, unexpected local database names and URL
connection overrides before constructing a database client. Its reset order includes
sync revisions and visibility overrides, and seed errors use the safe database summary.
Ten guard cases pass. A repeatable disposable-loopback rehearsal applies all migrations,
seeds 36 employees, adds referencing revision/visibility records, and successfully resets
again. A synthetic hosted URL is refused without exposing its password. The rehearsal
removes only its newly created local database. No hosted data was reset.

Hosted metric-details verification passed at 36f9a12: complete observations show their
UTC timestamp and version; the missing observation stays Not recorded. The first request
failed with ECONNRESET during authorization; a full reload recovered. The existing Try
again action reused the failed render, which is being corrected separately.

## Error recovery and invalid numeric evidence — September 24

The global error boundary now makes a fresh page request on Try again, matching the
recovery that succeeded after staging ECONNRESET. Unknown metric quality strings use a
Map lookup and cannot inherit object properties; its rendering regression passes.
Target evaluation rejects non-finite or reversed bounds and negative exact tolerances.
An invalid highest-priority target returns No target rather than silently substituting
a broader rule. Non-finite values/changes return No data. Nine new invalid-evidence
cases pass alongside all 34 existing target scenarios. No stored target was modified.

Combined baseline: 385 tests across 48 files passed before the latest ten regression
cases; those ten pass in focused runs. Full lint passed, TypeScript passed after fixing
the rehearsal script's optional-row narrowing, and the production build passed. The
latest target changes receive the final combined checks below.

## Assignment-date consistency — September 24

The affected-scorecard preview now reuses the manager authorization context and active
employee query, including organization, employment status and effective dates. The View
as picker uses inclusive assignment starts and exclusive ends rather than only selecting
open-ended assignments. Forty-four focused admin/authorization/visibility cases pass,
including future/ended exclusions and currently active finite assignments. TypeScript
and focused lint pass. The preceding combined check passed 395 tests across 48 files.

The attempted 390px browser viewport override did not affect the actual page viewport
(measured 1869px); it was reset. Desktop rendering of both expanded metric disclosures
was verified, but mobile behavior is not claimed verified from that attempt.

## Reconciliation input boundary — September 24

API and trusted CLI/service callers now share real calendar-date, ordered-interval,
UUID-team and finite tolerance validation before a run claim. Legacy intervals remain
unchanged. Eight API cases and the PostgreSQL cooldown/claim case pass; invalid input
creates no run and does not consume cooldown. TypeScript and focused lint passed.

## Bounded browser error telemetry — September 24

Error boundaries now send only a route template, boundary category and bounded digest.
The server repeats sanitization for older or untrusted clients, ignores arbitrary message
and stack fields, strips employee path segments and all query/fragment data, and stops
reading reports above 4 KiB. Six cases prove sensitive text is absent from logs and malformed
or oversized reports do not compound the original failure. Focused tests and TypeScript pass.

## Continuous validation on the audit branch — September 24

CI now runs on this audit branch as well as master/PRs, uses a fresh PostgreSQL 18
cadence_test database, and has read-only repository permissions with superseded runs
cancelled. The local test configuration also rejects URL query/fragment overrides before
connecting, reusing the fixture endpoint guard. Existing Docker data is not upgraded in
place. Local full checks pass: 410 tests across 50 files, lint and TypeScript; the final
build and first remote CI run are verified separately below.

## Connector diagnostic minimization — September 24

Zendesk failures and retry logs now retain the API path template, HTTP code and retry
information without search queries, account hostnames or numeric resource IDs. This also
prevents email/actor lookup parameters from reaching persisted sync errors. Two additional
regressions pass with the eight existing request-boundary cases; focused lint passed.
The preceding 410-test full check and local production build passed. GitHub's first
PostgreSQL 18 CI run has passed migrations and tests; final completion is checked below.

## Measured mobile overflow repair — September 24

At an actual 390px viewport, the scorecard main container was 311px wide but its content
extended to 413px; the identity/status header and week controls clipped. Table scrolling
was contained correctly. The header now wraps, export stacks above week navigation on
narrow screens, the date label can shrink/wrap, and mobile navigation/export controls have
44px touch targets. The export menu anchors inside the available viewport. Twelve existing
navigation/keyboard/export regressions and TypeScript pass; hosted measurement follows.

CI run 36026548499 completed successfully on PostgreSQL 18, including fresh migrations,
all 410 tests, lint, TypeScript and production build. The local production build also passed.

## Sidebar organization scope — September 24

The sidebar job-title lookup now resolves the active signed-in user's organization before
reading an employee profile. A matching email in a different organization cannot supply
profile data. The new real-database negative case passes alongside the 23 existing
authorization cases; TypeScript and focused lint pass.

Hosted mobile checks at aa0e4ad confirmed contained header/main widths at both 390px and
320px, all four controls at 44px high, and the export menu inside the viewport. A further
small-screen refinement gives the date its own row to avoid narrow multi-line wrapping.

## Employee detail and metric read isolation — September 24

Admin employee detail now derives organization from requireAdmin and scopes employee,
team and active manager reads to it. Future or ended memberships/manager assignments
are excluded. Same-team saves preserve line/history; a real transfer clears the old line
and closes currently active memberships, including finite ones, without cancelling future
scheduled memberships. Metric reads validate both team and employee organization and
exclude foreign definitions even if a corrupt assignment references them. One-on-one
team/manager labels are also organization-scoped. Fifty real-database authorization,
admin and query cases pass; TypeScript and focused lint pass. The three database suites
now use Node rather than an unnecessary DOM environment.

The preceding branch CI run 36027898317 passed. Hosted 320px verification at 224907e
confirmed the date fits on one line, main/header widths stay contained, export stays inside
the viewport, and Escape restores focus. Viewport emulation was reset afterward.

## Human-only attribution decision and weekly probe — September 24

The user selected verified human activity only, with uncertain attribution unavailable.
The shadow summary now requires child-level reviewed decisions before crediting activity,
excludes verified automation and rejects mismatched/duplicate review records. Unknown
attribution yields null for the affected metric; report totals preserve null instead of
summing unknown values as zero. Nine focused ticket-event tests pass, including mixed
manual/automation audits and uncertainty. This does not activate version 2 or certify
historical version-1 employee totals; source-bound review production remains required.

A read-only September 13–19 export fetched 85,066 ticket events in 88 pages and 17,172 call
legs in 30 pages. Actor lookup then failed its completeness/consistency check. The run made
152 requests, received nine 429 responses and honored 459 seconds of backoff. No success
report, employee totals or database writes were produced. The aggregate failure report is
2026-09-13-closed-week-action-shadow-probe.json.failure.json. The failure does not establish
whether accounts were deleted, missing or duplicated. The probe now supports explicit
one-to-seven-day ranges and aggregate stage diagnostics; no further full-week retry is
justified without addressing resumability and account-resolution evidence.

## Scoped correction-history inspection — September 24

Stored reporting periods now disclose up to 25 newest retained prior metric values, with
source-observation and revision-recorded timestamps, quality and calculation version. Null
remains unavailable and zero remains zero. Older retained rows are explicitly disclosed
when the view is bounded; this is not a complete paginated revision archive. The reader
checks assigned-employee scope, employee organization, metric-definition organization and
sync source organization. It projects only safe metric fields, never raw snapshot/source
payloads. Malformed evidence is shown as unavailable. Two PostgreSQL regressions cover
cross-scope exclusion, private-field stripping, null/zero, malformed evidence, interval
validation and newest-first bounds. No migration or data rewrite is needed.

The preceding full local run passed 420 tests across 50 files. GitHub CI run 36030090645
at d25d777 also passed PostgreSQL 18 tests, lint, TypeScript and production build. Correction
history is validated separately before its next deployment.

Attribution follow-up: child-event IDs must be unique within an audit, preventing one
review from certifying contradictory changes. Summaries retain the review UUIDs supporting
human credit and nonhuman exclusions. The 22 ticket-summary/checkpoint/worker cases pass;
focused lint passes. The retained event shape and checkpoint namespace are unchanged.

## Hosted correction history and attribution sample — September 24

Preview at 128fac5 displayed current 0 separately from retained missing and 42 values,
with correct observation/revision timestamps. Keyboard expansion passed. At a measured
320px viewport, main width/scroll width were both 241px and disclosure width/scroll width
were both 207px; tables scrolled inside their containers. The viewport override was reset.
CI run 36030902277 at 9a70794 passed all checks on PostgreSQL 18 and the production build.

A bounded read-only source sample independently matched 41 candidate child changes across
12 current agent/admin audits. Twenty-five children carried rule channels, seven API,
seven web, one system and one other; 26 had explicit child overrides. These are diagnostic
channel counts, not verified human or employee totals. The aggregate-only report and
repeatable probe are retained; no vendor or database writes occurred. The contract now
records this evidence and the remaining source-bound human/identity verification gate.

## Hosted scheduler authentication — September 24

Railway deployment 422ae54c-8768-487f-b80d-6abde7770454 logged authenticated_disabled
at 12:47 CDT and completed. Missing/invalid bearer checks failed closed, and the dedicated
shadow bearer could not invoke metric publication. Ingestion stayed disabled. The temporary
branch-alias share grant was revoked and the same cookie then redirected to protection;
Railway cleanup disables requests/probe mode and removes the temporary cookie. See
2026-09-24-shadow-scheduler.md for deployment references and remaining activation gates.

## Actor completeness diagnostics — September 24

The shared actor-batch verifier separates missing, duplicate and unexpected account results
and refuses to supply eligible IDs for partial or inconsistent coverage. Weekly probe
failures now preserve these aggregate counts without source IDs or payloads. Eight actor
and exact-email regressions and TypeScript pass. The retained September 23 export resolved
all 1,729 distinct positive actors with 18 source GETs, no 429s, zero ticket/call re-export
requests and no database writes. This narrows verification to that day; it does not resolve
the earlier weekly failure or establish historical roles/human attribution.

Scheduler checkpoint 0708ea4 passed both CI runs (36037075244 and 36037062390).
Cleanup deployment logged disabled at 12:49 CDT, and revoked temporary access returned
to Vercel protection. Production remains unchanged.

## Manager-facing human attribution containment — September 24

The approved human-only policy now applies to the existing manager read path as well as
shadow calculations. Unverified Zendesk Tickets Updated/Resolved become unavailable in
current/comparison values, status, exports, stored-period history and retained revision
displays. An explicit reason appears in scorecards and history. Underlying values/revisions,
targets and calculation versions remain unchanged; this is not a historical rewrite or
activation of version 2. No arbitrary version or complete flag can bypass the guard.
Eighteen query/history/revision/UI tests, TypeScript and focused lint pass, including
storage preservation and an unaffected separate source strategy. Hosted verification follows.
The actor-diagnostic checkpoint ea11849 passed CI runs 36037797548 and 36037791540.

Hosted verification at 49ef59f passed on Preview dpl_nFCJLDnPsS5AuCxwSbm3yVPHZpJH.
Synthetic stored ticket values 0/42 and comparison values 17/17 displayed as unavailable
with the attribution reason and No Data status. Stored-period history applied the same
policy; the separate confirmed-zero metric remained 0. The main container at 320px had
equal client/scroll widths of 226px; viewport overrides were reset. CSV download was
triggered successfully, but downloaded file bytes were not inspected. CI run 36038300941
passed all 431 tests across 52 files, lint, TypeScript and build. The repeatable hosted
fixture enforces the exact approved staging endpoint and synthetic-only inventory.

## Historical target-context containment — September 24

Closed-period scorecards no longer evaluate a past observation against today's employee
team/line or in-place target configuration. Without a preserved historical target context,
the reader returns no target and an explicit historical_unverified context marker. Current
period targets still resolve normally through their effective dates; numeric observations
and configured/stored targets remain unchanged. The scorecard explains that profile/metric
selection uses current context, and CSV/text/image/print evidence carries the target warning.
This contains misleading past judgments; immutable publication context and historical metric
selection are still needed for fully reconstructed historical scorecards.

Twenty-seven query/UI/navigation/export regressions and TypeScript pass, including a line
change after a period closes, the UTC end-of-period boundary and export propagation.

Hosted Preview dpl_5NJwqwnypfc2DwE7BFCsUdfZ94PY at a48ddd8 displays the historical warning
for September 13–19, retains the staging metric's numeric zero with No Target, and explains
unverified historical context under Target from. Ticket counts remain unavailable for the
separate human-attribution reason. The current period does not show the historical warning.
CI run 36039876813 passed 434 tests across 52 files, lint, TypeScript and production build.

## Documentation ownership — September 24

CLAUDE.md now provides concise engineering rules, preserves the generated Next.js guidance,
and records the user's standing authorization. docs/README.md identifies each document's
owner and distinguishes historical investigations from current branch/deployment evidence.
docs/RUNBOOK.md consolidates isolated validation, scheduler diagnosis, migration/recovery
and technical release/rollback procedures. Obsolete claims that cron routes are untested
were removed; older investigation evidence remains linked and retained. Local links and
the documentation diff were checked. No application behavior or infrastructure changed.

## Bounded contributor reads — September 24

Metric recomputation previously fetched all historical facts for each source/metric and
filtered affected employee/period groups in application memory. It now restricts those
reads in PostgreSQL using exact employee/start/end predicates in batches of 500. Unchanged
contributors within an affected group remain included; unrelated history is not transferred.
No calculation formula, write scope, migration or publication boundary changed.

Twenty-two formula/publication/scope cases and TypeScript passed. The new real-database
regression crosses 501 affected intervals, includes an unchanged contributor, and excludes
another employee and a different end date with the same start. Existing null correction,
idempotency, ordering, lease and rollback tests pass. A read-only production EXPLAIN sample
reduced returned rows from 864 to 1 and shared buffer hits from 292 to 7 for a one-group
correction; execution was 0.587 ms versus 0.090 ms. This is a cache/order-sensitive sample,
not an end-to-end sync benchmark. Only aggregate evidence is retained in
2026-09-24-compute-read-scope.json; the probe performed no database writes.

## Source disablement boundary — September 24

The audit's source-status gap remained in both publishing and shadow routes. Only
`configured` sources now start work; disabled, retired and unrecognized states fail closed.
The publisher also rejects a mismatched connector before fetching, then checks source
organization, type and status again under the publication lock. Disabling a source during
its fetch preserves existing values, revisions and last-success state. Cron cannot report
a healthy heartbeat for skipped disabled sources. No stored source statuses were changed.

Forty-four route/orchestration/PostgreSQL cases and TypeScript passed, including disabled
and unknown statuses, connector mismatch and disablement between fetch and publication.
The preceding fa79f0b computation change passed both full CI runs 36041372021/36041364469.
Source-account credential binding and in-flight shadow cancellation remain distinct work.

## Retained revision pagination — September 24

Stored reporting periods now allow navigation through retained prior values in bounded pages
of 25, with an explicit return to the newest page. Changing the selected interval resets the
cursor. Every cursor is resolved within the authorized employee, organization, source and
interval; malformed, foreign and wrong-period cursors are rejected. PostgreSQL microsecond
precision and UUID ordering prevent repeats/omissions across identical or closely spaced
timestamps. Newer revisions arriving between pages do not shift older pages.

Four PostgreSQL revision cases and TypeScript pass, including 52 closely spaced/tied rows,
concurrent newer insertion, invalid/foreign/wrong-period anchors, null/zero and human-attribution
withholding. Thirty explicitly marked synthetic revisions were added only to the guarded
staging fixture for hosted navigation checks. The first staging connection reset before the
transaction; the idempotent retry passed and removed its plaintext credential handoff.
Hosted verification and full CI for this increment follow. Both source-disablement CI runs
36041928943/36041923796 passed all 443 tests across 53 files and the production build.

Hosted verification passed at 22b7b6f on dpl_E6kJdrQ3XzTR26F6sXv7QhfRH1Fy: first page
25 synthetic revisions, older page five, Enter-key return to newest kept the disclosure
open, and interval selection reset the cursor. At settled 320px layout, main client/scroll
widths were 241/241 and disclosure widths 207/207; its table remained internally scrollable.
Viewport emulation was reset. CI run 36042686344 passed all 444 tests across 53 files,
lint, TypeScript and production build. Staging credentials were not retained in plaintext.

## Operational source health — September 24

Data Health now labels disabled/unrecognized source states and omits their Sync Now control.
Running jobs whose lease has expired display Interrupted with a recovery explanation;
legacy jobs use the same ten-minute fallback as lease takeover. Invalid lease metadata
remains Unknown. Expired jobs no longer keep the page polling indefinitely. Completed
runs are labeled Published rather than Healthy, since publication is not semantic validation.
The health API retains raw stored status and adds derived operational health and sync enablement.
These are read-only projections; no job rows are reaped or rewritten by viewing health.

Six status/UI regression cases, TypeScript and focused lint passed, including renewed lease
boundaries, legacy expiry, invalid metadata, disabled controls and polling suppression.

Full CI runs 36043747376/36043755514 passed all 449 tests across 54 files, lint,
TypeScript and build. Preview dpl_39U1vybaV9woR1ktPpd3cEViX1he displayed the synthetic
unsupported source without a sync control.

## Preview workflow authentication — September 24

GitHub OIDC rehearsal runs 36044229447 (push) and 36044434119 (manual audit-branch
dispatch) passed in two fresh sequential processes each. Anonymous and wrong-audience
requests stayed behind Vercel protection (302); trusted identity reached application
authentication and received its expected 401. Trust is restricted to the exact repository,
branch, workflow and audience, with Preview-only destination access. No source work ran.

The shadow route now offers an authenticated `?probe=auth` mode that returns before all
source/lease work even if ingestion is later configured. Ten route tests, four standalone
OIDC request-boundary tests, TypeScript and focused lint passed. The branch-restricted
`cadence-staging-shadow` GitHub environment holds only the dedicated staging worker secret;
the temporary private handoff was removed. The workflow does not use that secret yet:
the safe route must deploy first. Full worker authentication results will follow separately.

The full worker authentication rehearsal subsequently passed in both fresh processes of run
36045340885 at 741879c. GitHub environment claims are now required by Vercel's Preview-only
trust rule. The safe auth-only route was READY at 22d03b4 before credentials were sent.
Ingestion remains disabled, Railway remains disabled and recurring scheduling is not configured.

## In-flight shadow write authority — September 24

Hosted shadow requests now carry their lease token into checkpoint creation, page commits
and rate-limit deferrals. Each write transaction locks the source first, rechecks its
organization/type/configured status, then verifies the current lease token and database-clock
expiry before locking the checkpoint. Disabled sources and expired or superseded workers
cannot commit a fetched page or advance a retry cursor. Lease acquisition also rejects an
already disabled or mismatched source. Explicit offline observation tools retain their
organization-scoped behavior; this does not establish source-account credential binding.

Forty-four route/lease/worker/PostgreSQL checkpoint tests and TypeScript passed, including
14 new cases across ticket and Talk streams: pre-fetch disablement, mid-fetch disablement,
source-type changes, expiry, successor takeover, rate-limit deferral and successful resume.
No live ingestion was enabled and no production rows were modified.

## Shadow account continuity — September 24

Hosted shadow ingestion now requires an exact non-secret `zendesk-account:<subdomain>`
configuration reference on the selected source. The credential's configured API host must
match before lease acquisition; each write transaction rechecks that reference. Checkpoints
retain the account reference and reject resumption from a different or unbound legacy account.
Changing a source's account requires a separate source/checkpoint rather than mixing history.
This binds account routing, not human activity attribution, and is limited to the shadow worker.
No existing production source metadata was changed or guessed from display names.

Sixty-two focused cases passed, plus TypeScript, lint and formatting. Coverage includes malformed
subdomains, missing/wrong source bindings, mid-fetch rebinding and completed legacy/foreign
checkpoints that must be refused before a vendor request. All 464 tests at the preceding
write-authority checkpoint passed PostgreSQL 18 CI runs 36045957005/36045950693 and build.

## Hosted source observation and recovery — September 24

Four fresh hosted processes across manual workflow runs 36047104134/36047408195 completed
the September 23 UTC observation at 0ccc9e2. Ticket pages advanced 3 → 6 → 12 → 13; Talk
completed at six pages. All batches respected the six-step bound. A deliberately expired
staging lease was then reclaimed in run 36047700931; both of its processes returned zero
fetch steps with completed checkpoints. This is a simulated orphan lease, not a platform crash.

The isolated namespace retained zero employees/users/metric definitions/facts/publishing runs.
In-period counts of 11,954 ticket events and 2,532 Talk legs, plus their fingerprints, match
the retained local observation. Cross-environment consistency is not independent closed-week
parity or proof of human authorship. Full CI at 950afd7 passed 482 tests across 56 files;
0ccc9e2 CI runs 36047013059/36047005702 also passed.

The source was disabled at 19:24 UTC, temporary branch vendor credentials/source opt-in were
cleared using explicit blank overrides, and plaintext handoffs were removed. Production
environment entries were unchanged. The cleanup deployment follows. Railway remains disabled;
GitHub ingestion is explicit manual dispatch only. See the scheduler report and aggregate
hosted-shadow JSON reports for exact evidence. Recurring execution, retention/monitoring,
human/identity evidence and independent historical reconciliation remain open.

Cleanup and follow-up Previews 393b14c/a743cb6 became READY. Auth-only run 36048271316
and both full CI runs 36048277989/36048271347 passed. Supported workflow actions are pinned
to their verified release commit SHAs, and checkout no longer persists its repository token.

## Reconciliation attribution containment — September 24

The reconciliation screen and its list/detail/run APIs could still expose unverified ticket
totals and count them as matches. Their manager-facing projections now apply the same human-only
availability policy as scorecards: values, deltas and diagnostic notes are withheld; visible
counts classify those rows as attribution unavailable. Raw retained comparisons are unchanged.
Definition and employee organization ownership are checked as well as manager assignment scope,
and malformed run IDs return not found before querying PostgreSQL. The detail table now names
the employee for each comparison and explains that stored-value agreement is not source validation.

Thirty focused request, PostgreSQL scope/availability and cooldown cases pass, including
zero/nonzero withholding, version-999 containment, raw-row preservation, foreign-definition
and employee exclusion, and policy-filtered counts in the POST response. Hosted verification
and the full suite follow with this change.

Hosted verification passed at 6bc49e2 on dpl_5mhsgTJxV7D41VpqgP2YUGDsMbpz. The same
synthetic stored run showed ticket values 42 and zero before refresh, then withheld both
after deployment, with two attribution-unavailable rows and explicit employee names. Its
other zero-value metric remained visible. The 320px check exposed overflow in the team
selector and run summary; responsive stacking and bounded select width fixed it at 8772a8a
on dpl_5PpxjBv65xKMdLzrsFiGPVUKwAtQ. Settled main client/scroll widths are 226/226;
the table scrolls within its own 194px wrapper (477px contents). Viewport overrides were reset.
Both 8772a8a CI runs 36049665867/36049660412 passed all 486 tests across 57 files and build.

## Atomic reconciliation publication — September 24

Reconciliation previously saved each 100-row result batch separately. A later insert failure
could leave partial comparisons behind. It now reads definitions, scope, stored values and
facts from one repeatable-read transaction and commits every result together with completion.
Failure rolls back all comparisons while preserving the separately claimed run as failed.
Manager queries also withhold partial legacy rows for running/failed runs. Run claiming
verifies the triggering user's organization before consuming the cooldown.

A real PostgreSQL trigger, scoped to one synthetic fixture, forced failure on row 101: no
comparison rows survived, the run was marked failed, and a subsequent retry committed all
101 results. The temporary trigger/function and fixture were removed. Scope/availability
regressions cover running/failed legacy data and foreign triggering users. Full CI and
hosted completion verification follow; no production rows were changed.

Both full CI runs 36050433388/36050428285 passed 490 tests across 58 files, lint, TypeScript
and build. At Preview dpl_68fiJ5fuA8Aei8pUxg9zoCmvwiWf (41d5eb8), a fresh synthetic run
completed with four comparisons, one valid match, two attribution-unavailable results and
one missing source value. No vendor request or production mutation was involved.

## Reconciliation source-instance scope — September 24

The consistency engine previously pooled facts by metric and employee, combining unrelated
source instances. Comparisons now honor the source ID retained in the value's provenance,
restricted to the owning organization and the definition's connector type. Legacy values
without a source ID are compared only when exactly one owned matching source exists.
Invalid/foreign claims, conflicting strategy metadata and ambiguous legacy provenance remain
source-unavailable with an explanation; no source is guessed. Existing comparison evidence
and manager human-attribution withholding remain intact.

Twenty-two focused PostgreSQL source, atomic-publication and authorization cases passed,
plus TypeScript and lint. Regression fixtures include a sibling account, a different connector
and an intentionally inconsistent foreign-source FK, plus malformed provenance and single-source
legacy behavior. Full CI follows. This is an internal consistency safeguard, not independent
vendor-level reconciliation.

Both source-scope CI runs 36051133675/36051129146 passed all 493 tests across 59 files,
lint, TypeScript and build. Preview dpl_5jHfXG6bu72Qnw52F24ZXboBtPdV is READY at 54778e1.

## Functional theme contrast — September 24

Measured token combinations exposed low-contrast light-theme primary buttons, status text,
muted text and input boundaries, plus several dark-theme combinations. Functional colors
now provide normal-text contrast on the tested surfaces, including primary/destructive
90% hover backgrounds. Navigation, profile initials and roster departure controls use the
same tokens; the faint operations heading no longer reduces its text opacity. Global focus
outlines use the theme ring. Brand artwork and chart colors remain separate.

The repeatable diagnostic `scripts/audit-theme-contrast.mjs` records 96 token/surface pairs:
51 failed before, zero after. Sixteen baseline pairs used clipped out-of-gamut colors;
all tested final colors are in sRGB gamut. These are token coverage counts, not counts of
rendered violations. The JSON before/after reports retain ratios and limitations. Thresholds
follow [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
and [control contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
This limited check does not establish full WCAG conformance. Hosted visual verification
and full CI follow; no business calculations changed.

Both full palette CI runs 36052302791/36052296111 passed. Preview
`dpl_2CJgTCdH5JaERLBtkbZvN7WZedrc` at 8ea4c19 was inspected in both themes: primary
buttons and selected navigation use the revised colors, synthetic ticket rows remain
unavailable, and ordinary zero remains visible. Dark mode was restored. Inspection found
custom search/select controls still using decorative borders; 24 native input/select
controls now use the input token, and search focus uses the ring token. This follow-up
requires deployed verification; no forms were submitted during the contrast checks.

The 79ca0d5 control follow-up passed CI 36052750919/36052743364 and deployed READY as
`dpl_7qsbhQW8tZxiL45wDURgyKDxKKgo`. Browser computed styles confirm the revised search
border in both themes, including light RGB 123/137/156 against white. Dark mode was restored.

## Retained closed-week diagnostic — September 24

The original weekly probe lost its in-memory cohort when actor lookup failed. The existing
loopback rehearsal now accepts `LOCAL_SHADOW_END_DAY` for one to seven closed days. Multi-day
intervals use a separate deterministic fixture namespace; daily identifiers remain compatible.
New fixtures carry an explicit source-account binding, and multi-day actor diagnostics require
matching source and retained checkpoint bindings before vendor requests. Hosted scheduling
continues to use daily intervals; these extensions are offline diagnostic tools only.

`probe-retained-action-actors.ts` reads completed retained exports with a read-only database
connection and uses `LOCAL_SHADOW_ACTOR_OFFSET` for at most 2,000 accounts per process.
Reports distinguish the evaluated slice from full-inventory completeness and contain counts
and an aggregate inventory hash, never account IDs or payloads. Missing-only batches may be
compared with the documented inactive/deleted lookup option; those responses do not establish
historical roles or human activity.

Seven date/scope regressions and eight existing worker/actor cases passed, along with local
TypeScript and lint. The first September 13–19 batch retained three pages from each stream
with zero normalized facts and no publication timestamp. Further fresh-process batches are
in progress; this entry does not claim a completed week or explain the original actor failure.

## Unused dependency removal — September 24

Repository searches found no Radix tabs imports or component callers, and `pnpm why` showed
only the direct application dependency. Removed `@radix-ui/react-tabs` and its lock entries;
no other dependency versions changed. TypeScript and a frozen-lockfile install passed. The
full CI/build check follows. Existing navigation and Radix primitives remain in use.

Both e716468 diagnostic CI runs 36053392040/36053384104 and both 6ad1093 dependency
CI runs 36053740377/36053733130 passed 500 tests across 60 files, lint, TypeScript and build.

## Atomic visibility editor saves and control labels — September 24

Selecting both brands and both Menufy lines previously made three independent server requests.
A later failure could leave only part of the intended visibility change applied. The editor
now sends one bounded, validated selection; all rules save in one PostgreSQL transaction
under the metric lock. Empty, duplicate, mixed-selection and foreign-resource batches fail
without partial changes. The single-rule action uses the same implementation.

The editor retains inputs and reports an unconfirmed save on errors, avoiding a false claim
that a lost response means nothing was committed. Manager scope stays fixed while loading
its confirmation count. Existing labels now name the selects and radio groups; roster
mapping/team fields receive accessible names and radio boundaries use the input token.

A fixture-scoped PostgreSQL trigger rejected the second rule after the first rule was
updated: the original value survived, no later rows were saved, and retry committed all
three rules with one attribution timestamp. Trigger/function and fixture rules were removed.
Forty-four relevant visibility, editor and organization-scope tests passed across four files,
plus TypeScript and lint. Full CI follows. No real visibility setting was changed.

Both full visibility CI runs 36054548710/36054541845 passed 505 tests across 61 files,
lint, TypeScript and build. Preview dpl_HuruSpDjuFUqdBxu13zHdqoaTv5u became READY at
59f4f72. Its historical synthetic scorecard retained the selected September 13–19 interval,
ordinary zero/missing distinctions and human-attribution/context warnings. Administrative
save behavior was verified in PostgreSQL and component tests; no hosted real-user rule was changed.

## Completed weekly collection and reproduced lookup omission — September 24

All 24 fresh loopback collection processes completed: 85,066 in-period ticket events from
88 pages and 17,172 call legs from 32 pages, using 128 GET requests. Checkpoint continuity
was verified across every process. No normalized facts or publication timestamp were written.
The separate weekly source and checkpoints match the vendor account binding.

Six read-only database/GET-only actor processes covered all 10,607 distinct positive IDs
in 107 contiguous batches (108 GET requests). Default lookup omitted one account in batch
67; the documented inactive/deleted-inclusive query returned exact coverage for that batch.
No duplicate or unexpected accounts occurred. Aggregate inventory fingerprints match across
all six slices. This reproduces a concrete completeness failure and its diagnostic resolution;
the earlier discarded response cannot establish that its exact missing account was the same.

The included account is not certified as a historical employee or human author. Existing
human-only withholding remains intact. See `2026-09-24-weekly-retained-diagnostic.md` and
`2026-09-24-weekly-retained-summary.json` for evidence and reproduction. No new source fetch
is needed to continue examining this retained week. Historical eligibility, attribution review,
independent metric parity and operational activation gates remain open.

## Sidebar focus contrast — September 24

The light theme retains a dark sidebar, so its focus outlines now use the dedicated sidebar
ring rather than the darker main-content ring. The contrast diagnostic adds sidebar-background
and sidebar-accent cases in both themes: all 100 current token/surface checks pass, with no
out-of-gamut clipping. The original 96-pair before/after reports remain historical evidence;
`2026-09-24-theme-contrast-focus.json` records the expanded check. Hosted keyboard verification
follows with the Preview deployment.

Both 367f7e1 CI runs 36079703912/36079701938 passed. Preview
`dpl_6hzB92HGT4Y2f9Eo8gh3NdjMxxyg` is READY. Keyboard Tab focused sidebar navigation
with a visible 2px outline: RGB 0/156/166 in light mode and 64/184/176 in dark mode.
Dark mode was restored. The first reload failed during an account lookup with ECONNRESET;
retry and a subsequent reload succeeded. A bounded read-recovery and error-redaction follow-up
is in progress; successful retry does not erase the original failure.

## Immutable audit evidence and actor disagreement — September 24

The offline audit capture binds minimal candidate-child evidence to the source account,
completed export checkpoint, immutable observation key and retained event hashes/digest.
Ticket/event/time and candidate child identity/status must match. It retains audit author
and export updater separately: disagreement is explicit evidence, never reassignment or
human certification. Parent and child channel/rule metadata remain separate. Comment bodies,
custom-field values, rule names, contact details and raw vendor metadata are omitted.

Source disable/rebind or event mutation during collection prevents commit. Concurrent matching
captures reuse one immutable winner; conflicting captures fail. Replays validate the binding
and evidence digest without fetching. Historical eligibility and human attribution are always
unknown. No server route, review decision, metric publisher or production database write was added.

Seventeen PostgreSQL cases passed, including mismatch rejection, author/updater disagreement,
privacy stripping, observation isolation, mutation races and concurrent captures. The bounded
loopback rehearsal retained first/middle/last candidates by event ID from September 13–19:
three GETs, three audits, 16 candidate children. One author differs from the export updater;
one email-origin audit has 13 rule-linked child overrides. This deterministic sample is not
a population estimate or reviewed human evidence. A fresh-process replay made zero GETs.
Both processes found zero normalized facts and no publication timestamp. Aggregate-only
reports: `2026-09-24-retained-audit-evidence.json` and its `-replay.json` counterpart.
TypeScript and lint passed; full CI follows. Two audit documents also had legacy non-UTF-8
dash bytes repaired without changing their meaning. The next separate fix addresses the
observed Preview connection reset.

## Account lookup reset recovery — September 24

Preview runtime evidence tied the initial history-page 500 to ECONNRESET during the active
user lookup (client digest 2312416058). Next's default uncaught-error logging also included
Drizzle SQL and parameters. The subsequent retry and reload succeeded. This was a connection
failure, not a missing account or permission denial.

The two account lookup paths (current user and an administrator's view-as target) now retry
one known transient connection failure with a fresh read. Missing/inactive accounts remain
denied, non-transport database errors are not retried, and repeated failure throws a new
generic error without SQL, parameters or nested driver causes. Diagnostics contain only
fixed messages, attempt number and an allowlisted transport code. Writes are never replayed.

Nine targeted cases verify recovered true/false admin flags, missing accounts, bounded
repeated failure, database authorization/schema/constraint failures, cyclic causes and private
error stripping. All 24 existing PostgreSQL authorization tests also passed, plus TypeScript
and lint. Full CI and deployed read verification follow. This does not claim that all possible
database connection failures elsewhere in the application have been eliminated.

Both audit-evidence CI runs 36080998224/36080994551 and both account-recovery CI runs
36081192353/36081188930 passed. The latter ran 531 tests across 63 files, lint, TypeScript
and production build. Preview `dpl_9gc1tCGHoYvVpRPRtmFrXiZ245mY` is READY at 4b78f07;
the historical synthetic scorecard loaded after reload with attribution/context guards intact.
Actual transport interruption was reproduced in targeted tests, not induced on the hosted database.

## Scheduler authentication probe isolation — September 24

The dormant Railway caller still sent its authentication probe to the ingestion route without
the explicit `probe=auth` query. Although the source opt-in is currently cleared, later
configuration could turn that probe into a real batch. Probe mode now always calls the
dedicated auth-only endpoint and accepts only `authenticated: true, ingestionRequested: false`.
Ingestion-shaped responses fail instead of being reported as a successful probe. Ordinary
batch requests retain their existing explicit path and response checks.

Seven scheduler cases and twelve route cases passed, plus TypeScript and lint. The route
tests already prove authentication probes exit before source/lease/vendor access even when
source configuration exists. The hosted scheduler remains disabled; code deployment follows.

Both 55d477e CI runs 36081493636/36081489815 passed. Its Preview
`dpl_6MQhfQ71ch4A4akkBEHTSj941T55` is READY. Railway deployment
`db625af7-3349-4606-837f-66fa92ce919b` changed only the function source and completed a
manual execution at 20:22 CDT with `status: disabled`. Enablement, credentials and schedule
were unchanged. This validates the deployed disabled path; auth-only request boundaries
were exercised by the 19 focused scheduler/route tests, not by granting another Preview session.

## Read-only checkpoint health — September 24

The shadow endpoint now accepts an authenticated `probe=health` that reads only checkpoint
metadata for its explicitly selected, account-bound source. It never obtains a lease, creates
a checkpoint, fetches vendor data or publishes metrics. Missing daily intervals are detected
even when a later interval is complete; missing stream pairs, invalid/account-mismatched
metadata and the 1,000-row inspection bound cannot return current health. Disabled and never
started states remain separate. Unknown probe names return 400 instead of starting a batch.

Three hours without eligible progress triggers attention, using the oldest unfinished day
and honoring its persisted retry deadline. A newly closed day has its own progress window;
an old completion timestamp does not immediately make the next day stalled. Re-observation
keys are excluded from primary daily coverage. Responses retain only dates/counts/status and
explicitly do not certify publication or human attribution.

PostgreSQL tests compare all checkpoint rows before/after the health read, reject foreign
organization/account requests and ignore separate observations. Route tests prove configured
and disabled health reads need no vendor credential and never call the worker or lease. The
runbook defines each health state and its limits. This is the monitoring read path, not an
activated alert service or recurring ingestion. Full validation follows.

Sixteen health cases, fifteen route cases and seven scheduler cases passed; TypeScript,
full lint and formatting passed. The additional retry-order regression confirms that later
missing days cannot bypass the oldest day's rate-limit deadline. No hosted source was enabled
for these tests. CI and Preview deployment follow.

Both 9ea48aa CI runs 36082590020/36082585605 passed. Preview
`dpl_2JG95EDKec2qm6V3Bh7aJdp7Uybw` is READY. Authentication-only workflow 36082699269
also passed in two fresh processes with ingestion false. The health report itself is verified
by the PostgreSQL/route tests; the source remains disabled rather than being enabled for a demo.
Review added separate source-status and credential-ready flags: a configured source without
vendor credentials must not report ingestion enabled. A final route regression covers the
credential-configured case without starting the worker.

Final readiness-flag validation at 0aea6e8 passed CI 36082934341: 552 tests across 64 files,
lint, TypeScript, migrations and production build. Preview
`dpl_3XenavGaBj913rv8eF5GEE5pzc2j` is READY. The companion push CI is recorded in GitHub;
the source and Railway ingestion flags remain disabled. These checks complete this health
read-path increment, not the outstanding attribution, historical context, independent metric
reconciliation, retention, alert-delivery or production-rollout gates.
