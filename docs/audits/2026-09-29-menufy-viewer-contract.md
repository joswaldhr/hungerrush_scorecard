# Menufy viewer contract findings

September 29, 2026. Authenticated navigation reached the manager-owned agent-audit
dashboard's **1x1 / Last Week** view. The selected interval is September 20–26 and
the reports display Central Time. This resolves the earlier sign-in blocker.
Only viewer navigation, keyboard-focused filter tooltips and ordinary download controls
were used. No report/dashboard editors, saves, configuration or source API calls.
The dashboard remains open in viewer mode; no date/agent filter was changed.

## Confirmed scope

The tooltip selections below are observed values, not inferred from populated rows.
Private names, numbers, dashboard identifiers and exact selections are retained outside
Git. Group counts are not interchangeable business scopes.

| Report family              | Observed selection                                                              | Date basis                                 |
| -------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------ |
| Inbound calls              | Four call groups, three phone lines, Inbound direction, six completion statuses | Call created date                          |
| Outbound calls             | Six ticket groups, Outbound direction                                           | Call created date                          |
| CSAT                       | Five ticket groups                                                              | Ticket solved date                         |
| Ticket-update/solved ratio | Six ticket groups and the Menufy brand                                          | Ticket update date                         |
| Time in State              | Talk channel and two support groups                                             | Omnichannel agent daily time-in-state date |

All five date tooltips explicitly show September 20–26. The six selected inbound
statuses are Agent declined, Agent declined transfer, Agent missed, Agent unreachable,
Completed and End user hung up. Preserve the distinction between a **call group** and
a **linked ticket group**; applying one shared team filter would change report meaning.
Present-day group ID/identity mapping and historical membership were not re-fetched.

The existing first-reply/CSAT/outbound policies must be compared to these scopes before
any change. A current viewer observation does not authorize rewriting their recorded
closed-week contracts, and does not establish when a report's scope changed.

## Meaning that must survive implementation

- **Offered:** the retained inspected formula includes accepted, declined, missed and
  unreachable distinct agent legs. The current viewer exposes all four components.
  Repeated offers on one call remain leg attempts, not distinct customer calls.
- **Answer percentage:** calculate accepted/offered from the same qualified sets,
  then format the percentage. Zero offers has no sample; do not display an invented 0%.
- **Talk and hold:** retained inspected definitions use SUM talk and MAX hold. They
  cannot certify Cadence's average fields. The currently visible outbound table has
  a Talk duration column. Complete current inbound output was not obtained; do not
  infer that its column inventory still matches the older downloaded report.
- **State time:** the viewer shows Away, Online, Transfers only and Sum. Two visible
  rows' arithmetic confirms Sum includes Online; it is not the template's Away plus
  Transfers-only measure. Keep those two durations and their combined value separate.
- **Tickets updated:** the report's update events remain different from distinct
  verified-human-worked tickets. Correct filter selection does not resolve attribution.

The dashboard also contains diagnostic missed/unreachable/invalid-decline and
controllable-call panels. These are not evidence that a particular agent intentionally
avoided work, and are not silently added to the 1:1 requirement or used for judgments.

## Historical state data: source identified, automation unresolved

The observed date field identifies the **Agent state daily** reporting surface. Zendesk
documents daily aggregation, viewer-timezone reporting, and group membership changes
appearing the next day. It warns that agent totals can repeat across groups and states
across channels. The two-group filter therefore needs a deduplication/membership check;
it does not by itself prove that this saved report is wrong. The source's reload history
can limit retained daily data to 90 days. See the official
[state dataset definitions](https://support.zendesk.com/hc/en-us/articles/5600290657434-Metrics-and-attributes-for-agent-state-activity-and-productivity).

The documented [Agent Availability API](https://developer.zendesk.com/api-reference/agent-availability/introduction/)
provides real-time status/activity. The [Talk Stats API](https://developer.zendesk.com/api-reference/voice/talk-api/stats/)
provides current-day counters. Neither establishes a supported last-week daily-state
history reader for this project. No documented historical endpoint was identified in
this review; this is a capability gap, not proof that Zendesk has no possible interface.

Official [dataset export documentation](https://support.zendesk.com/hc/en-us/articles/6037992005914-Exporting-datasets-from-Explore)
does not list Agent state daily among its supported dataset choices. Do not promise
that creating a generic dataset-export job will solve it. No job or schedule was created.

The supported report/dashboard export remains a comparison route. CSV and Excel
downloads were each attempted once from the viewer, but neither produced a download
event or a new file in Downloads. No hidden export API or session extraction was used.
The [export documentation](https://support.zendesk.com/hc/en-us/articles/4483481898266-Exporting-dashboard-tabs-and-reports)
also distinguishes raw CSV from formatted output and notes the row limit; completeness,
scope and units must be checked against the actual file, not assumed from a screenshot.

## Retained-source replay

The three observed inbound line values exactly match the private retained scope. Using
the explicit six-status selection changes **zero rows, selected legs, offered counts or
duration results** across 56 older report row-weeks (September 6–12 and 13–19), compared
with the same four-component calculation without a status filter. All 56 computed answer
ratios are within range. This is sensitivity/invariant evidence, not new report parity.
The previously recorded 448 legacy report comparisons remain their separate evidence.

See [aggregate replay](2026-09-29-menufy-viewer-scope-replay.json) for source digests and
limits. No source records, employee rows or phone numbers are committed. September 20–26
all-employee reconciliation, effective eligibility, source freshness, target compatibility
and scheduled operation remain open. Certification counts are unchanged.

## Concrete delivery path

1. Bind the newly observed inbound scope to private verified group IDs and the explicit
   status/definition version. Reconcile all eligible employees against a complete
   September 20–26 viewer export and complete source records. Do not enable the publisher
   from the older sensitivity replay alone.
2. Ship offered/answered/declined/missed with their source sets, and add answer percentage
   and total-talk measures as correctly named fields after separate acceptance. Preserve
   existing average metrics and their own denominators; never rename SUM into AVG.
3. Treat weekly state durations as a separate dependency. Obtain a complete existing
   report export or a documented supported history feed, validate channel/group duplication,
   identity and dates, then reconcile Away and Transfers Only separately. An explicit file
   import can bridge the gap but cannot be described as the final zero-preparation workflow.
   No Zendesk schedule/configuration changes are authorized in this work.
4. Reuse released CSAT/outbound evidence while checking the confirmed family-specific
   scopes and closed-week provenance. Keep human ticket metrics unavailable until actual
   human provenance is established. Report matching cannot override that policy.
5. Release one qualified family through the existing isolation, recovery, hosted and
   operational gates. Demo, POS, Assembled and historical repair remain outside this change.

This pass changes evidence and qualification scope only. It is not an application
deployment or a claim that the complete meeting pack is ready.
