# Metric acceptance ledger

September 25 live investigation. Denominator: **23 assigned keys / 40 team assignments**.
This increment certifies **0 of 40 assignments for production under the new report contracts**.
That does not undo prior infrastructure/display validation. A sample match is not full
qualification; disabled metrics are not counted as complete. Evidence and private snapshot
locations are described in `2026-09-25-zendesk-live-findings.md` and the local investigation
scratch area. Current production contract versions remain unchanged.

Status abbreviations: D = definition discovery; R = independent reference in progress;
B = source/attribution dependency. All rows still require applicable source coverage,
automated reconciliation, target review, staging/UI/export and production checks.

| Metric key | Assignments | State | Finding / next acceptance requirement |
|---|---:|---|---|
| avg_call_duration_inbound | 2 | D | Separate whole call from employee leg duration; inspect intended denominator |
| avg_consultation_time_inbound | 2 | D | Verify consultation source and whether zero/non-consulted calls belong in denominator |
| avg_handle_time | 1 | B | Current value is full-resolution elapsed business time; active effort source not established |
| avg_hold_time_inbound | 2 | D | Manager report includes MAX leg hold; do not replace requested average with maximum |
| avg_hold_time_outbound | 2 | D | Verify leg basis, completed/unanswered inclusion and transfer attribution |
| avg_response_time | 1 | R | Independent creation census exposes last-update exclusion and timezone differences; target/name contract pending |
| avg_talk_time_inbound | 2 | D | Manager report sums leg talk; scorecard average needs explicit leg/count denominator |
| avg_talk_time_outbound | 2 | D | Verify outbound report aggregation, zero policy and agent-leg attribution |
| avoidable_worked_elevated_tickets | 2 | B | Team-specific fields differ; work attribution and history unresolved |
| backlog_count | 1 | R | Snapshot measure; compare matched observation time and exact status/group scope |
| csat_response_rate | 1 | R | All 23 Menufy report rows match for two weeks; one exact ticket set matched; full set/release qualification pending |
| csat_score | 2 | R | Menufy 46 row-week numeric matches; POS 64 exact good/bad matches after correcting the temporary date filter (saved Last Week report actually uses 30 days). Seven active identities across both teams have no eligible ratings/denominator. Full set/release qualification pending |
| declined_calls | 1 | R | Menufy 30/30 first-week rows match distinct declined plus transfer-declined legs; full source sets and second week pending |
| inbound_calls_abandoned_on_hold | 2 | R | Menufy 30/30 participation counts match; custom formula does not identify responsibility at hang-up. POS contract differs |
| inbound_calls_accepted | 2 | R | Menufy 30/30 rows match distinct completed agent legs with positive talk; zero-talk completions are excluded. POS qualification pending |
| inbound_calls_offered | 2 | R | Menufy 30/30 rows match accepted + declined + missed legs; unreachable excluded from this report. Full release gates remain |
| missed_calls | 1 | R | Menufy 30/30 distinct missed-leg counts match Central call-date scope; full source sets and second week pending |
| outbound_calls | 2 | D | Outbound leg agent report found; exact count and filtering pending |
| outbound_calls_completed | 2 | D | Verify accepted/completed semantics and repeat legs per call |
| outbound_calls_non_answered | 2 | D | Failed whole calls alone do not define all unanswered employee attempts |
| tickets_resolved | 2 | B | Verified-human policy retained; audit child provenance and historical eligibility unresolved |
| tickets_updated | 2 | B | Report update-event counts may differ from selected distinct-ticket contract; do not silently change policy |
| worked_elevated_tickets | 2 | B | POS field choices do not match current Menufy tag pattern; work event attribution unresolved |

`first_contact_resolution` and `schedule_adherence` are active definitions but have zero
current assignments. They remain in inventory and are not counted in the 40-assignment
denominator. Their sources/meaning require qualification before assignment/activation.

Agent ownership for every next action: this task, under existing user execution authorization.
No manager communication or routine approval request is required to continue read-only
discovery or diagnostic implementation. A genuine missing source/access dependency must be
documented specifically, rather than inventing a number or calling it complete.
