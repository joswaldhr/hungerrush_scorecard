# Pro scheduler rollout

The user approved the quoted $20/month Vercel Pro upgrade on October 8. The
authenticated team checkout confirms one included developer seat and $20/month
before applicable tax and metered usage. The user completed checkout directly.
The authenticated billing page now reports **Pro Plan / Active**, October 8 to
November 8, with a $20 upcoming invoice. No payment details are retained here.

## Prepared schedule

The candidate adds one cron entry, initially with recovery disabled:

```json
{
  "path": "/api/cron/report-recovery?slot=0",
  "schedule": "*/15 * * * *"
}
```

The existing route accepts this path. `slot` validates the scheduler request; it
does not select a reporting week or limit a slot to one daily invocation. The
dispatcher coalesces demand and attempts one bounded persisted job per invocation.
PR55 merged as `ba96597`; production `dpl_3zibofMBLEZUEqKTpbTWW76ndAbt`
is READY and owns the live alias with this entry. Exact candidate `72db713`
CI/build `37824469245` and master CI `37825101424` pass. Existing 16 jobs remain
unchanged until each replacement is separately verified.

A 15-minute dispatcher wake-up is **not** a 15-minute data freshness promise.
The deployed planner requests event collection every six hours and solved-credit
publication daily over the allowed four-week horizon. Optional CSAT recovery adds
four daily publications. Other families are not covered by this dispatcher.

## Capacity and cost controls

`node scripts/report-recovery-capacity.mjs` passes the offline stress model:
96 daily wake-ups, 40 remaining after modeled collisions and a six-hour outage,
18 modeled jobs without CSAT and 22 with it. The remaining 22/18 opportunities
are planning margin, not observed scheduler reliability. The 25% source-overlap
allowance and future source delivery remain assumptions. See
`2026-10-08-pro-recovery-capacity.json`.

One route would receive approximately 2,880 scheduled invocations in a 30-day
month. Idle ticks still have execution cost. Actual CPU, memory duration, builds,
and other team projects determine usage; do not promise a $20 total bill.
After upgrade, inspect usage and configure spend alerts. Do not silently enable
automatic project pausing, which could interrupt manager access, or paid add-ons.

## Verified rollout evidence

The fresh 18:32 UTC encrypted backup restored all 35 tables / 378,003 rows with
matching digests and unchanged application data after migration. An older private
helper first failed its obsolete initial-catalog-transition rehearsal on an
isolated restored copy; no production write occurred. The current tracked restore
procedure then passed. See `2026-10-08-pro-scheduler-restore.json`.

At 18:34 UTC, login returned 200, anonymous recovery access returned 401 and the
authenticated recovery route returned 200 / `enabled:false`. All 22 environment
metadata entries and 16 pre-existing cron entries are unchanged. This is manual
route verification; genuine scheduled delivery is still pending.

A separate controlled local invocation of the identical deployed dispatcher at
18:33 UTC persisted five correctly scoped jobs (collection and both teams' solved
credits for September 27 and October 4). It respected the existing source-sync
cooldown and deferred collection until 18:38:47 UTC. Ten catalog/value/fact digest
groups remained unchanged. Zero employee metric writes and zero vendor writes.
This verifies durable deferral, not completed collection/publication or cron.

## Activation sequence

1. Verify the actual team plan is Pro and inspect the selected billing options.
   Preserve the current deployment, environment metadata and policy digests.
2. Verify qualified active solved/collection policies, effective dates and current
   source cursor. Payment approval does not qualify new metric definitions.
3. Run the documented isolated recovery checks on the exact release candidate.
   Take a fresh encrypted production backup and verify its isolated restore.
4. Perform one labeled controlled dispatcher canary with exact output scope and
   independent persisted-value/revision checks. Observe deferral and continued
   progress without bypassing cooldowns. Keep optional CSAT opt-in separate.
5. Deploy the cron entry with recovery disabled first; verify a genuine scheduler
   request authenticates and returns `enabled:false` without source/metric work.
   Then enable only qualified recovery after its controlled canary and technical
   gates pass. Confirm production alias, authentication and manager reads.
6. Observe genuine scheduled requests: scheduler user agent, HTTP outcome,
   duration, linked queue/sync-run status, pinned period, source observation,
   oldest pending age and backlog direction. Manual calls are not cron evidence.
   One successful tick is not proof of a full recurring refresh cycle.

## Rollback and boundaries

Clear only the new recovery opt-in and redeploy the recorded compatible runtime
and schedule if necessary. Preserve source records, jobs and last good metrics;
check in-flight leases rather than resetting cursors or restoring the entire DB.

The current scheduled runtime is master `ba96597`, production
`dpl_3zibofMBLEZUEqKTpbTWW76ndAbt`. The rollback without the new cron is
`bf7ea0d` / `dpl_9tJxGRF9S45ad4nsGFKXhzUANDqd`. Refresh these references before activation.
Zendesk remains read-only. The demo, metric semantics, human-only suppression,
shadow/action-v2/historical-repair switches, assignments and targets are unchanged.
