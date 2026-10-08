# Menufy inbound publisher — October 1

## October 8 boundary correction candidate

The pending publisher now supports the sync service's fixed reporting period. The
route selects dates before any asynchronous cooldown work, preventing a Sunday
rollover from changing the requested week. The publisher also rechecks the retained
source observation after acquiring publication locks. Expired evidence and a capture
started before a now-closed local week ended stop publication without changing prior
values. The current/future catalog cutovers and source formulas remain unchanged.

Thirteen focused tests cover route rollover, explicit previous-week writes preserving
current values, freshness expiry, boundary rejection and existing transaction controls.
All 1,209 tests / 151 files plus typecheck/scoped lint pass locally. Exact CI and hosted
validation remain pending; the Menufy publication policy is still inactive. This does
not enable the four October 11 assignments early or qualify unrelated averages.

The user authorized completing verification and production delivery. This candidate
implements the missing publication path; it is not yet activated or released.

## October 5 release update

### Guarded catalog execution manifest, 20:40 UTC

Execute registration only from tested candidate `952f3d37495b3ae932a003aa9b2c8db841d738e1`
with successful full CI `37367161929`. The fresh post-migration recovery at 20:35 UTC
matches all 35 tables / 138,044 rows and retains encrypted round-trip proof. Production
now has all 18 known migration journal entries. Durable source reconciliation matches
414 values, 414 source sets and 552 duration comparisons across all 23 active Menufy
employees, with no affected parent blocks. One global parent gap remains outside that
cohort. Source feature opt-ins remain absent; no scheduler or publication is activated.

Expected writes are exactly four future-effective definitions and four Menufy team
assignments with October 11 cutover, neutral direction and no targets. Require the tested
atomic ownership/binding/compatibility checks and private immutable execution intent;
compare all existing catalog/assignment/target row digests after commit. Preserve private
created-row IDs for scoped rollback. On unknown outcome inspect the receipt and database;
never blindly retry. If rollback is necessary before use, remove only these exact created
assignments/definitions after checking no dependent facts/values/targets reference them;
otherwise disable the publisher and retain evidence. Never reset the whole database.
Production app rollback remains deployment `dpl_GnmLnC5NGNmMtTJ1nRpnAhqnnisj` at
`224176336c9b29c1c7e76c41213d5e52b3d74518`. This operation does not deploy app code,
publish metrics, alter older weeks, activate policies, change employees or touch Zendesk.

Observed attempt: the atomic operation refuses the live staff entity label and rolls back.
Read-only readback confirms zero added definitions. All 23 unique source bindings use
`agent`, matching the existing roster importer; the candidate checks only `user`.
Do not repair production identities to satisfy that test-fixture assumption. A focused
code correction and real PostgreSQL regression checks must pass exact-candidate CI,
followed by fresh recovery/readback and a separately recorded attempt. The first private
intent remains retained. Registration and publication remain incomplete.

The corrected registration attempt is separately scoped to exact candidate
`55c5a843a2cf53878730b5ac632ced244b9ea465`, after full CI `37371504967` succeeds.
All 992 local tests pass, including roster-discovered staff identity preservation and
atomic registration on `agent` bindings. Keep the first intent; require every existing
catalog/assignment/target digest to equal that original preflight before the new attempt.
Reuse the 20:35 verified recovery only while it is less than one hour old; otherwise
refresh it. Recheck production opt-ins and no running workers. Record a new immutable
attempt receipt and returned IDs, then compare unchanged existing catalog digests.
The October 11 prospective start, exactly four additions, neutral/no targets, publication
disabled and scoped rollback boundaries remain unchanged. This paragraph is a manifest,
not a statement that this corrected attempt has committed.

Observed corrected result at 20:57 UTC: full CI succeeds, four definitions and four team
assignments commit with the explicit October 11 cutover. All existing catalog/assignment/
target digests remain unchanged, and all 23 active bindings validate. No targets, metric
values, vendor requests or publication activation accompany registration. Private created
IDs remain rollback inventory. See `2026-10-05-inbound-catalog-production-readback.json`.
The fresh post-catalog recovery at 20:59 UTC matches 35 tables / 138,122 rows, with all
digests unchanged and no pending migrations. Publication is still inactive and cannot
rewrite prior periods under the new four-definition cutover.

The approved completion plan now has an explicit catalog-registration candidate in
`src/lib/connectors/zendesk-inbound-catalog.ts`. This operation is not connected to a route,
build or scheduler. It creates only the four additions below with future-effective definitions
and Menufy-policy team assignments, neutral direction and no targets. Matching ownership,
all nine compatible effective assignments and unique active employee bindings are checked
inside the transaction. Catalog/configuration writers are fenced with bounded table locks;
any failure rolls back all additions. Pre-existing addition keys of any version are refused.
Private returned IDs identify created rows for rollback planning; they do not certify release.
Eight real PostgreSQL catalog regressions and nine existing binding/publication regressions
pass locally. All 979 tests in 122 files pass locally; candidate `2992e8e` also passes
PostgreSQL 18 full CI `37363666846`, including lint, typecheck, migrations and production
build. Production recovery/activation gates remain required; registration has not occurred.

