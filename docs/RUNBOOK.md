# Validation and release runbook

Current environment state and release blockers are owned by the
[implementation ledger](audits/2026-09-23-implementation-progress.md). This runbook does not
declare production ready or authorize bypassing those technical gates.

Apply the [safety guardrail plan](SAFETY_GUARDRAILS.md) before source investigation or
release work. Zendesk is read-only; report/dashboard editors are prohibited even for
unsaved inspection because opening an editor caused a manager lock during the audit.

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

### Independent roster discovery candidate

Lifecycle candidate migration 0017 adds observation/proposal evidence without changing
existing assignments. After deployment, rediscover before approving old proposals: legacy
rows have no fabricated observation. Reviews expire after 36 hours and require the latest
compatible observation; refresh the page after discovery. Transfers/returns take effect on
the UTC review date and retain employee identity/history. A departure with another membership
or an empty source roster is refused. These are administrator-reviewed transitions, not
automatic employment decisions. Unattended archival remains disabled pending its source
authority, consecutive-observation/grace-period policy and anomaly gates.

`/api/cron/roster` is disabled unless `ROSTER_DISCOVERY_SOURCE_ID` selects one configured,
account-bound Zendesk source with group mappings. Deploy migration 0016 first after a
fresh recovery rehearsal. No schedule is installed by this change. Keep the variable unset
in synthetic Preview and production until activation gates pass. Authentication uses the
existing environment-specific `CRON_SECRET`; `?probe=auth` performs no source/database work,
and `?probe=health` only reads the latest independent run. Probe success does not establish
scheduled execution. Never send a normal request merely to manufacture cron evidence.

The worker uses bounded GET discovery (40 requests, 90-second pre-request budget, individual
30-second timeout, immediate 429 deferral) and never auto-approves candidates. Candidate
writes and run completion commit together. Ten-minute cooldown/expiry and publication token
checks protect overlapping or interrupted runs. Errors retain prior candidates and store only
sanitized failure codes. Metric freshness and employee assignments are unchanged. Manual
admin discovery remains a separate legacy path; avoid concurrent operator discovery during
worker canaries. Stale candidates, transfers, returning staff and safe departure confirmation
still need separate lifecycle work.

Activation requires a source-specific canary, review of candidate scope, documented roster
authority/exceptions, and a genuine scheduled observation after the chosen schedule is added.
Setting the variable suppresses the selected source's legacy current-week cron discovery;
other sources are unchanged. Roll back by removing the worker schedule and variable together,
restoring legacy discovery; retain the additive run table and its evidence. Never interpret
the metric heartbeat as independent roster health after opt-in.

### Talk collection and outbound candidate

Both new paths default to disabled. Outbound refresh has four daily entries in
`vercel.json` at 00:00–03:00 UTC, one for each week offset; intervals before the explicit
cutover skip without source access. They require
the environment's scheduler bearer credential. Configure them only after the relevant
release checks; a route's existence is not activation or metric certification.

- `ZENDESK_TALK_COLLECTION_POLICY` is private strict JSON with `schemaVersion: 1`,
  `organizationId`, `dataSourceId`, `accountReference` and fixed UTC `bootstrapDate`
  (`YYYY-MM-DD`). `/api/cron/talk-collect` accepts no query parameters and executes
  one bounded resumable batch. It only retains source records/checkpoints. HTTP 202
  means partial; 409 means another account reader holds the lease; 429 includes
  persisted retry delay. HTTP 200 with exhausted streams still does not certify joined
  metric coverage. Legacy and durable Talk readers share the account lease/request budget.
- `ZENDESK_OUTBOUND_POLICY` independently uses the strict schema in
  `src/lib/connectors/zendesk-talk-policy.ts`, requiring all teams to have `inbound: null`
  and explicit outbound scopes/keys. `/api/cron/outbound?week=0` accepts exactly one
  offset 0–3, honors the prospective cutover and source cooldown, reads qualified stored
  calls/legs, and fetches bounded linked-ticket metadata before atomic publication.
  A collection policy alone never enables this publisher. No policy overrides the
  source-binding, observation, identity, assignment or transaction validation gates.

