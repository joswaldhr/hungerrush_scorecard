# Independent roster schedule — October 9

The default-off roster worker already validates its source/mappings, uses bounded
GET discovery, records candidates for review, and commits observation/candidate/run
results together. It cannot auto-approve employees. Separating it from the legacy
metric cron prevents a metric fetch failure from also skipping employee discovery.

This increment installs one daily `/api/cron/roster` slot at 16:10 UTC. That preserves
the original daily frequency and leaves ten minutes after the existing 16:00 metric
slot, whose hosted invocation is bounded to five minutes. The worker remains inert
without the source-specific `ROSTER_DISCOVERY_SOURCE_ID`. A schedule declaration is
not activation or proof that it ran. Independent directory account checks remain a
different source and do not determine employment status.

The shared Zendesk client now specifies GET explicitly, preserving its existing
method semantics and redirect rejection. A first controlled roster canary stopped
before any vendor request because the private safety harness rejected the client's
previous implicit GET. The worker recorded failure and retained its cooldown. No
candidate, employee or metric change occurred; the retry must respect that cooldown.

The review found that spacing the schedule alone did not prevent contention with
metric readers. The worker now acquires the same account lease, respects a retained
source cooldown before reading, persists throttling, and rechecks ownership within
the atomic observation transaction. Publication locks the account before the source.
Failure bookkeeping still completes if lost ownership prevents cooldown persistence;
that condition is reported separately instead of leaving the run marked running.

Focused PostgreSQL regressions cover competing ownership, inherited cooldown,
throttling propagation, expired ownership and failure bookkeeping. No employee
assignment or metric publication is added. A deferred daily run still waits for a
later invocation: this route does not itself enqueue automatic retries. Do not treat
the new schedule as durable roster recovery or activate legacy recovery on that basis.

Before activation: pass exact CI/build and fresh encrypted restore, complete a
review-only production canary with protected-data digests and independent source-to-
observation set comparison, then bind the production-only source and redeploy. Keep
legacy metric recovery off until independent roster scheduling is verified. Check
the actual scheduled request and durable run separately from the controlled canary.

Rollback: remove the source opt-in and redeploy, returning discovery to the legacy
current-week cron. Remove or leave the now-inert roster schedule as appropriate.
The additive run/observation records and manager archive history are retained.
No unattended archive, restore, transfer or employment-status change is introduced.

The revised capacity model includes this additional daily invocation and still
reserves the modeled six-hour outage/collision allowance. Its arithmetic does not
prove source quotas or continuing successful execution.