Application candidate `8e9f080` and equivalent main Preview `75daee2` pass full CI.
Hosted checks on Ready deployment `dpl_9kdMDHkAQdg3TNfiFYTQZ7X5T1v2` now verify
authenticated scorecards, last-week defaults, neutral current-week presentation,
aligned columns, history return selection, and actual PDF/PNG/CSV downloads for both
weeks. Image files were rendered/visually inspected; CSV checks preserve eight values,
zeros, eighteen unavailable measures and withheld historical targets. Synthetic publisher
rehearsal publishes nine keys for each week without changing unrelated values. Hosted
transfer/return/departure approvals pass with database readback preserving IDs, bindings
and previous intervals; disposable fixtures and temporary reviewer role were removed.
Clipboard bytes and print on this exact deployment remain unverified. See
`2026-10-05-hosted-release-verification.json`.

The fresh read-only production catalog census confirms 23 active Menufy employees,
five compatible existing definitions/team-wide assignments, and four absent definitions.
Registration scope is exactly the following; no production registration has occurred:

| New key                     | Display meaning                     | Unit / type    | Aggregation | Assignment       |
| --------------------------- | ----------------------------------- | -------------- | ----------- | ---------------- |
| `inbound_calls_unreachable` | Unreachable inbound agent legs      | calls / count  | sum         | Menufy team only |
| `inbound_calls_answer_rate` | Accepted / offered agent legs × 100 | % / percentage | latest      | Menufy team only |
| `total_talk_time_inbound`   | Total employee-leg inbound talk     | s / duration   | sum         | Menufy team only |
| `max_hold_time_inbound`     | Maximum employee-leg inbound hold   | s / duration   | max         | Menufy team only |

Use neutral direction and no inferred targets for the new definitions. Keep the five
compatible definitions, their existing assignments and all average keys untouched.
Before registration, repeat the read-only census and refuse duplicate/incompatible
definitions or assignments; registration and its exact rollback inventory must be
atomic. Both the four new definitions and team assignments require an explicit future
Sunday effective date. October 11 is the next prospective boundary as of October 5;
advance it if release is delayed. The publisher policy must use that same cutover.
This does not authorize relabeling or repairing September/earlier October values.
See `2026-10-05-menufy-inbound-config-preflight.json`.

Independent fresh replay matches 414 values, 414 source sets and 552 duration-evidence
comparisons across last week/current week, without Menufy parent blocks. Two older
closed-week replays retain the documented three-versus-four-component difference.
These observations do not certify historical employee eligibility or source authority.
Fresh durable collection, scoped persisted canary comparison, unrelated-row digests,
actual scheduling and rollback remain required. Production currently has no running
sync rows, ten completed and zero failed runs in the last 24 hours; this does not
attribute them to a scheduler or prove Talk freshness. Its migration journal still
lacks the known 0009 row although the three checked schema invariants exist, and
0016/0017 are not deployed. Do not interpret that census as a clean migration prefix.
Rehearsed restore compatibility is separate from a fresh production migration gate.
Production and frozen demo remain unchanged.

The later fresh calls-and-legs delta retains this zero-difference Menufy result with a
37,965 ms joined observation span and reverified current employee identities. Coverage
now has five global missing parents, including two affecting three agents in the retained
POS cohort; none affects the active Menufy cohort. Missing-parent cause/period remains
unknown. See `2026-10-05-menufy-inbound-final-reconciliation.json` and
`2026-10-05-fresh-parent-coverage.json`. These are source replay evidence, not persisted
production publication or historical eligibility certification.

## Change manifest

- Family: Menufy inbound call participation only. Nine allowed report keys preserve
  offered/accepted/declined/missed/unreachable legs, answer percentage, abandoned
  participating calls, total talk and maximum hold. Existing average keys are not
  replaced by totals or maxima.
- Contract: `zendesk-call-created-agent-leg-inbound-v1`, calculation version 2.
  The earlier `zendesk-inbound-report-v1` audit contract remains blocked.
- Opt-in: private `ZENDESK_INBOUND_REPORT_RELEASE` contains a strict `policy` using
  the existing inbound policy schema and `releaseEvidenceSha256` referring to the
  retained release evidence. A digest is traceability, not automatic certification.
  No real environment value, assignment or release digest has been set by this change.
- Route: authenticated `/api/cron/inbound?week=0..3`, disabled without opt-in, skips
  before the explicit Sunday cutover, requires a matching Talk collection policy,
  and honors the source cooldown. No schedule is added in this candidate.
- Collection: existing account lease/pacing, 22 pages/150 seconds, complete durable
  streams and observation checks, then up to 20 bounded staff GETs/90 seconds.
