# Manager report definition review

September 28. The user explicitly permitted brief inspection of existing report
definitions, with no edits and prompt closure. Reports were inspected one at a time;
no formulas, filters, attributes, settings or permissions were changed and nothing was
saved or applied. All Zendesk inspection tabs were closed afterward. Private report
identifiers and source rows remain outside Git.

## Observed definitions

| Report | Saved definition observed | Consequence for Cadence |
|---|---|---|
| Menufy inbound call reporting, last week | Offered = distinct accepted + declined + missed + unreachable call legs; rows use leg agent. Call date, group, direction, voice number and leg completion status are filters. | The inactive candidate's accepted + missed + declined subtotal is not this report's current offered definition. Resolve the complete filter scope and version the offered policy before publication. |
| Same Menufy inbound report | Talk time uses SUM leg seconds; hold time uses MAX leg seconds. | These are not employee average durations. Matching those report cells cannot certify Cadence averages. |
| Menufy percent tickets solved, last week | Distinct agent updates, distinct tickets solved and a solved-percentage calculation; rows use updater agent. Update date, brand and group filters. | Update events and distinct tickets are different populations. The report does not establish verified human activity. The full selected group set was not established. |
| POS ticket audit | Distinct updates by updater agent; update-date/group/channel filters. Inbound and outbound phone update channels excluded; web service not excluded. | Phone exclusions alone do not prove a human performed an update. Keep the approved human-only qualification requirement. |
| Alex's agent call audit | Distinct calls by call agent name, with call date and custom POS agent scope. | Call-level agent attribution is not the same as employee leg participation. No linked dashboard was shown; current operational use remains unverified. |
| Older agent updates/elevated-ticket report | Distinct updates and distinct ticket IDs with a custom elevation checkbox set; rows use updater. | A ticket's checkbox does not prove that the employee performed the elevation. The older report's current relevance is unverified. |

The Menufy dashboard opened on September 20–26 (last week); the POS dashboard opened
on a last-30-days interval. Both displayed Central time. Those default windows must
not be compared directly with Cadence's current Sunday–Saturday week.

## Qualification implications

The earlier September 25 retained-report comparisons remain evidence only for their
specific exports and filters. The newly observed four-component offered formula
supersedes a general claim that all inspected reports exclude unreachable legs. There
is no report-version evidence establishing whether a formula changed over time or a
different filter/report produced the earlier population.

Next inbound work must retain accepted, declined, missed and unreachable sets separately,
bind the selected subtotal to an explicit definition, verify the exact saved scope,
and independently reconcile current and retained closed-period populations. No inbound
publisher is activated by this inspection. Duration means require their own numerator
and measured denominator; no SUM or MAX field is silently relabeled an average.

Report agreement is one comparison, not proof of employee attribution or source
completeness. Human ticket metrics, shadow ingestion, action-v2 publication and
historical repair remain disabled pending their separate evidence gates.
