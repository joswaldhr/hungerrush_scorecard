# Solved-report publication release manifest — initial canaries verified

**20:13 UTC update:** All four controlled production canaries pass: 124 employee-week
values across both teams and both initial periods, with independent exact contributing
sets/counts and unchanged unrelated-data digests. Menufy closed/current UI and actual
CSV bytes agree; the actual closed PDF renders correctly. POS's one changed closed-week
ticket is explained by fresh source state showing it unsolved. Platform logs confirm
four manual HTTP 200 invocations on the intended deployment, with no crash. These
results supersede the pending-canary state below, not the remaining genuine scheduler,
delta-capacity/revision or broader metric requirements. No new schedule is installed.
See `2026-10-07-solved-production-canaries.json`.

**19:54 UTC update:** The dated two-team catalog is committed, and the production-only
solved release policy is active on READY deployment **dpl_C3zsDWZKpLvz6HCkuxzGJCV3b5tk**,
using unchanged qualified runtime `31f4187`. All 63 prior environment entries retain
their values/targets. The first controlled Menufy closed-week canary is running; no
canary result or scheduler success is claimed yet. Immediate compatible policy-off
rollback is **dpl_G82oX6dFur4iAQUDiGRPGKYW26pE**, the same runtime with collection only.
No new schedule is installed. Preserve the new catalog/evidence during containment;
do not restore the entire production database or erase later observations.

The first catalog attempt failed a private helper's Date/string timestamp comparison
before committing. The fresh read-only census was identical afterward. After preserving
millisecond precision for both representations, a second encrypted backup/restore and
catalog transition/rollback rehearsal passed: 35 tables / 354,052 rows, all digests
matching. The successful catalog transaction preserved employee assignments, existing
metric values/facts/targets and earlier visibility, and retained exact prior assignment
rows privately. See `2026-10-07-solved-activation-restore-recheck.json` and
`2026-10-07-solved-catalog-activation.json`. The earlier inactive state below is historical.

**19:43 UTC update:** The PR46 production runtime `31f4187` on
`dpl_G82oX6dFur4iAQUDiGRPGKYW26pE` has completed the collection-only bootstrap:
139,915 events / 142 pages, exhausted through October 7 19:41:45 UTC. Eight corrected
paced batches had no additional source throttles. Fresh joins and independent
reconciliation are in progress. Solved catalog/publication/schedules remain inactive;
this is manual collection, not ongoing scheduler verification. The inactive same-code
configuration rollback remains `dpl_5RiNfm8g4tPgkVxyG4X7aQ7hqYRL`; do not resume
the old eleven-second collector pacing when using an earlier code deployment.

**18:44 UTC update:** Collection-only policy is now active on same-code production
deployment **dpl_7TAT6XQEpirG2YpeHG9rG6nMucN7**. Solved publication, catalog changes
and new schedules remain inactive. The first two manual bootstrap batches retained
25,516 events over 26 pages; the second stopped on a source rate limit and preserved
its checkpoint/cooldown. A third resumed after the cooldown, lease and running-sync
checks passed. This is incomplete collection, not complete coverage or publication.
The immediate configuration rollback is **dpl_5RiNfm8g4tPgkVxyG4X7aQ7hqYRL**.
The initial inactive release evidence below describes the earlier configuration.

PR45 merged to `376aaafed437ba42c53d447c0178e7024d4fdb52`; production deployment
**dpl_5RiNfm8g4tPgkVxyG4X7aQ7hqYRL** is READY and owns the live alias. Candidate
**82c1dea** passes exact CI/build **37665980261**, including **1,109 tests / 140 files**,
and the merge has identical runtime content. The complete isolated Preview and actual
CSV match; the unchanged PDF/PNG renderer retains its verified output evidence.
Fresh 18:26 UTC backup/restore matches 35 tables / 214,065 rows. The exact dated catalog
transition and full transaction rollback passed on the restored copy. Authenticated
live route probes return `enabled:false`; signed-in scorecard reads work. No new report
collector, publisher, production catalog change or schedule is active. Immediate
compatible rollback: `7fa4593` / `dpl_HGEAA1j1xJ8XYJLKCMKcuTUPMoKN`.

