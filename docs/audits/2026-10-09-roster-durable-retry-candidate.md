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

Release preparation (not activation): the October 9 17:16:13 UTC encrypted backup
restored 36 tables / 404,129 rows with matching digests; see
`2026-10-09-afternoon-release-restore.json`. Its SHA-256 is
`5bc022633557b2693383d87aee6f84c9020547fe49a3f6db561b43f748da2253`.
Revalidate freshness at the actual production change. The compatible current production
rollback is `c23d0cd06a6f8507cf66ae943e811b898763df2d`, deployment
`dpl_4KdeynCs81QJznZ5wVTYdHTa6HQx`. Initial activation, after remaining gates, is roster
recovery only; the other optional recovery families stay off. The controlled PR64 worker
canary in `2026-10-09-roster-controlled-verification.json` establishes the underlying
review-only worker's source comparison, not this new queue's scheduled operation.

Independent review: the loading/performance agent reviewed `cb16c85` against `c23d0cd`
and found no actionable code issues in default-off behavior, source binding, shared
ownership, cooldown/new-day acknowledgment, health scope or capacity guards. The final
branch also merges PR70 (`955ad8bd3820fe98fb0d9b5ce1ea7c054affdc0c`), retaining both
branches' disabled automatic-deployment entries. That integration changes no roster
semantics; exact integrated CI and isolated Preview are still separate release gates.
The 17:16 backup receipt must remain fresh at the actual release (18:16 UTC expiry).
No recovery policy has been activated by this branch update.
