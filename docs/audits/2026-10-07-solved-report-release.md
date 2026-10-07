# Solved-report publication release manifest — code live, metrics inactive

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

Offsets before the initial effective Sunday skip publication. Collection must complete
within the bounded daily capacity under the observed event rate; measure this during
bootstrap and subsequent deltas before installing this schedule. An incomplete bootstrap
is not permission to advance its start date. If daily deltas outgrow one invocation,
resolve collection capacity explicitly before claiming reliable scheduled operation.
Concurrent reads from unrelated integrations are outside this worker's lease; respect
source quota/Retry-After and preserve the last publication on failure.

Vercel's [current documented project limit is 100 cron jobs](https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan),
so these nine proposed entries plus the existing sixteen do not require a plan change
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

This manifest is a proposed scoped release sequence. It does not record production
activation or completion of the wider metric acceptance matrix.