## Scope and initial periods

Publish only the two qualified report-matched solved definitions: Menufy updater
latest-solve credits (`zendesk_tickets_solved_credits`) and POS current-assignee
solved-date tickets (`zendesk_assignee_solved_tickets`). Their attribution is explicitly
different from verified human actions. Update events, escalation attribution, active
handle time and other unqualified families are not enabled by this release.

Prepare an explicit initial new-definition interval beginning September 27, 2026,
covering the last closed week and current week at release. This is an initial load of
new report-credit keys, not rewriting/relabeling existing human-only history or enabling
the historical repair feature. September 20 source evidence supports qualification but
is outside this initial publication scope. Record the effective assignment transition
and retain old definitions/values; do not silently reinterpret earlier records. If the
effective-catalog rehearsal cannot preserve those boundaries, stop that transition.

Validate the current employee/identity census again before publication (last verified:
23 Menufy, 39 POS). Resolve changed scope before comparing results. Register only the
matching team's key with its readable attribution label, count/sum/tickets semantics,
existing ticket-work category and no inherited incompatible targets. Prepare the
replacement of the old resolved-row assignment in the same catalog transaction;
preserve the old human-only values and their earlier-period visibility. Do not conceal
the separately unresolved Tickets Updated row.

## Collection and publication

- Fix the report-event bootstrap at September 26 00:00 UTC so it covers September 27
  in the source reporting timezone. Record the exact private organization/source/account
  binding. Bootstrap via labeled bounded batches after collection-only activation,
  retain every checkpoint, and stop on lease, pagination, identity or conflict failure.
- Reconcile the persisted stream plus newly fetched ticket/metric parents and explicit
  tombstones independently before enabling the updater publisher. Do not import a private
  audit capture into production and call it a live refresh. Initial batches are manual
  bootstrap evidence, not scheduled evidence.
- Set the release's timezone, groups/brands and evidence digest from qualified private
  evidence. Use the oldest dependency time and current-week as-of watermark. The planned
  daily operation allows at most 24 hours of observation age; do not mark old evidence fresh.
- Enable one team/period canary through the ordinary atomic sync service. Reconcile every
  employee's exact contributing IDs/count, verify retained revisions, and compare hashes
  of unaffected keys, periods, staff assignments and source policies before widening.

## Schedule preparation

**October 7, 20:34 UTC qualification update:** The first post-bootstrap incremental
cycle completed in one page, retaining 783 new events and reaching 20:32:53 UTC.
Thirteen digest groups, including all published values/facts, assignments, unrelated
source records and previously retained events, remain unchanged. This was a labeled
manual collection, not a scheduled execution or publication refresh. Across the eleven
fully traversed UTC days, source creation-time volume peaks at **14,219 events/day**.
The earlier 12,079/day lower bound below is superseded. One ten-page bounded invocation
per day is insufficient; the small successful delta does not qualify daily capacity.
See `2026-10-07-report-delta-verification.json`.

**The timetable below is a proposal, not yet eligible for activation.** Adjacent hourly
windows do not guarantee five-minute separation: a 08:59 invocation and a 09:00
invocation can collide with the shared source cooldown. Vercel does not retry failed
invocations. The existing source lease is week-scoped; the event collector has a
separate lease, so neither proves account-wide mutual exclusion. Before adding jobs:

- Make deferred/failed work recoverable on a subsequent bounded invocation, retaining
  its exact period and source cutoff rather than silently moving it to another week.
- Coordinate collector and publisher account access; honor durable quota and Retry-After.
- Test late/early hourly dispatch, duplicates, missed delivery, interruption, rollover,
  partial collection and stale-source refusal without weakening publication gates.
