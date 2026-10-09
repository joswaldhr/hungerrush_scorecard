# Legacy weekly sync recovery — October 9

## Observed defect and released baseline

The read-only morning check correlates 100 genuine scheduler requests across production
deployments. The 06:00 current-week legacy sync was skipped because report collection
owned the account or cooldown; the 06:45 oldest-week sync failed on source rate limiting.
Both returned HTTP 503 and wrote zero values. Their previous publications survived,
but the daily route had no durable retry. The other 14 rejected authorization/validation
requests in the retained window were controlled tests, not scheduler failures.

Pro is active. The existing recovery dispatcher received 81 scheduler requests without
an HTTP failure in this window; that does not establish publication on every tick.
Directory checks ran naturally three times; the latest observation matches all 62
account states, with zero unresolved identities and a released lease. Account-disabled
is not employment termination. See the [aggregate evidence](2026-10-09-morning-scheduler-check.json).

PR62 is live at `2d9ecfa`, deployment `dpl_EHgfXxqauqDvF7iTeLThzskznALH`,
with successful master CI `37947819189`, login 200 and anonymous scorecards redirected
to login. The [14:55 UTC encrypted restore](2026-10-09-morning-release-restore.json)
matches all 36 tables / 404,056 rows. PR62 changed evidence only.

## Candidate change manifest

- Defect: failed or skipped daily legacy work could wait until the next day.
- Scope: the same configured legacy Zendesk source and its four existing weekly selections.
  No formula, metric ownership, target, assignment or vendor configuration changes.
- Recovery is separately gated by `ZENDESK_LEGACY_SYNC_RECOVERY=1`, default unset.
  It requires the existing report dispatcher and separate source-bound roster discovery.
- Daily demand remains anchored to 06:00 UTC. The queue stores exact Sunday–Saturday
  dates, preserves retry delays, coalesces repeated deliveries, fences stale owners,
  and attempts at most one job per 15-minute invocation.
- Legacy sync supports fixed dates before asynchronous work. A retry after Sunday
  cannot shift its reporting interval or label today's backlog as last week's snapshot.
- The daily cron delegates to the queue for this source only when enabled. A successful
  enqueue explicitly reports `completed: false`; it cannot emit a publication heartbeat.
  The worker heartbeats only after publication and durable acknowledgment.
- Solved publication now also carries its source Retry-After into queued backoff.
- No database migration. Source calls remain GET-only, within the existing shared
  account leases and request budgets. Failed publication retains prior saved values.

## Validation and activation boundary

Synthetic checks cover opt-in/source binding, enqueue failure, shared cooldown,
retained retry dates after Sunday, current-only backlog, long Retry-After, stale-worker
acknowledgment rejection and completion-only heartbeats. PostgreSQL tests use a new
isolated local PostgreSQL 18 cluster. The first full run failed because the former
local test service was stopped; it did not access production.

Local validation passes 1,305 tests / 162 files on PostgreSQL 18, TypeScript and ESLint.
The checkout uses CRLF, so the global local Prettier check was rerun with automatic
line-ending recognition and passed without mass reformatting unrelated files; exact
candidate CI must still pass the repository's normal Linux formatting/build gates.

The [updated capacity model](2026-10-09-recovery-capacity-model.json) includes all four
directory invocations, which the older script could not parse. It reserves 24 outage
ticks and two collision ticks per existing invocation: 32 opportunities remain against
26 modeled jobs including optional CSAT and four legacy attempts. Six spare ticks are
planning arithmetic, not proof of sufficient throughput during prolonged throttling.
Bounded Talk continuation can require more than one attempt per week.

Production activation is separate from merging the code. It requires exact candidate
CI/build, fresh restore, scoped production canary/readback and observed recurring
recovery. Keep the new switch unset until those checks pass; do not claim the two
morning failed runs recovered merely because this code exists. Outbound recurrence,
optional CSAT recovery, human-only publishers and historical repair remain unchanged.

Rollback: unset only the new legacy recovery switch and redeploy; retained jobs remain
unclaimed, while the four original daily cron entries resume direct sync. For a code
regression, restore compatible baseline `2d9ecfa` / the deployment above. There is no
schema rollback and no whole-database restore by default. Check for newer writes before
any scoped metric reversal.

## POS update-definition evidence

One essential report definition was inspected without modifying filters, dates, metrics
or layout, then its tab was closed and closure verified. It counts distinct Updates
by updater agent, with ten selected ticket groups and two excluded channels: inbound
and outbound phone calls. It uses the Updates history dataset and displays Central
time. Exact report date bounds were not inspected in this visit.

This differs from the released Menufy update definition. The current minimized retained
event schema discards channel metadata, so it cannot yet prove these POS exclusions.
Do not reuse Menufy's count or infer unknown channels as included. Exact private report
identifiers and selected groups remain outside Git. The next POS gate is a versioned,
minimal channel-evidence reader and independent report reconciliation; no POS update
publication is enabled by this change. Zendesk was not edited.
