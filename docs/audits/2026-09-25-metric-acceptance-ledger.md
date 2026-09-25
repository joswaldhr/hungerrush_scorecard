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
| avg_call_duration_inbound | 2 | R | POS 55 rows match mean leg duration, with 2,012 exact leg IDs; define employee scope separately from whole-call duration |
| avg_consultation_time_inbound | 2 | R | POS 55 rows match non-null leg consultation means; preserve zero versus null and qualify scorecard denominator |
| avg_handle_time | 1 | R | Current value is full-resolution elapsed business time. Workforce access and all 62 identities now verified; solved ticket-viewing effort report exists. Units, lifetime numerator, exclusions, source sets and release remain open |
| avg_hold_time_inbound | 2 | R | Menufy report is MAX leg hold; POS repeats whole-call hold for each leg. Neither is employee mean leg hold; corrected denominator and targets remain open |
| avg_hold_time_outbound | 2 | D | Verify leg basis, completed/unanswered inclusion and transfer attribution |
| avg_response_time | 1 | R | Independent creation census exposes last-update exclusion and timezone differences; target/name contract pending |
| avg_talk_time_inbound | 2 | R | POS 55 means match with exact source legs. Menufy report sums leg talk; scorecard average requires an explicit denominator |
| avg_talk_time_outbound | 2 | D | Verify outbound report aggregation, zero policy and agent-leg attribution |
| avoidable_worked_elevated_tickets | 2 | B | Team-specific fields differ; work attribution and history unresolved |
| backlog_count | 1 | R | Snapshot measure; compare matched observation time and exact status/group scope |
| csat_response_rate | 1 | R | Both weeks match all Menufy surveyed/rated ticket IDs. Candidate passes live full-cohort parity for one week; publisher and release qualification pending |
| csat_score | 2 | R | Both-week full good/bad ticket sets match Menufy and POS. Candidate passes 118 offline cases and one live Menufy week. Publisher/version/target context and release remain open |
| declined_calls | 1 | R | Menufy 56 row-weeks match distinct declined plus transfer-declined legs; both-week exact source sets pass; publisher and target context pending |
| inbound_calls_abandoned_on_hold | 2 | R | Menufy 56 participation row-weeks match, not employee responsibility. POS on-hold label wrongly counts IVR/queue/voicemail abandonment; do not copy it |
| inbound_calls_accepted | 2 | R | Menufy 56 row-weeks and POS 55 rows match completed positive-talk agent legs. POS exact source set matches; target/period and release gates remain |
| inbound_calls_offered | 2 | R | Menufy 56 row-weeks match accepted + declined + missed legs; unreachable excluded. Full release gates remain |
| missed_calls | 1 | R | Menufy 56 row-weeks match Central call-date missed-leg counts; both-week source sets pass; publisher and release pending |
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