- Demonstrate capacity above the measured daily load, including overlap/late arrivals
  and a missed collection slot, and observe real scheduling after deployment.

These findings do not authorize changing metric definitions or existing qualified
CSAT/first-reply policies. The remaining scheduling fix must pass the same isolated
Preview, exact CI, recovery and controlled release gates.

The present hosting plan has hourly execution precision. Keep new daily jobs in separate
hour windows from existing work, with a full intervening hour between event collection
and its first dependent publisher. Proposed UTC slots, not yet installed:

| UTC hour | New work |
| --- | --- |
| 04 | POS solved, week 0 |
| 05 | POS solved, week 1 |
| 07 | Durable report-event collection |
| 09 | Menufy solved, week 0 |
| 11 | Menufy solved, week 1 |
| 13 | Menufy solved, week 2 |
| 15 | Menufy solved, week 3 |
| 17 | POS solved, week 2 |
| 19 | POS solved, week 3 |
| 21 | Report-event collection / retained continuation |
| 23 | Report-event collection / retained continuation |

The additional collection windows are proposed after the October 7 pacing correction:
the first corrected invocation retained 9,988 events / ten pages, while fully traversed
source days already contain up to 12,079 events by creation time. One observed daily
batch therefore cannot be assumed sufficient. These entries are not installed; confirm
delta throughput and rate-limit recovery before activation.

Offsets before the initial effective Sunday skip publication. Collection must complete
within the bounded daily capacity under the observed event rate; measure this during
bootstrap and subsequent deltas before installing this schedule. An incomplete bootstrap
is not permission to advance its start date. If daily deltas outgrow one invocation,
resolve collection capacity explicitly before claiming reliable scheduled operation.
Concurrent reads from unrelated integrations are outside this worker's lease; respect
source quota/Retry-After and preserve the last publication on failure.

Vercel's [current documented project limit is 100 cron jobs](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan),
so these eleven proposed entries plus the existing sixteen do not require a plan change
for job count. Verify actual project scheduling eligibility at release; this does not
establish execution timing, account quota or sufficient runtime.

## Required gates and recovery

1. Exact CI/build for the complete candidate; full synthetic PostgreSQL publication,
   rollback/concurrency and authenticated disabled/invalid-route checks.
2. Runtime-identical isolated synthetic Preview; complete collection-to-publication
   rehearsal plus stable visible/history/export results. Both new policies must be
   blank in main Preview; no real source credentials or fixture data in production.
3. Fresh encrypted backup/restore with matching row digests immediately before production
   writes, exact pre-release catalog/config census and compatible deployment rollback.
4. Deploy with new policies inactive, rehearse/catalog/read back the exact new-key scope,
   then collection-only bootstrap, independent reconciliation and scoped publication canary.
5. Verify the live alias/SHA, authentication, manager scope and representative read/export
   behavior. Install the qualified schedule and observe genuine scheduler user agent,
   HTTP outcome, duration, reporting interval, checkpoint and metric revision evidence.

Clearing the affected new policy and redeploying stops new collection/publication. Preserve
source/checkpoint/revision rows. Restore only affected catalog/value scope from checked
predecessors if needed, fencing newer writes. Do not perform a full-database rollback or
undo unrelated qualified work. Keep the frozen demo, CSAT/first-reply policy, Zendesk,
human-action shadow/v2 and historical repair untouched.

Recheck active cron configuration when rolling back. Vercel's current
[management documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs), checked
October 7, states that Instant Rollback restores the selected deployment's cron
definitions for subsequent invocations. Already-running work is not canceled by a
deployment. Verify the actual resulting schedule and in-flight runs; do not rely on
older notes asserting that rollback never updates cron configuration.

This manifest is a proposed scoped release sequence. It does not record production
activation or completion of the wider metric acceptance matrix.
