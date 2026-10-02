# Menufy inbound publisher — October 1

The user authorized completing verification and production delivery. This candidate
implements the missing publication path; it is not yet activated or released.

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
rows, with matching digests and unchanged application data after migrations through
0015. See `2026-10-01-production-restore-inbound-candidate.json`. Recovery is tied
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
