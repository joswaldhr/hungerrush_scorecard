# First-reply correction and acceptance gates

Release status: PR29 is deployed. One controlled production publication independently
verifies all 23 Menufy values and exact source sets, preserving legacy facts, 19 previous
values, all other metrics and earlier periods. Current/history and actual CSV/PDF/PNG
exports pass. The sequence below records the release design; genuine scheduled execution
and target qualification remain open. See the authoritative implementation ledger.

The response-time defect is a population error as well as a labeling problem. The old
collector requires tickets to be created and last updated in the week. A later update
can remove a ticket from that historical population. Long native business durations are
not automatically incorrect and must not be capped or treated as active effort.

## Contract and qualified observations

`zendesk-created-current-assignee-first-reply-business-v1` measures the arithmetic mean
of native Zendesk first-public-agent-reply business minutes on tickets created in the
Sunday–Saturday America/Chicago interval. It uses the configured groups/brands and current
assignee at observation time. Null durations are excluded; reported zeros are included.
It is ticket service time, not the employee's authorship, all-reply average or active effort.
No manager-specific business-hours mean report has been established: the accessible
first-reply-by-group report is a calendar-hours median and is not a matching benchmark.

The complete read-only Menufy collection covers all 23 active employee identities:

| Period | Cohort tickets | Measured | Missing duration | Reported zero |
|---|---:|---:|---:|---:|
| September 13–19 | 4,023 | 1,675 | 2,348 | 921 |
| September 20–26, provisional | 2,614 | 1,126 | 1,488 | 480 |

All 46 employee-period cases match independent raw-field reconstruction: exact cohort and
measured ticket IDs, unrounded sums, denominators and means. One shared bounded reader made
180 GETs in 180.634 seconds including the complete staff census; the periods used 108 and
68 logical requests respectively. These observations are sequential vendor reads, not an
atomic Zendesk snapshot. Current assignees do not certify historical employee membership.
The earlier retained four-case UTC/Central comparison also matches with zero differences.
Aggregate evidence is in the companion candidate-replay and live-qualification JSON files.

## Publication design

- Use a dedicated `first_reply_summary` record. Do not replace the shared legacy
  `agent_stats` payload or delete sibling facts. Keep old response-time facts intact.
- When exactly one validated first-reply snapshot is present for a metric/employee/source/
  interval, explicitly select it and record the superseded legacy fact IDs in provenance.
  Only unversioned `agent_stats` contributors may be superseded. Unknown or duplicate
  replacement contributors abort publication. Null replacement values cannot fall back
  to a plausible legacy number. Subsequent legacy refreshes retain the qualified result.
- Preserve full precision, source scope, sample/cohort counts, conservative observation
  time and calculation version 2. Team/identity changes during collection reject the batch.
  Existing value revisions retain predecessor evidence. Other weeks and metrics are unchanged.
- Current/history/revision/export labels follow the stored contract. The new label is
  Avg First Reply — Business Time, with sample coverage in data details and H:MM:SS display.
  Incompatible previous-week comparisons and unqualified targets remain withheld.
- The separate authenticated route requires an explicit private source/team/account policy
  and Sunday cutover. It validates minute/duration/average definition compatibility before
  fetching. The shared source lease, cooldown, global 240-GET/240-second deadline and
  all-or-nothing publisher remain in force. No retries or partial publication are introduced.

## Release sequence and rollback

1. Complete source-adapter, PostgreSQL preservation/null/replay/reassignment tests, full CI
   and an actual hosted synthetic publication. Verify current/history/exported bytes.
2. Obtain a new production backup and exact restore rehearsal after the CSAT release.
   No new schema migration is needed. Verify no active publisher and recheck assignments,
   source binding and policy at the reviewed revision.
3. Activate only the assigned Menufy metric from September 20. Keep four daily one-week
   invocations separate from the 06 UTC original sync and 08/10/12/14 UTC CSAT windows;
   use 16/18/20/22 UTC for offsets 0–3. Earlier periods return a skip. The hosting plan's
   hourly precision and five-minute source cooldown still apply.
4. Run one labeled controlled current-week publication and independently reconcile all
   stored values and exact source sets. Record its HTTP outcome, duration, scope and
   retained revisions. This does not establish genuine scheduler execution.
5. First containment is disabling the first-reply policy: collection stops and the last
   verified snapshot remains visible with its original freshness. Do not remove the selector
   while replacement facts remain. A full return to legacy requires a guarded transaction
   capturing the candidate facts/values as revisions, removing only the qualified first-reply
   contributions for the reviewed scope, and republishing the retained legacy response facts.
   Restore code/policy and cron entries together. Preserve all unrelated and intervening
   writes; never restore the whole older backup as routine rollback.

Human ticket counts, shadow ingestion, action-v2 publication and historical repair remain
disabled. Source arithmetic is qualified; production activation, hosted rendering/export,
targets and genuine scheduling are separate acceptance gates, not implied by these tests.

Primary definitions: [Zendesk ticket metrics API](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_metrics/)
and [Zendesk reply time](https://support.zendesk.com/hc/en-us/articles/4408821871642-Understanding-ticket-reply-time).
