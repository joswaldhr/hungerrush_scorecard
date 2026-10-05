# Roster lifecycle completion and rollout

This is a completion plan, not a claim that lifecycle automation or all metrics are live.
The implementation ledger owns release state. The October 5 read-only census verifies all
39 active POS and 23 active Menufy employees in configured Zendesk groups. Six pending POS
additions also match active Zendesk agents and enabled directory accounts. They have not
been added. One POS directory reporting relationship and one disabled Menufy directory
account remain exceptions; neither justifies automatic removal.

## Authority and meaning

Use the configured Zendesk groups as observed operational membership, with their explicit
Cadence team/line mappings. Directory hierarchy is supporting evidence: immediate reports
alone exclude the existing agent cohort, while supervisor-level relationships match 61/62.
Source observations do not establish employment termination or historical membership dates.
The final authority for unattended changes is not yet confirmed. Until it is, discover
proposals without changing employees. Do not infer authority from login eligibility.

## Required behavior

| Case | Required result and acceptance check |
|---|---|
| New employee | Unique active agent, unambiguous team/line and normalized identity; create exactly one employee, binding and effective-dated membership atomically. Existing employees go to match/review, never duplicate creation. |
| Team transfer | Keep employee ID and metric/meeting history. Close only the prior relevant membership and open the new one at a documented prospective date. Recheck manager visibility and other active memberships. Conflicting group mappings remain unresolved. |
| Returning employee | Reuse the inactive employee and source binding after identity confirmation. Start a new membership interval; never rewrite the archived interval or backfill eligibility from today's group. |
| Team departure | Treat disappearance as a proposal. Require consecutive complete successful observations separated in time, a grace period and no conflicting active assignment. Thresholds need an explicit policy. Missing pages, quota failures or disabled accounts alone cannot qualify. |
| Stale departure proposal | Withdraw it when a complete observation sees the person again; preserve the proposal and withdrawal evidence. An approval racing reconciliation must revalidate the same source/evidence version. |
| Stale new/transfer proposal | Refresh changed suggestions; withdraw a proposal no longer supported. Preserve explicit human rejections. A later distinct observed change may create a new proposal with its own evidence. |
| Bulk anomaly | Hold the whole affected batch for review. An empty source roster, mass removal or mapping change must never archive the team. |
| Archive and access | Hide only the appropriate active roster membership; retain historical reporting and meeting records according to existing authorization. Leaving one team is not automatically global inactivity if other memberships remain. |
| Failure/retry | Retain last good roster, never publish partial observations, recover expired workers, and do not make metrics appear refreshed. Repeating a successful observation is idempotent. |

## Implementation sequence

October 5 follow-up: steps 3 and the administrator-reviewed portion of step 4 are now
implemented in candidate `8e9f080` (full CI `37346587135`). Migration 0017 retains complete
observations; proposals withdraw/refresh, known identities transfer/return, and reviewed
departures preserve history. Fourteen new lifecycle regressions cover these paths. Approvals
expire after 36 hours or incompatible newer evidence; other memberships/empty rosters block
archival. Automatic archival, repeated-absence policy, exception resolution and independent
scheduled activation remain unimplemented/inactive. The existing Railway staging connection
was recovered and the isolated staging migration through 0017 completed. Main Preview
`75daee2` / `dpl_9kdMDHkAQdg3TNfiFYTQZ7X5T1v2` is READY for user scorecard testing.
Three synthetic lifecycle proposals were created successfully, remained pending and were
cleaned up with the temporary staging admin role. Browser control became unavailable before
hosted approval checks; those checks and post-transition visibility remain release gates.
See `2026-10-05-main-preview-live-test.json`; ordinary manager fixtures remain available.

1. **Identity safeguards implemented in candidate:** normalized Zendesk comparison, ambiguity
   rejection, existing-employee preservation and serialized new-candidate approvals. Connector
   discovery has request/time limits and immediate rate-limit deferral. Full CI passed for
   commits `a761dbd` and `f71460b`.
2. **Independent discovery implemented in candidate:** review-only worker, separate run health,
   atomic candidate/run completion, source validation, cooldown and expired-run fencing.
   Migration 0016 is additive. It has no scheduler entry or enabled environment policy.
3. **Add durable observation and proposal validity:** retain the complete observed roster's
   identity/team/line evidence privately in the application database, source/configuration
   version and timestamps. Link proposals to observations and revalidate approvals against
   the latest complete compatible observation. Current candidate rows alone are insufficient
   for consecutive absence, transfers or fresh approval guarantees.
4. **Implement transfers/returns and stale proposal reconciliation:** use explicit transition
   types and a domain transaction shared by automated and manual paths. Preserve employee IDs,
   identity history and effective-dated memberships. Record who/what applied each transition,
   source evidence, prior state and reversal scope. Do not repurpose a human rejection to mean
   automatic withdrawal.
5. **Expose roster health and exceptions:** separate last complete observation, pending changes,
   failures and unresolved identity/mapping conflicts from metric freshness. Explain paused
   automation without suggesting employee fault. Verify administrative scope and accessibility.
6. **Release in stages:** exact-candidate CI, isolated synthetic Preview, fresh restore/migration
   rehearsal, source-scoped review-only canary, then a genuine scheduled observation. Compare
   proposed changes with the source and current assignments before unattended additions.
   Enable transfers/returns and archival separately only after their own policy/tests pass.

## Acceptance and rollback

Use real PostgreSQL tests for concurrency, rollback and repeated observations; synthetic
cases must include shared email, email case changes, duplicate IDs, disabled directory account,
group overlap, removed mapping, partial pagination, zero members, leave/return, transfer and
two simultaneous reviewers. Verify that unrelated employees, metrics, historical memberships
and meeting records do not change. Test manager access before/after each effective transition.

The independent worker currently fails closed and proposes only. Its run completion is not
roster certification. Roll back its activation by removing the independent schedule and
source opt-in together; retain run evidence. Future applied lifecycle changes need a scoped
inverse transition that checks for newer changes, not a full-database restore.

## Separate metric release track

Roster coverage establishes who must be checked, not the correctness of their metrics.
For each manager, employee, metric family and week, record source contract, expected and
observed source sets, missing/extra records, sums/denominators, freshness, published values
and display/export agreement. Unknown and legitimate zero remain distinct. Require zero
unexplained differences, including two closed weeks where source history exists and a
current-week check, before widening the family.

Current priorities are qualified call refresh/retention and canaries, POS inbound report
semantics, and human activity attribution. Last week's POS outbound observation predates
the end of that week; existing values cannot establish completeness. The disabled new
publication policies, human metric withholding and historical-repair restrictions remain.
Neither manager has a certified complete metric set. See `2026-10-05-pos-readiness.md`.
