# Report collection / publication coordination

Status: PR47 merged and production verified October 7 at 21:04 UTC. This is one prerequisite for reliable scheduled
refresh, not completion of the metric goal or activation of the proposed cron timetable.

## Defect and correction

The report-event collector had an account lease, while ordinary publications had
source/week sync leases. An independent preflight could observe no active work and
then race a publisher. Different source records bound to the same Zendesk account
could also overlap. Persisted event-collector Retry-After was invisible to publishers.

The candidate uses the existing account advisory lock before the source row lock in
both acquisition paths. A collector defers while any nonexpired sync runs for a source
bound to that account. A sync defers while report collection owns the account or its
retained request cooldown has not elapsed. Released/expired owners cannot renew or
unlock a successor. A changed source binding during acquisition aborts the claim.

The scope is report-event collection versus publications through `runSync`. Existing
week-specific publisher concurrency is preserved; this is not a claim that all external
integrations, direct diagnostic GETs or roster readers share one account scheduler.
The correction does not remove the routes' five-minute cooldown, install schedules,
or itself implement deferred-job retries. Those remain a separate required increment.

## Expected changes and unchanged contracts

- New sync attempts can create a `skipped` run with an explicit report-collection
  contention reason. They fetch no source records and publish no metric values.
- Collector contention returns its existing busy outcome and retry time; retained
  events/checkpoints and published values are unchanged.
- No migration, metric definition, target, assignment, source policy or time boundary
  changes. No Zendesk mutations, demo changes or human-action features are enabled.
- Other Zendesk accounts are independent. Malformed/missing collection expiry cannot
  grant a publisher ownership; expired publisher metadata uses the existing ten-minute
  fallback where applicable.

## Acceptance and release

Real isolated PostgreSQL tests cover both acquisition orders, simultaneous claims
across the same/different source, differing week offsets, cooldown after release,
expired owners, fallback expiry, malformed lease data and unrelated accounts. The
complete synthetic collection-to-publication test now asserts that publication is
deferred without a source GET during pacing, then succeeds after real expiry. Hosted
synthetic rehearsal also respects this delay rather than bypassing the new guard.

Candidate `2eb2a54` passes exact Linux CI/build `37684923033`, including 1,125 tests
across 141 files; master CI `37685743149` also passes. The first full run exposed an
old test expecting publication during collector pacing. The first CI run then exposed
two synthetic suites sharing one account; assigning the solved suite its own fictional
account fixed the fixture collision without relaxing production coordination.

Runtime-identical isolated Preview `5a82087`, deployment
`dpl_BF6SkmwLCjzdg4CSpSdwHFxeGyxh`, passes the guarded hosted end-to-end rehearsal:
11 simulated requests, closed solved values 3/2 and current 3/0, no vendor requests
or production writes. Signed-in browser checks confirm the same values and neutral
current-week statuses. Fresh encrypted recovery at 20:53 UTC restored 35 tables /
355,285 rows with matching digests. See the adjacent Preview and restore JSON receipts.

PR47 merged to `8a88279fabd8bf8306f2b098184040553c4ad40b`; READY production
`dpl_5LFAcRdxm6VbvAQsXobikfdMuPuK` owns the live aliases. Login returns 200 and both
new routes reject unauthenticated requests with 401. The existing signed-in closed
scorecard retains its verified solved value. No schedules or source policies changed.

One controlled current-week Menufy refresh returned HTTP 200 in 69.527 seconds.
Independent calculation matches all 23 employee counts and contributing sets:
1,657 credits, three numeric zeros, zero discrepancies. All 69 exact JSONB predecessor
snapshots (23 source records, facts and values each) match retained revisions, and all
12 unrelated digest groups remain unchanged. Platform logs confirm this exact deployment,
the controlled manual user agent and no crash. This is manual refresh evidence, not
genuine scheduled execution. See `2026-10-07-report-sync-coordination-production.json`.

Immediate compatible rollback is `dpl_C3zsDWZKpLvz6HCkuxzGJCV3b5tk` / `31f4187`,
with the same active solved/collection policies. The policy-off same-runtime fallback
is `dpl_G82oX6dFur4iAQUDiGRPGKYW26pE`. Production retains its ordinary default build;
the guarded synthetic rehearsal command applied only to that Preview deployment.
No newly scheduled job may be enabled until recovery/capacity qualification is complete.

Rollback is the prior runtime with the same database/catalog and existing policies;
no data rollback is needed for skipped-run records. Reverting removes this new
coordination, so stop scheduled report collection before reverting once such a
schedule exists. Inspect active schedules and in-flight runs after rollback. Never
reset the retained source stream or restore the full database to undo this change.
