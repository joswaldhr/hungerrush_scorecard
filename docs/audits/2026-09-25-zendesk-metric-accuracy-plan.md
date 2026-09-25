# Zendesk metric accuracy investigation and delivery plan

Prepared September 25, 2026 in response to the request to investigate every POS and
Menufy metric and make the reporting accurate. This is the next metric-correctness
workstream. The earlier core release and scheduled-sync verification do not certify
business definitions or employee attribution. This planning checkpoint makes no
production configuration, metric, target, or historical-data changes.

## Intended outcome and acceptance standard

Every assigned metric has a documented meaning, a complete source population, correct
employee/team attribution, reproducible arithmetic, and a source-to-screen comparison.
Inventory every live assignment, including employee/manager/team/line overrides; the
September 23 baseline was 25 definitions, 23 assigned keys, 19 POS assignments and 21
Menufy assignments. Refresh those counts before executing the investigation.

The goal is 100% explainable and reproducible results for the defined, observed source
population. A passing sync, plausible number, matching grand total, or unit test is not
proof of accuracy. No unexplained included/excluded record is acceptable at certification.
Do not promise accuracy for evidence Zendesk does not retain. Where a required source is
absent, identify and implement the necessary collection/configuration work; until then
show the specific unavailable reason, never a fabricated zero or a substitute measure.

The user's existing policy remains binding: count verified human activity only for
Tickets Updated/Resolved; uncertain attribution is unavailable. No routine checkpoint
approval is needed. A genuinely unresolved business definition must be stated explicitly;
continue independent work while resolving it from existing configuration and trusted reports.

## What is established, and what still needs proof

- The last live census found all 62 active employees mapped (39 POS, 23 Menufy). That
  proves current identity coverage, not historical identity, human action or every metric.
- All four September 25 scheduled metric publications completed for their exact weeks.
  PR25 corrected one roster line conflict; its current-week scheduled roster execution
  remains unobserved. Successful ingestion is a separate checkpoint from metric parity.
- PR24 corrected exclusion of reported zero business durations and standardized H:MM:SS
  display and column alignment. It did not establish correct employee/cohort semantics.
- The retained sample found transferred-call discrepancies: one Menufy employee had
  4 whole-call inbound assignments but 8 distinct calls with completed agent legs; a POS
  sample also differed. These are diagnostic samples, not certified final counts.
- Ticket Updated/Resolved totals lack verified human attribution. Matching an agent ID,
  email or web channel alone is insufficient; manual and automated child events can share
  an audit. Preserve the existing child-event evidence contract.
- True active handling effort, agent offers/misses/declines, survey-invitation coverage,
  escalation-work attribution and historical membership/target applicability remain open.

Sources for these account-specific findings are the existing metric contracts, metric
reporting follow-up, action-v2 contract and scheduled-sync report in this directory.
This planning review is not a new live account census.

## Phase 1 — Map the real account and reference reports

Start with bounded read-only discovery. Produce one coverage matrix for every live
metric, employee, POS/Menufy team and Menufy line. Inspect:

1. Account identity, API permissions and available ticket, audit, metric, rating, call
   and call-leg data; export pagination, archival/deletion limits, retention and lag.
2. Numeric source identities, aliases/duplicate accounts, active dates, team/group/line
   membership and transfer history. Bind evidence to the source account. Reuse existing
   retained observations and verified pagination helpers rather than recrawling blindly.
3. Ticket statuses/custom statuses, elevation and avoidability tags/fields, relevant
   trigger/automation/integration configuration, bot/service accounts, CSAT configuration,
   business-hour schedules/holidays, Talk routing and available time-tracking fields.
4. The exact Zendesk/Explore reports managers use: definitions, filters, report dataset,
   date field, timezone, exclusions, refresh lag and aggregation. Treat reports as an
   independent comparison, not automatically as ground truth. Trace disagreements to IDs.

