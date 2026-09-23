# Audit implementation — current checkpoint

This is the authoritative progress and release-checkpoint document for the September 23
overhaul. The audit is a historical baseline; HANDOFF.md links here for current status.
Last updated: 2026-09-23. **Hosted database and Preview sign-in/UI checks passed; production rollout not performed.**

## Current ledger

| Area | Status | Evidence / remaining work |
|---|---|---|
| Audit and metric contracts | Complete | Baseline at ab062c3; audit and contracts in this directory |
| Reporting context and scope safeguards | Implemented locally | Navigation, organization and manager-scope regression tests |
| Atomic sync publication and freshness | Implemented locally | PostgreSQL rollback tests; untouched periods preserved |
| Null corrections and predecessor evidence | Implemented locally | Migration 0012; corrected null/zero and retained revisions tested |
| Combined implementation validation | Passed | 223 tests, typecheck, lint, production build |
| Migration and corrected-sync rehearsal | Passed locally | Separate staging database; 0011 -> 0012; synthetic stored-data assertions |
| Hosted staging / production parity | Database and core UI checks passed | Separate PostgreSQL 18.6, Entra app, branch-scoped secrets; cron runtime check remains open |
| Zendesk completeness | Search and Talk safety guards implemented locally | Synthetic pagination tests passed; live export reconciliation and metric semantics remain open |
| Production rollout / historical repair | Not performed | Release gate below must be completed first |

## Git checkpoints

Branch: `codex/audit-reliability-checkpoints` published to origin. Automatic Preview deployment was enabled after credential isolation and staging sign-in setup. Production was not deployed.

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
5. Stop at the release gate before hosted rollout or historical replay. Use the next-work
   entry here after a restart rather than reconstructing progress from older handoffs.

## Release gate and next work

**Next priority: Zendesk completeness and metric semantics.** Hosted staging isolation,
separate Entra sign-in, migration 0012, and synthetic null/zero UI checks are complete.
Automatic Preview deployment is enabled for the audit branch. See the dated hosted reports
and latest entries below; earlier isolation checkpoints are historical.

Remaining production release gates:

- Verify a controlled hosted sync trigger; the browser blocked the attempted cron request,
  so runtime cron authorization has not been established by that check.
- Complete Zendesk completeness work and review metric semantics before historical repair.
- Record a recoverable production backup/restore point and deployment rollback reference.
  Code rollback retains the additive revision table; data reversal requires reviewed snapshots.
- Review staged results with the user before production migration/deployment or historical replay.

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
