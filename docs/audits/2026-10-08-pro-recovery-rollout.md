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
route verification. The first genuine scheduled request is recorded below.

A separate controlled local invocation of the identical deployed dispatcher at
18:33 UTC persisted five correctly scoped jobs (collection and both teams' solved
credits for September 27 and October 4). It respected the existing source-sync
cooldown and deferred collection until 18:38:47 UTC. Ten catalog/value/fact digest
groups remained unchanged. Zero employee metric writes and zero vendor writes.
The continuation collected ten pages, yielded at its request budget, then resumed
and collected one final page. All ten protected digest groups stayed unchanged.
This is controlled collection, separate from cron evidence.

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

The activated runtime is master `ba96597`, production
`dpl_D4Ff1Txjjnqn2ue7KALjn8nLDgde`. The earlier disabled-schedule deployment
`dpl_3zibofMBLEZUEqKTpbTWW76ndAbt` is the immediate compatible application rollback. The rollback without the new cron is
`bf7ea0d` / `dpl_9tJxGRF9S45ad4nsGFKXhzUANDqd`. Clear the added environment flag as well before a later rebuild; rolling back an
existing deployment alone does not remove the project-level flag.
Zendesk remains read-only. The demo, metric semantics, human-only suppression,
shadow/action-v2/historical-repair switches, assignments and targets are unchanged.

## October 8 activation checks

At 18:45:21 UTC the actual scheduled request returned HTTP 200, identified itself
as `vercel-cron/1.0`, and completed in 372 ms (385 ms response duration). Vercel
reported no outgoing requests; the exact deployment still had recovery disabled.
See `2026-10-08-pro-scheduler-first-tick.json`.

The controlled publication attempt selected the permitted Menufy updater-solved
job for September 27–October 3. The private verifier initially expected POS first;
that ordering assumption was wrong because the final tiebreaker is the durable
job key, not a kind label. Activation stayed disabled until the actual result was
independently checked. No additional publication was triggered to satisfy the test.
All 23 values match independent reconstruction of 4,106 contributing events,
including two numeric zeros. Nine catalog digests are unchanged. All 69 predecessor
source/fact/value revisions were retained; reconstructing the full before-state
value/fact digests and the prior unrelated-source digest matches exactly. This
establishes scoped persistence and retained-source calculation, not a same-cutoff
Explore export. See `2026-10-08-pro-recovery-publication-canary.json`.

Only `ZENDESK_REPORT_RECOVERY=1` was added to Production. Optional CSAT recovery
remains absent. The identical master SHA `ba965977ac6ee4411a0650470876b69a68af01f6`
is deployed as `dpl_D4Ff1Txjjnqn2ue7KALjn8nLDgde`, READY with the production
alias verified at 18:55 UTC. All 17 cron definitions and the prior 22 environment
metadata entries are unchanged. Login returned 200 and anonymous recovery access
returned 401. The authenticated production scorecard reloaded successfully.
The first enabled scheduled publication is verified below.

A browser tab open across the earlier deployment encountered a stale Server Action
404. Full reload restored the scorecard successfully. This is a client/deployment
transition follow-up, not a production metric or database failure. Manager-own-login
and newly downloaded PDF/PNG/print acceptance are still separate outstanding checks.

## First enabled scheduled publication

At 19:00:21 UTC (2:00 PM Central), Vercel's actual `vercel-cron/1.0` request to
production `dpl_D4Ff1Txjjnqn2ue7KALjn8nLDgde` returned HTTP 200 in 74.1 seconds.
Its queue claim at 19:00:23 correlates with the 19:00:24-19:01:34 completed sync.
All 39 POS solved-ticket values for September 27 through October 3 match an
independent reconstruction of 1,410 contributing ticket IDs. All 117 predecessor
revisions match, and all 12 unrelated digest groups remain unchanged. Zero sync
errors, zero queue failures and no active/stale job lease at the post-run check.
No active-route manual HTTP request was used for this evidence.

The closed review week has now refreshed both qualified solved-report cohorts:
23 Menufy employees in the controlled canary and 39 POS employees in the genuine
scheduled run. These are different execution types and are recorded separately.
Two current-week publication jobs remain queued for subsequent regular ticks.
The next six-hour collection window and a full recurring day are not yet observed.
See `2026-10-08-pro-recovery-first-enabled-tick.json`. This release enables ongoing
qualified solved-credit collection/recovery; it does not resolve ticket-update,
remaining call/handling/backlog definitions, roster lifecycle, or all export gates.