The user identified two manager accounts in the conversation, including the POS manager,
and does not know the trusted report names. Use those identities privately to confirm
team scope and locate accessible owned/shared Explore dashboards, reports and saved views
through the authorized account. Inspect their formulas, filters and sharing metadata;
do not equate report ownership or visibility with actual usage or trust. Manager identity
details remain outside the public repository. No impersonation, credential changes or
messages to those managers are part of this discovery. Continue raw-event reconstruction
where report visibility is unavailable; record the precise access gap and use any existing
report-usage evidence if available. The user need not compile a report list first.

Deliverable: per-metric state of verified, incorrect definition, missing producer,
incomplete source coverage, ambiguous attribution, or unavailable source capability;
include the actual cause and next action for each blank or suspicious value.

## Phase 2 — Freeze definitions before comparing numbers

For every metric specify: source endpoint/fields; event or snapshot grain; inclusion and
exclusion rules; credited employee; event-time team/line; reporting timestamp and timezone;
business versus elapsed time; numerator and denominator; distinctness; missing/zero rules;
late corrections; freshness; formula version; target meaning and effective dates.

Preserve Sunday–Saturday reporting. The implementation currently uses UTC boundaries;
check Zendesk account/report/business-schedule timezones before deciding whether the
reporting instants need correction. A Central-time user preference alone does not establish
the reporting timezone. Compare boundary records explicitly and include DST tests. Use
half-open start-inclusive/end-exclusive instants and keep schedule timezone separate.

Keep H:MM:SS display for durations. Retain native units and full-precision sums/sample
counts internally; round only the displayed result. Include valid zeros, exclude only
documented missing/ineligible values, and never average already-rounded employee averages.
Show duration basis and sample count. Do not reuse target bands when a metric's meaning,
grain, unit or denominator changes; version/revalidate targets and withhold incompatible
judgments until they are defined.

### Metric-specific investigation and proposed direction

| Metric keys | Investigation and required result |
|---|---|
| tickets_updated | Reuse the selected action contract: distinct tickets with a verified human comment-presence or field-change event by the employee during the week. Review eligible event types, automation and duplicate events; do not equate current assignment with work. |
| tickets_resolved | Verify human transitions from an eligible unsolved status to solved, prior state, actor and time. Test reopening, repeated solves, custom statuses, solved-to-closed automation and reassignment. Distinct per employee/week per existing contract; team-distinct totals require separate aggregation. |
| avg_response_time | Trace the reported Menufy employee's underlying ticket population first. Compare current created-and-last-updated cohort against first-public-reply event/cohort definitions and the trusted report. Distinguish ticket first-reply service time from this employee's response performance. Attribute a responder measure to the actual reply actor; label any ticket-assignee measure accurately. |
| avg_handle_time | Inspect account time-tracking/WFM data for active handling effort and coverage. Full-resolution business elapsed time cannot supply active effort. If actual handling evidence is absent, specify new instrumentation and separately label the supported resolution-time measure; do not silently substitute it under the old label or target. |
| csat_score | Reconcile unique received good/bad ratings, changes, event date, credited employee and late updates. Publish numerator, denominator and observation cutoff; no ratings means no score. |
| csat_response_rate | Establish the actual eligible survey invitation/offering population and the corresponding response cohort/window. Distinguish an offered state from proof of delivery. Test repeat invitations and late ratings. Implement only with a defensible denominator; otherwise document the collection gap. |
| backlog_count | Verify unsolved status semantics and current ownership as of an explicit snapshot. Historical week-end backlog requires a retained snapshot or complete event reconstruction; today's backlog is not a historical substitute. |
| worked_elevated_tickets | Map the actual escalation workflow and determine what work earns credit, by whom and when. Reconstruct applicable tag/field/group changes and work events rather than using present tags/current ownership. |
| avoidable_worked_elevated_tickets | Verify the avoidability decision, event timing and credited work. Require this to be a subset of qualifying elevated work under the agreed definition; test tag removal and later reclassification. |
| inbound_calls_offered | Find the per-agent offer/attempt evidence in call legs/routing data. Determine whether repeats to one agent count as separate offers. A whole call's first-answering agent is not an offer log. |
| inbound_calls_accepted | Define acceptance versus completed agent participation. Reconcile actual agent legs, transfers and repeated participation; choose event count or distinct employee-call count explicitly. |
| missed_calls, declined_calls | Verify agent_missed, declined, transfer-declined and unreachable semantics against routing evidence and report formulas. Keep distinct categories; do not derive these by subtracting unrelated whole-call totals. |
| inbound_calls_abandoned_on_hold | Establish whether abandonment is a call-level service result or can be attributed to a particular agent/hold segment. Do not credit/blame the first answering agent without evidence. |
| avg_talk_time_inbound, avg_hold_time_inbound | Calculate employee participation from supported agent-leg fields; verify transfer, zero-duration, multiple-leg and eligibility rules. Specify per-leg versus per-distinct-call denominator and retain sums/counts. |
| avg_call_duration_inbound | Define components: queue/ringing/talk/hold/wrap-up as applicable. Separate customer whole-call duration from employee handling duration and ensure numerator/denominator describe the same population. |
| avg_consultation_time_inbound | Determine supported agent-level consultation fields and whether the denominator includes all eligible calls or only consultations. Current positive-only filtering must not be mistaken for an all-call average. |
| outbound_calls, outbound_calls_completed, outbound_calls_non_answered | Define attempt, answer and completion states using leg/call evidence; handle transfer callbacks and multiple agents. Verify whether failed is the full non-answered population. Reconcile category intersections/exclusions explicitly. |
| avg_talk_time_outbound, avg_hold_time_outbound | Apply the verified outbound employee/leg cohort with documented duration denominator, valid zeros and no cross-agent duration double counting. |

