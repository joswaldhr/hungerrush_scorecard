# Durable roster retry candidate — October 9, 2026

The direct daily roster route could lose that day's observation after an account
collision, cooldown or interrupted invocation. This candidate adds a separate,
default-off `ROSTER_DISCOVERY_RECOVERY` flag. It delegates the same 16:10 UTC daily
demand to the existing persistent dispatcher; no schedule is added or changed.

Scope: review-only roster discovery and operational queue health. No metric family,
source policy, employment status, employee assignment, vendor data, production
configuration or demo is changed. The worker retains shared account coordination,
request bounds and atomic source/mapping/assignment checks. A queued invocation also
rechecks its expected organization/source/account before creating a run.

The roster job has no metric period. One daily demand coalesces missed deliveries and
days; a later successful observation cannot recreate historical membership. Completion
acknowledges only the claimed generation. Interrupted queue leases expire; long vendor
cooldowns remain intact; a busy recent roster run defers ten minutes. Lost acknowledgment
can cause an eventual repeated observation, so this provides at-least-once recovery,
not exactly-once vendor reads. Direct cron delegation avoids simultaneous daily/queued
collectors, and the existing account lease fences other source workers.

Capacity: enabling every family creates seven active policy hashes and 22 current
requests (collection + eight solved periods + four CSAT + four first-reply + four legacy
+ one roster). The retained conservative model has 30 daily opportunities after its
collision/outage allowance. Its 18 stressed base jobs plus four each for CSAT, legacy
and first reply plus one roster require 31 opportunities before extra failures: that
unadjusted model fails by one. Removing delegated direct collectors may improve the
collision allowance, but requires measured traces; do not enable all families from
request-count arithmetic. Roster-only recovery adds one daily attempt plus measured
retries to the already active workload. Measure queue age, source cooldown, duration,
missed demand and actual scheduler completion before activating or broadening.

Validation is recorded by the implementing agent in the handoff. Production activation,
exact CI, hosted release and real scheduler behavior remain unverified for this candidate.
Only code, synthetic tests and aggregate documentation belong in the public commit.

Local validation: 107 distinct focused tests passed across planner, cron routes,
dispatch adapter, real PostgreSQL job persistence, source ownership, roster reconciliation
and health. Checks cover the full seven-family plan, duplicate delivery, 48-hour cooldown,
interrupted ownership, new daily demand during an older run, disabled/rebound sources,
stale mappings/assignments, review-only publication and exclusion from manager metric rows.
TypeScript, scoped ESLint and `git diff --check` pass. Tests use only the explicit
loopback `cadence_test` database and synthetic fixtures; no shared `.env` is loaded.
