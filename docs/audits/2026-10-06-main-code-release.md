# October 6 main application code release

## Prepared candidate

- Audited application candidate: `e86b548b6036ea705e8ca1aa1f9a9e493f29c5f5` (PR43).
- Exact candidate CI/build: `37542573624`, successful. Includes 1,035 tests and migration/type/lint/build checks.
- Isolated Preview: `735d43f9e68bfa30ad3c6cec71ea2b4d7fae4445`, deployment `dpl_9cGa3Q3geprx6XN949UkpNp2kpXC`, READY.
- Preview application/scripts/migrations/config/package tree matches the audit candidate. Build log confirms the explicit main Preview isolation guard passed.
- Previous production and rollback reference: `dpl_GnmLnC5NGNmMtTJ1nRpnAhqnnisj`, SHA `224176336c9b29c1c7e76c41213d5e52b3d74518`.
- Production custom-domain automatic assignment remains paused; a successful build alone will not establish the live alias.

## Scope and expected effects

Deploy the reviewed UI/export, sync/roster safeguards and ticket-credit containment code.
No migration is required: all 18 candidate journal entries are present, with hashes
matching known LF/CRLF representations and no missing or newer entries. No environment
or credential change is part of this release.

Legacy Tickets Resolved/Updated remain unavailable. On ordinary sync, containment will
publish null corrections only for touched employee-periods and retain predecessor revisions.
The new report-credit calculators/collector are inactive; this code release does not publish
replacement ticket counts. No historical repair, human-action shadow/v2, Talk collection,
inbound/outbound publication or dedicated roster worker will be enabled. Existing qualified
CSAT/first-reply policies and schedules remain unchanged. No employee/team/target changes
or Zendesk mutations are part of deployment. The frozen demo remains on its existing alias.

## Verification and recovery

- Read-only production census at 02:35 UTC October 7: 10 completed syncs, zero failures
  in the preceding 24 hours, zero running/stale rows, zero duplicate visibility scopes.
  This is evidence of the old deployed version, not candidate scheduled execution.
- Fresh backup/restore at 02:37 UTC: 35 tables / 210,897 rows, matching digests;
  encrypted round trip and restored-copy schema compatibility passed, no application rows
  changed. See `2026-10-06-live-release-restore.json`. Backup is Windows-profile-bound.
- Previous hosted checks and actual PDF/PNG/CSV byte inspection are recorded in
  `2026-10-05-hosted-release-verification.json`. Application page/component/auth/export
  code is unchanged between that verified Preview and this candidate.
- Fresh authenticated Preview smoke is pending: this browser session has expired at
  Vercel protection. The user has been asked to sign in; no protection was disabled.
- Copied-link clipboard-byte and native print-dialog checks remain unverified. Do not
  present prior synthetic/export verification as live source certification.

## Rollout status

Prepared only. PR43 has not been merged and the production alias has not been promoted.
After the remaining authenticated check, record the actual merge SHA, build/deployment,
production alias, sign-in/core-read/export observations and error outcome. Roll back only
the application to the recorded compatible deployment if necessary; do not restore the
entire database or undo retained null corrections blindly. Genuine candidate scheduler
execution remains a separate post-release observation; do not manufacture it with manual syncs.

## October 7 release continuation (pre-promotion)

The user restored browser sign-in. Candidate `6f3f39753304da7a364d38a765506bd6aa60dca9`
passes exact CI/build `37562945362`. Its runtime tree is unchanged from the isolated
Preview above. Authenticated synthetic last-week/current-week/history reads pass;
all nine table headers have aligned widths and current-week statuses contain only
In Progress/No Data. Human-only and unsupported handling values remain unavailable,
zeros remain numeric, and history preserves returnWeek. Fresh CSV saves 26 rows /
12,437 bytes with correct selected/comparison periods. Fresh current-week PDF saves
1,012,960 bytes, renders correctly as one long scorecard page, and retains neutral
statuses and the compact source footer. Prior PNG byte/layout evidence applies to
identical export code. Copied-link bytes remain unavailable through the adapter;
native print dialog remains unverified.

A refreshed recovery check at 13:43 UTC restores 35 tables / 213,995 rows with matching
digests and no migration/application-row changes; see `2026-10-07-live-release-restore.json`.
The 13:42 UTC census has no running/stale rows but records two failures on the OLD
production version: a lease expiration and a CSAT tickets/show_many HTTP 429 with a
10-second Retry-After. Candidate pacing/diagnostics do not yet prove scheduled recovery;
the opt-in persistent legacy Talk path remains disabled. Existing failures are recorded,
not represented as corrected or manufactured into successes through extra manual syncs.
Production environment metadata still contains only the existing CSAT/first-reply policy
keys; all new publishers remain disabled. The existing rollback deployment remains READY.

Proceed with code-only PR43 merge/build/promotion, then verify the actual live alias and
authenticated core reads. No new metric publisher activation is included.

## Released October 7

PR43 merged as `7fa4593f8676afe679952d83b7bb38771537cb77`; full merge CI/build
`37631375550` passed. Deployment `dpl_HGEAA1j1xJ8XYJLKCMKcuTUPMoKN` was promoted
successfully and independently verified on the production alias. Fresh Microsoft
callback, both manager-scoped employee lists, representative scorecards and production
CSV download pass. No runtime error lines appeared in the checked window. See
`2026-10-07-production-code-release.json` for aggregate post-release evidence and limits.
The prepared/pending statements above describe earlier checkpoints and are superseded
by this release receipt. New report-credit metrics remain unpublished.