The recurring outbound route requires both policies to identify the same source. It
refreshes both Talk streams inside the same invocation before reading the retained
snapshot and linked ticket metadata. This avoids exceeding the one-hour joined
observation limit when separately scheduled jobs land in different hourly windows.
Talk collection is bounded to 22 pages / 150 seconds; Support reads to 80 requests /
90 seconds, leaving a margin within the 300-second function for database publication.
Incomplete, busy or rate-limited collection retains checkpoints and fails publication;
the previous metric values keep their original freshness timestamps. No partial source
population is labeled complete. Source account leases/pacing also coordinate legacy Talk.
The hosting plan permits daily jobs with hourly precision; these four offsets are four
distinct daily jobs, not an hourly polling schedule. See the [Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).

Keep both policies unset during default Preview deployments. Synthetic rehearsal scripts
must reject vendor credentials, verify the exact isolated database, and publish only
synthetic records. Do not populate real credentials merely to test disabled route behavior.

The audit branch is `codex/audit-reliability-checkpoints`; `master` deploys production.
Preview uses its separate Railway database and Entra sign-in registration. Check the exact
commit/deployment before claiming hosted verification. Use synthetic rows for UI tests and
keep current/previous periods, null/zero and unauthorized cases distinct.

The [scheduler report](audits/2026-09-24-shadow-scheduler.md) owns service IDs, activation
state and the hosted authentication evidence. Do not infer current flags from old checkpoints.
The dedicated shadow token does not authenticate the normal publishing cron route. A passed
auth-only probe means no source work happened; it does not prove live ingestion or restart.
Do not reuse the revoked temporary share session. The staging GitHub workflow uses short-lived
OIDC identity restricted to this repository, branch, workflow, audience and GitHub environment;
Vercel accepts it for Preview only. Pushes and default manual dispatches perform auth-only checks.
The explicit manual `ingest=true` input requests one bounded shadow batch in each of two fresh
processes. It never publishes employee metrics. Recurring scheduling remains disabled.

Hosted shadow ingestion requires `configuration_reference = zendesk-account:<subdomain>`
on the selected source. Its account and current lease are checked at each checkpoint write;
legacy/unbound and foreign-account checkpoints cannot resume. Use a separate source when
changing accounts. The guarded `staging-shadow-observation.ts` script provisions/reports/disables
only the fixed observation source in the approved Railway database. Its separate organization
has no users, employees or metric definitions. Source evidence strips comments, subjects and
unrelated fields. Inspect aggregate reports and disable the source/clear branch vendor settings
after a controlled rehearsal. Retention and human attribution remain separate activation work.

For a sync incident, inspect the source-scoped run outcome, last successful source observation,
lease/checkpoint state and sanitized errors. A 200 response, a recomputation timestamp, or an
old last-good value is not proof of current source success. Do not repeatedly launch whole
exports after rate limits or completeness failures. Resume the retained checkpoint or use
bounded diagnostics. Preserve aggregate failure evidence without raw IDs or employee payloads.

The legacy whole-call collector candidate retains a separate checkpoint per UTC reporting
week in `zendesk_legacy_talk_*_v1` source-record namespaces. This does not repurpose the
participation call/leg store or qualify its metrics. Each validated page, minimized call
versions and checkpoint commit atomically under the existing account lease. A failed or
unfinished fetch still fails publication and retains the last successful values; the next
normal invocation resumes its cursor. After completion, the next collection starts from
a five-minute watermark overlap to collect corrections. Do not reset checkpoints merely
to retry a timeout. Old-period rows remain source evidence, not permission for historical
repair. Per-week retained population is capped at 250,000 calls; exceeding it stops collection.
Production activation and source-retention policy remain subject to the release manifest.
`ZENDESK_LEGACY_TALK_RESUME=1` opts the existing legacy fetch into this path; unset retains
the original behavior. Keep it unset until the scoped recovery rehearsal passes. Clearing
it rolls collection back without deleting retained evidence or changing metric values.

Data Health labels completed work Published, not verified metric correctness. Interrupted
means its running lease expired; a new sync can reclaim it through the transactional lease
mechanism. Viewing the page does not modify the job. Disabled sources cannot start sync work,
and a source disabled during a publishing fetch cannot commit that publication.

