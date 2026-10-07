# Report collection / publication coordination

Status: local candidate; not deployed. This is one prerequisite for reliable scheduled
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

Before production: finish full tests, type/lint and exact Linux CI/build; run the
runtime-identical isolated synthetic Preview rehearsal; validate a fresh encrypted
backup/restore; review and attach the focused PR; verify the deployed identity and
ordinary reads. Preserve the latest recorded compatible deployment and policy state.
No newly scheduled job may be enabled until recovery/capacity qualification is complete.

Rollback is the prior runtime with the same database/catalog and existing policies;
no data rollback is needed for skipped-run records. Reverting removes this new
coordination, so stop scheduled report collection before reverting once such a
schedule exists. Inspect active schedules and in-flight runs after rollback. Never
reset the retained source stream or restore the full database to undo this change.
