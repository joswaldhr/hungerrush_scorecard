# Core production release

September 25 update: PR24's metric-duration and display correction is deployed at
86a0b10. The first actual scheduled current-week metric publication completed, but
post-publication roster discovery returned HTTP 503. The bounded correction and
remaining scheduled-week verification are tracked in
`2026-09-25-scheduled-sync-verification.md`; the evidence below describes the original
core rollout and remains historical.

The core audit fixes are deployed at [Cadence](https://hungerrush-scorecard.vercel.app).
[PR22](https://github.com/joswaldhr/hungerrush_scorecard/pull/22) merged as
`ef8cd6db12e9c3b077a425274a03771c5d48b771`; Vercel deployment
`dpl_3Xnasc88uF51ckmZFk5aF2nv87fq` is READY and was verified as the production-domain target
at 02:18 UTC September 25 (September 24 Central). Documentation follow-ups do not change this
application release's code or certify additional metric semantics.

## Evidence

- Candidate CI 36085132342/36085128949 and merged-master CI 36085309616 passed: 552 tests in
  64 files, PostgreSQL 18 migrations, TypeScript, lint and production build.
- A fresh read-only backup restored all 32 tables / 28,878 rows exactly. The restored-copy
  upgrade and subsequent production migrations 0012–0014 preserved existing application data.
  The encrypted archive is private and outside Git. The historical 0009 journal gap remains
  documented; its schema exists, and its destructive cleanup was not replayed.
- Production Microsoft sign-in, existing manager view, Data Health, current and previous
  reporting weeks, history and reconciliation reads passed. The displayed previous week
  matched `week=2026-09-13`; attribution/historical-context safeguards were visible.
- A controlled current-week production sync completed from 02:14:07 to 02:16:58 UTC. Fetch
  took 159,518 ms and publication 10,059 ms, with zero errors. It ingested 186 source records,
  normalized 1,110 facts and published 1,110 metric values. Every written source/value interval
  is September 20–26. It retained 186 source-record, 1,098 normalized-fact and 1,098 metric-value
  predecessor revisions. This is a normal current-week refresh, not historical repair.

Aggregate reports: `2026-09-24-production-restore-release-candidate.json`,
`2026-09-24-production-migration-release.json`, and `2026-09-24-production-sync-release.json`.

## Remaining limits

Tickets Updated/Resolved remain unavailable until human attribution is verified. Historical
target judgments remain withheld where historical configuration is unknown. Version-2
publication and recurring shadow ingestion remain disabled. These conditions are visible
product behavior, not a claim that the underlying evidence problem has been solved.

The controlled sync does not demonstrate a scheduled cron run, worst-case runtime or
independent metric correctness. Observe the next scheduled execution. Hosted export file
bytes remain uninspected because the available browser bridge did not expose downloads or
the application clipboard output; automated export-content tests pass. External heartbeat
delivery, portable recovery/provider PITR, shadow retention and historical reconstruction
remain open. The whole audit is not declared 100% complete.

## Recovery

Previous deployment: `dpl_n5978weiS8aDUPYswkWAMkmbw7JL` at `ab062c3`. Its admin and Data Health
pages loaded against the upgraded schema before cutover. Preserve the compatible schema and
revision evidence on application rollback. This older version also restores its older display
and publication behavior; do not treat it as an equivalent version of the new safeguards.
Database restoration is separate and must not blindly replace newer evidence with the
pre-release snapshot. See `2026-09-24-production-recovery.md` and the runbook.

Friday, September 25 remains the user handoff target for Monday use. No weekend participation
is planned for the user.