- Publication: exact fetched-record digest plus revalidation of active employees,
  source identity and effective definitions/assignments inside the write transaction.
  A short SHARE table lock fences configuration/identity changes including newly
  inserted assignments; lock acquisition times out at five seconds. Review hosted
  latency before enabling this publisher. These locks run only for its explicit opt-in.
- Replacement: one complete employee-period snapshot supersedes only legacy
  `call_stats` for its allowed keys. Later legacy refresh cannot add old counts back.
  Raw predecessor records and revisions remain; null corrections retract values,
  measured zeros stay numeric, and new definition/scope comparisons and targets
  remain withheld under the existing reader safeguards.
- Presentation: explanations distinguish offers from calls, participation from
  responsibility, SUM/MAX from averages and missing measurements from zero. Duration
  sample coverage survives into the common source context used by views and exports.

## Verification status

Code candidate `c768d91711f63e2e94002904b9caf202e044c6f0` passes
[full CI 36874191689](https://github.com/joswaldhr/hungerrush_scorecard/actions/runs/36874191689):
853 tests in 112 files, PostgreSQL migrations, full lint/typecheck, eight diagnostic
guards and production build. PostgreSQL tests cover successful replacement, later
legacy refresh, null/zero corrections, changed configuration, required transaction
validation and concurrent assignment fencing. Local typecheck and 29 focused tests
also pass.

Two older retained weeks independently replay 504 values and 392 source sets with
zero differences. Those old exports used three-component offers; the new
four-component results add 26 unreachable offers across six employee-weeks. See
`2026-10-01-menufy-inbound-history-replay.json`; this is not a historical repair or
a claim that changed definitions equal the earlier report totals.

Production read-only readiness inspection found 2,317 retained calls, 4,693 legs,
nine missing parent calls and September 28 observation timestamps. Twenty-two of
23 current employee calculations matched 198 independent values; one was blocked
by parent coverage. The earlier containment had deliberately disabled automatic
Talk refresh. All nine parents appear in the later September 30 diagnostic capture,
with source update timestamps more than two hours after the original collection.
This supports delayed source availability, not permanent absence, and does not
justify widening the one-hour joined-observation limit.

A new diagnostic refresh used 23 bounded Talk GETs with the existing shared
account lease/pacing: eight call pages and fifteen leg pages. It recovered all
nine earlier parent gaps; three new gaps remain outside the selected employee
cohort. All 23 employee calculations match the independent reference across 207
current-week values. Four additional bounded staff GETs confirm every mapping
against the current active staff census. Source records remain private. The
production durable snapshots, metric values, definitions and assignments were not
changed; only operational lease/pacing metadata was updated. See
`2026-10-01-menufy-inbound-fresh-replay.json`. The retained September 26 bootstrap
cannot qualify September 20–26, so this replay claims only September 27–October 3.
The separate September 30 workbook reconciliation remains the closed-week evidence.

The fresh encrypted backup/restore rehearsal passes for all 33 tables / 72,747
rows, with matching digests and unchanged application data after migrations through 0015. See `2026-10-01-production-restore-inbound-candidate.json`. Recovery is tied
to this Windows profile; provider PITR and portable disaster recovery are not proven.
Take another fresh recovery point if release is materially delayed or scope changes.

## Release gates still open

The current production inventory has 21 Menufy assignments. The new unreachable,
answer-percentage, total-talk and maximum-hold keys need explicit prospective
definitions/assignments; existing average keys stay unchanged. No targets are inferred.
Hosted synthetic scorecard/export verification, active policy configuration,
scoped production canary and actual scheduled operation remain open. The already
rendered Vercel overview identifies the current Ready production deployment as
`GnmLnC5NGNmMtTJ1nRpnAhqnnisj`, deployment URL
`hungerrush-scorecard-gl17iqbr2-water-hungerrush-scorecard.vercel.app`, serving
`hungerrush-scorecard.vercel.app` from master commit
`224176336c9b29c1c7e76c41213d5e52b3d74518` (PR42). It shows the Hobby plan.
This supersedes the September 28 PR33 rollback reference as the observed active
deployment, but does not verify environment values or function invocations.
Vercel is displaying an account-security prompt that must be handled by the user;
no security setting was changed or prompt bypassed. Reconfirm the deployment and
capture its policy configuration immediately before any release.

Source collection remains disabled in production. The independent diagnostic refresh
is not a successful durable publication or scheduler run. The publisher must still
obtain fresh bounded observations, pass binding checks and publish one controlled
canary before activation is widened. Delayed parents must be recovered on subsequent
fresh collection cycles without dropping legs, inventing zeros or relaxing freshness.
No production merge or activation is justified by CI/replay alone. Historical repair
remains disabled, the demo stays frozen, and human ticket attribution and historical
state-time sources remain separate unresolved requirements. No Zendesk changes occurred.