### Read-only shadow checkpoint health

An authenticated `GET /api/cron/action-shadow?probe=health` reads metadata for the explicitly
selected source. It never acquires a lease, creates a cursor, fetches vendor data or publishes
facts. The same Preview protection and dedicated shadow credential apply. Vendor email/API
key are not needed for this read, but source ID and matching account subdomain must be configured.
No source opt-in returns `enabled: false`; a selected disabled source reports disabled health.
For selected sources, `sourceEnabled` reports source status; `enabled` additionally requires
vendor credential configuration. Neither flag asserts that an external scheduler is running.
Unknown probe names return 400 before database work rather than accidentally invoking ingestion.

Interpret `health.status`, not HTTP 200 alone:

- `current`: both daily streams are complete from the first retained day through the latest
  closed UTC day (with the two-minute source cutoff). This is not metric or attribution certification.
- `pending`: collection is unfinished; inspect `oldestPendingDay` and `nextRetryAt`. The oldest
  unfinished day owns retry timing. A newer missing day must not override that deadline.
- `not_started`: there are no daily checkpoint rows. Do not label this as successful collection.
- `attention`: a missing day, invalid/account-mismatched checkpoint, duplicate stream,
  inventory above 1,000 checkpoint rows, or at least three hours without eligible progress.
  Three hours represents three missed hourly opportunities, not a vendor-data SLA. Persisted
  rate-limit deadlines and the newly closed-day grace period take precedence.
- `disabled`: source synchronization is disabled. Retained observations are not deleted.

The response contains dates/counts/status only. It excludes event payloads, continuation URLs,
lease credentials and actor identities. Read-only re-observations use separate keys and do not
satisfy the primary daily schedule. An external monitor still needs explicit configuration and
delivery verification before claiming operational alerting is active; this endpoint alone does
not enable recurring ingestion or alerts. Retention must preserve referenced evidence before
purging anything; an inventory-limit alert is not authorization to delete old checkpoints.

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

### Separate report-credit controls (inactive until release)

`ZENDESK_REPORT_EVENT_COLLECTION_POLICY` enables only minimized ticket-event retention:
schema version 1, organization/source/account binding and a fixed UTC bootstrap date.
`GET /api/cron/ticket-events` accepts only the scheduler credential and no query controls.
It commits each page/checkpoint together, returns 202 for unfinished collection, 409
for account contention and 429 with Retry-After for deferred work. It never publishes
metrics. Reuse the fixed bootstrap when resuming; do not reset or move it to skip gaps.

`ZENDESK_SOLVED_REPORT_RELEASES` independently enables an array of at most two validated
solved-only releases, one per kind/team. Each entry uses the strict `SolvedRelease`
schema, including source/account/team, report timezone/scope, effective Sunday,
observation age and release evidence digest. `GET /api/cron/solved-tickets` requires
exactly `kind=updater|assignee-solved` and `week=0|1|2|3`, plus the scheduler credential.
It honors cutover/cooldown and invokes the same atomic sync service used by rehearsal.
Collection policy alone does not enable publication; publication does not start or
reset an event stream. Missing policies are inert. No new recurring job is enabled
by adding these endpoints. The main Preview gate requires both policies absent.

Before activation, qualify actual source coverage, register the scoped effective catalog,
complete the remaining release gates, and document the real collection/publication
schedule and freshness budget. Follow a labeled canary with independent readback and
check unaffected rows/revisions. To stop new activity, clear the affected new policy
and redeploy; preserve retained evidence and previous values. Do not enable human-action
shadow/v2 or historical repair, change Zendesk, or change CSAT/first-reply policy.

### Release procedure

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
   Verify active cron definitions and in-flight runs too. The October 7 check of
   [Vercel's current documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
   says Instant Rollback restores the selected deployment's cron definitions for subsequent
   invocations; already-running work may continue. Supersede older rollback assumptions
   with observed project state, and separately contain any affected active publisher.

Unresolved source meaning must remain unavailable in the product. A release containing
containment is not certification of historical totals. Keep production rollout, metric-version
activation and historical repair as distinct, evidenced operations.