Also inventory unassigned First Contact Resolution and Schedule Adherence. FCR needs its
own reopen/follow-up window and event definition. Schedule adherence needs a scheduling/WFM
source; it cannot be made accurate from Zendesk tickets alone. Implement these if live
assignments require them; otherwise record them as outside the active scorecard scope.

## Phase 3 — Independent reconstruction and full-population reconciliation

Use closed weeks September 13–19 and September 6–12 as the initial certification set.
Cover every employee eligible during those periods, including inactive/transferred staff
where relevant; today's 62 active employees are not sufficient historical scope. Treat
September 20–26 as provisional through a fixed observation cutoff, not a final week.
Include August 30–September 5 in regression comparison after the initial two weeks pass.

Start detailed exception tracing with the reported Menufy employee and a POS employee, then expand to all eligible
employees and both Menufy lines. Include transfers, multi-group membership, integration-heavy
activity, reopened tickets, no activity, no surveys, late ratings and near-midnight events.

For each employee/metric/week, independently reconstruct the eligible source-ID set,
numerator, denominator and value. The reference calculation must not simply call the
production calculator. Compare raw source/audits, applicable Zendesk report, retained
observations, normalized facts, stored metric, API result, rendered scorecard, previous-week
view, history and export. Matching totals with different underlying IDs do not pass.

Use matching observation cutoffs and source versions. Count/source-set comparisons require
exact agreement. Duration/percentage sums and denominators must agree before formatting;
allow only the explicitly specified rounding or documented source precision difference.
Every discrepancy gets a cause, a correction and a repeatable regression example. Preserve
private detailed evidence outside Git; commit aggregate counts, definitions and results only.

Human-attribution work needs an explicit decision point: establish a reviewable, source-bound
proof for relevant child events and valid employee mappings, including automation running
under an employee account. If existing APIs cannot prove authorship, identify the required
instrumentation or attested review process and its coverage. Do not loop indefinitely over
the same ambiguous sample or treat a channel heuristic as proof. Manual samples validate a
rule; they do not certify every unreviewed event or future activity.

## Phase 4 — Implement complete producers and controlled publication

Order the implementation by demonstrated defect and dependency:

1. Tickets Updated/Resolved attribution and the reported response-time discrepancy, alongside
   account/report discovery. These establish why the most visible values are missing/wrong.
2. Agent-level call participation and durations, then offered/accepted/missed/declined states.
3. Response/resolution/handling definitions, CSAT score and response-rate evidence.
4. Escalation/avoidable work and backlog snapshots; end-to-end parity for every remaining row.

Reuse the existing bounded action/leg readers, source bindings, checkpoints, immutable
observations and revisions. Add only the missing reviewed attribution producer, computation
and publication paths. Preserve zero versus missing versus uncertain versus partial/stale
states across the application. Partial counts must not masquerade as a full total.

Keep shadow ingestion and version-2 publication disabled until their respective release
gates pass. A controlled bounded staging comparison precedes any persistent activation.
Before ongoing collection, establish retention, retry/resumption, source-account isolation,
freshness thresholds and tested failure alerts. Do not manually edit metric totals.

Certify and release metrics in independently verified batches rather than waiting for a
single all-or-nothing activation. Each batch needs source-set parity, boundary/regression
tests, PostgreSQL integration checks, CI/build, synthetic hosted checks, production backup
and restore evidence, a rollback target and read-only production comparison after release.
Remove attribution withholding only for genuinely certified source-bound calculations;
never globally relax the guard because a version number changed.

Historical repair is a separate, explicit operation after current computation is certified:
select the exact range and eligible history, rehearse an aggregate before/after comparison,
retain predecessor revisions and calculation/target context, and provide a rollback plan.
Do not overwrite uncertain historical membership or human evidence with today's assumptions.

## Phase 5 — Acceptance and Friday handoff

Maintain a metric-by-metric acceptance ledger showing definition/version, source coverage,
private evidence location, reference result, discrepancies, automated checks, UI/export
checks, production deployment and remaining dependencies. No metric is marked done merely
because it now displays a value.

Acceptance includes:

- All live assigned metrics have an explicit state and owner action; no unexplained blanks.
- Certified metrics match all employee-level source sets and unrounded arithmetic for both
  initial closed weeks, with provisional current-week evidence clearly labeled.
- Dates, time basis, sample size, targets, team/line and employee scope agree throughout
  scorecards, prior periods, history and actual downloaded export bytes. Hosted export-byte
  inspection remains a real outstanding check, not covered by unit tests alone.
- Replays, late corrections, pagination failures, rate limits and restarts cannot duplicate
  counts, publish incomplete populations or silently change historical context.
- Each disabled/unsupported metric has an exact reason and concrete path to enablement.
- Scheduled production completion and failure-alert delivery are checked independently of
  business-value reconciliation; corrected roster scheduling still needs observation.

Friday September 25 remains the handoff target; no weekend user participation is assumed.
The first investigation block should produce the complete defect/source-capability matrix
and a revised completion forecast before expanding implementation. Planning estimates for
hands-on work: 2–4 hours for account/report mapping and definitions; 4–8 hours for the first
closed-week independent reconstructions; subsequent implementation/validation depends on
the demonstrated gaps. These are estimates, not measured durations or a promise that all
metrics can be certified before Monday. Missing historical evidence or new instrumentation
can extend delivery. Publish verified fixes as they clear the gates and report the remaining
metric-specific dependencies plainly.

## Sources and related evidence

- [Ticket metrics fields](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_metrics/)
- [Ticket audits](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_audits/)
- [Talk call and leg exports](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/)
- [Satisfaction ratings](https://developer.zendesk.com/api-reference/ticketing/ticket-management/satisfaction_ratings/)
- `2026-09-23-metric-contracts.md` — original catalog and formula audit (historical baseline).
- `2026-09-23-action-metric-v2-contract.md` — selected verified-human counting policy.
- `2026-09-24-metric-reporting-followup.md` — duration and call-attribution evidence.
- `2026-09-25-scheduled-sync-verification.md` — actual scheduler evidence and its limits.
