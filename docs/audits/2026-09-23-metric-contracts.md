# Metric inventory and contract audit

September 23, 2026. Companion to the [application audit](C:/Users/JamesOswald/projects2/hungerrush_scorecard/docs/audits/2026-09-23-application-audit.md). This is a specification of observed behavior and proposed corrections, **not approval of current metric meanings or a request to change target bands**.

Evidence: [connector](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/connectors/zendesk.ts), [metric computation](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/compute-values.ts), [queries](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/queries.ts), [target resolution](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/target-resolution.ts), [comparison](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/reconciliation/compare.ts), [formatting types](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/types.ts), [dated database snapshot](C:/Users/JamesOswald/projects2/hungerrush_scorecard/docs/audits/2026-09-23-baseline.json).

## How to read the contracts

Each contract consists of its inventory row, source/formula row, target row, and shared rules below. This normalized presentation covers the requested 20 attributes without pretending identical behavior differs between metrics.

| Requested attribute | Authoritative location in this appendix |
|---|---|
| 1. Canonical ID | Inventory “ID”; stable database key, not an ephemeral UUID. |
| 2. Display name | Inventory “Label”; group heading distinguishes duplicate labels. |
| 3. Business definition | Source/formula row; explicitly distinguishes observed implementation from unverified intended meaning. |
| 4. Source system | Inventory source; source profiles identify endpoint family. |
| 5. Source fields | Source/formula row. |
| 6. Filters | Shared source profile plus row-specific predicate. |
| 7. Formula | Source/formula row. |
| 8. Numerator/denominator | Source/formula row; count denominator is not applicable. |
| 9. Unit | Inventory. |
| 10. Aggregation | Inventory is downstream fact aggregation; source formula describes initial aggregation. |
| 11. Grain | Shared rule G1, all metrics; unsupported entries have intended catalog grain only. |
| 12. Reporting period | G2 and per-source exceptions. |
| 13. Timezone | G3. |
| 14. Rounding | G4 and source/formula row. |
| 15. Target logic | Target table plus G5. |
| 16. Missing-data behavior | Missing profile in inventory plus G6. |
| 17. Zero behavior | Missing profile definitions and formula denominator. |
| 18. Historical behavior | G7 and backlog/unsupported exceptions. |
| 19. Freshness requirement | G8; existing contract lacks a metric-specific guarantee, proposal is explicit. |
| 20. Reconciliation | Per-metric verification table plus G9. |

**Coverage:** 25 current definitions, all marked active in the database; 20 producer keys; POS 19 assignments; Menufy 21 assignments. The union of assigned keys is 23. Assignments do not guarantee display: manager/employee/team/line visibility overrides still apply.

## Inventory

P = POS assigned; M = Menufy assigned; — = unassigned. Source Z = Zendesk ticketing, T = Zendesk Talk, A = Assembled catalog only. Profiles C = produced count, D = produced duration average, R = rated percentage, B = current backlog, U = unsupported. “Average” here is the downstream unweighted average of fact values; it is not proof that source denominators are preserved.

| ID | Label | Assigned | Source | Unit | Fact aggregation | Direction | Missing profile |
|---|---|---|---|---|---|---|---|
| tickets_resolved | Tickets Resolved | P, M | Z | tickets | sum | higher | C |
| tickets_updated | Tickets Updated | P, M | Z | tickets | sum | higher | C |
| avg_handle_time | Avg Handle Time | P | Z | min | average | lower | D |
| avg_response_time | Avg Response Time | M | Z | min | average | lower | D |
| csat_score | CSAT Score | P, M | Z | % | average | higher | R |
| backlog_count | Backlog | P | Z | tickets | latest | lower | B |
| worked_elevated_tickets | Worked Elevated Tickets | P, M | Z | tickets | sum | higher | C |
| avoidable_worked_elevated_tickets | Avoidable Worked Elevated Tickets | P, M | Z | tickets | sum | lower | C |
| inbound_calls_offered | IB (Inbound) | P, M | T | calls | sum | higher | C |
| inbound_calls_accepted | Accepted IB (Inbound) | P, M | T | calls | sum | higher | C |
| inbound_calls_abandoned_on_hold | Abandoned on Hold | P, M | T | calls | sum | lower | C |
| avg_talk_time_inbound | Avg Talk | P, M | T | s | average | neutral | D |
| avg_hold_time_inbound | Avg Hold | P, M | T | s | average | lower | D |
| avg_call_duration_inbound | Avg Duration | P, M | T | s | average | neutral | D |
| avg_consultation_time_inbound | Avg Consultation | P, M | T | s | average | neutral | D |
| outbound_calls | OB (Outbound) | P, M | T | calls | sum | neutral | C |
| outbound_calls_completed | Completed OB (Outbound) | P, M | T | calls | sum | higher | C |
| outbound_calls_non_answered | Non-answered OB (Outbound) | P, M | T | calls | sum | lower | C |
| avg_talk_time_outbound | Avg Talk | P, M | T | s | average | neutral | D |
| avg_hold_time_outbound | Avg Hold | P, M | T | s | average | lower | D |
| csat_response_rate | CSAT Response Rate | M | Z catalog | % | sum | higher | U |
| missed_calls | Missed Calls | M | T/Z catalog | calls | sum | lower | U |
| declined_calls | Declined Calls | M | T/Z catalog | calls | sum | lower | U |
| first_contact_resolution | First Contact Resolution | — | Z catalog | % | average | higher | U |
| schedule_adherence | Schedule Adherence | — | A catalog | % | average | higher | U |

Talk definitions use database source strategy `zendesk`; source T above clarifies the endpoint rather than implying a separately configured integration. Catalog entries for missed/declined calls also use `zendesk`. There is no live Assembled connector to support schedule adherence.

## Shared source filters

**Ticket profile S1:** active employees with mapped identities for the source. Search query is `type:ticket assignee:<email> updated>=<periodStart> updated<=<periodEnd>`. Thus ownership is current assignee, not necessarily the person who performed the event. Search result ceiling is 1,000; the audit branch now rejects oversized or inconsistent result sets before publication. Larger complete cohorts still require an export or partitioning implementation. Exact boundary interpretation by the source search service requires verification. Tickets can leave a historical updated-date cohort when modified later.

**Time profile S2:** S1 tickets whose UTC created date is also within the period. Metric sets come from `tickets/show_many.json?...&include=metric_sets`. `businessMinutes` excludes a business value of zero if calendar time is positive. This heuristic needs validation against business-hour settings; it changes the denominator. Other present business values are included. `averageOf` excludes nulls and rounds to one decimal.

**Ratings profile S3:** `satisfaction_ratings.json?score=received&start_time=...&end_time=...`. UTC start, end capped at period end or now minus 90 seconds; follows next_page. Group by numeric assignee ID; only good/bad responses enter score. Missing assignee is skipped. Need source/API verification of the time field selected by this endpoint, late rating changes, reassignment, uniqueness, and completeness. Observed populated summaries disprove a blanket “CSAT always broken” claim, but do not prove parity.

**Call profile S4:** incremental Talk calls from period-start modification timestamp. The audit branch filters the final latest-per-ID cohort to UTC created_at >= period start and < midnight after period end. Numeric `agent_id` attribution and direction grouping remain unchanged. Repeated IDs retain the greatest updated_at; conflicting equal-time versions fail. Pagination continues through pages created outside the week; page-budget exhaustion, stalled/missing continuation, malformed records, and inconsistent counts fail before publication. Completion conservatively requires count=0 with no calls because Talk documents count-based exhaustion but no explicit short-page threshold. This may reject usable exports at repeated nonempty boundaries; live cursor reconciliation and a scalable persistent export remain release blockers. The API is modified-since and first-answering-agent attribution, so source IDs and event/leg semantics must be independently verified before changing business definitions. [Vendor contract](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/).

**Backlog profile S5:** current-week-only `type:ticket assignee:<email> status<solved`; no historical as-of query. Search cap still applies.

## Source formulas and semantic findings

| ID | Observed definition, fields, formula, numerator/denominator | Contract finding |
|---|---|---|
| tickets_resolved | S1; count tickets with present status solved or closed. Payload ticketsResolved. Numerator is matching ticket count; denominator N/A. | Does not establish resolution events during week or actual resolving employee. Approve event versus snapshot-cohort meaning. |
| tickets_updated | S1; result count. Payload ticketsUpdated; denominator N/A. | Counts distinct fetched tickets, not number of updates or touches, and not necessarily updates performed by assignee. |
| avg_handle_time | S2; sum present full_resolution_time_in_minutes.business / number of included metric sets. Payload avgHandleTimeMinutes. | Full elapsed business resolution time is not agent handling effort. Denominator lost in summary; excludes old-created tickets. |
| avg_response_time | S2; sum present reply_time_in_minutes.business / number included. Payload avgResponseTimeMinutes. | First reply metric/cohort semantics require explicit approval; not all response events during the week. |
| csat_score | S3; 100 × count(score=good) / count(score in good,bad). Round to 2 decimals. Payload csatScore and totalRatings. | Good/bad arithmetic is explicit; source time and attribution remain verification items. No denominator should mean unavailable, not 0%. |
| backlog_count | S5; count current unsolved tickets. Payload backlogCount; denominator N/A. | Snapshot time is essential. Old periods retain previous snapshot rather than re-created week-end backlog. |
| worked_elevated_tickets | S1; count with tag matching /^elevated_/i or /_elevated$/i. Payload workedElevatedTickets. | Present tag/current assignee is not proof of employee escalation work in this week. |
| avoidable_worked_elevated_tickets | S1; count tags containing unnecessary_escalation or yes_avoidable. Payload avoidableWorkedElevatedTickets. | Does not explicitly intersect elevated predicate. Verify whether vendor tagging guarantees subset relation; do not assume. |
| inbound_calls_offered | S4 inbound.length; payload inboundOffered; denominator N/A. | Call attribution is not per-agent offers. Retain old version and verify intended label/contract. |
| inbound_calls_accepted | S4 inbound with completion_status=completed; payload inboundAccepted. | Completed call does not automatically equal agent acceptance event. |
| inbound_calls_abandoned_on_hold | S4 inbound with completion_status=abandoned_on_hold; payload inboundAbandonedOnHold. | Verify transferred calls and agent attribution; exact source status count. |
| avg_talk_time_inbound | S4 inbound; sum present talk_time / number of present values; payload avgTalkTimeInbound. | Whole-call duration may include other agents. Zero values enter mean. |
| avg_hold_time_inbound | S4 inbound; sum present hold_time / number of present values; payload avgHoldTimeInbound. | Includes zero-hold calls; not average only among held calls. |
| avg_call_duration_inbound | S4 inbound; sum present duration / number present; payload avgDurationInbound. | Define included call states and duration components using vendor evidence. |
| avg_consultation_time_inbound | S4 inbound with consultation_time >0; sum consultation_time / number of positive consultation calls; payload avgConsultationTimeInbound. | Different denominator from other duration metrics. No consultations returns null, not zero. |
| outbound_calls | S4 outbound.length; payload outboundTotal; denominator N/A. | Includes all fetched outbound states; neutral direction still supports approved range target. |
| outbound_calls_completed | S4 outbound with completion_status=completed; payload outboundCompleted. | Exact status count, subject to source completeness. |
| outbound_calls_non_answered | S4 outbound with completion_status=failed; payload outboundNonAnswered. | “Failed” may not cover every ordinary meaning of non-answered. Needs vendor/business confirmation. |
| avg_talk_time_outbound | S4 outbound; sum present talk_time / number present; payload avgTalkTimeOutbound. | Includes available zeros/failed-call durations; definition should state denominator explicitly. |
| avg_hold_time_outbound | S4 outbound; sum present hold_time / number present; payload avgHoldTimeOutbound. | Includes zero-hold calls; verify attribution. |
| csat_response_rate | No producer, source field, eligible-survey cohort, numerator or denominator implemented. | Target exists, value unavailable. Proposed definition requires verified sent/eligible invitation denominator and response cohort. Do not divide ratings by tickets by guesswork. Catalog sum is inappropriate for aggregating percentages generally. |
| missed_calls | No historical producer implemented. | Connector documents absence from individual call records in this instance. Do not substitute abandoned calls; verify endpoint/retention before promising history. |
| declined_calls | No historical producer implemented. | Same source-availability constraint; do not infer from failed calls. |
| first_contact_resolution | No producer, reopen/contact policy, denominator, or window implemented. | Unassigned catalog placeholder. Requires product and vendor contract before activation. |
| schedule_adherence | No current connector or formula. | Unassigned residual Assembled definition; schedules/actual states and eligible-time denominator unknown. Retire unsupported presentation rather than fabricate values. |

## Shared contract rules

**G1 — Grain.** All produced values are employee × metric definition × period start/end; source summaries are employee-week-source record. Intended aggregation is weekly. Employee/team attribution is supplied by current mappings; metric insertion uses current primary team, while upsert does not refresh that team field. A team aggregate is not an active primary manager workflow and must not be inferred from summing/averaging these rows.

**G2 — Period.** Current week helpers return Sunday–Saturday; sync refreshes offsets 0–3. Prior Monday–Sunday intervals remain stored. Queries select periodStart and assume compatible end/calendar. Introduce explicit period/calendar IDs and half-open instant boundaries in new contracts. Do not merge overlapping intervals. S5 is a fetch-time snapshot within the current week; U metrics have no observed source periods.

**G3 — Timezone.** Code uses UTC for period and explicit timestamp construction. Menufy Sunday start was confirmed in existing project notes; POS calendar remains unconfirmed there. The user's local America/Chicago timezone is not evidence that the product should switch. Source business-minute schedules are separate from reporting timezone and need verification.

**G4 — Rounding.** Produced counts are integers at source; duration source averages are rounded to one decimal; CSAT source percentage to two. Compute rounds every numeric value to two decimals and database stores real. UI/export use shared `formatMetricValue`, so formatted text can differ from underlying numeric precision. Unsupported U metrics have no actual rounding behavior beyond generic formatting. Proposed version 2 retains exact sums/counts and rounds only at declared presentation/contract boundaries; compare raw ratios before display rounding.

**G5 — Targets.** Resolution ranks employee > role-within-team > team > organization, adds a line-specific preference within specificity, then priority. Role is currently passed as null. Equal specificity/priority has no explicit stable tie-break; effective dates are not filtered. Range passes inclusively between bounds and fails both below and above; exact uses absolute difference; legacy minimum/maximum behavior uses direction to interpret thresholds. Lower-is-better Menufy “minimum” targets currently behave as ceilings. Preserve this observed behavior until any type cleanup is tested/versioned. No target returns no_target; missing value returns no_data. Performance status currently ignores quality and period completeness.

**G6 — Missing/zero profiles.**

| Profile | Missing behavior today | Zero behavior and required correction |
|---|---|---|
| C, tickets | Empty fetched list yields numeric zero; upstream total failure retains prior values; capped fetch can look complete. | Zero is valid only with complete search and resolved identity/cohort; source failure is not zero. |
| C, calls | Unresolved numeric ID yields null payload/omitted fact; resolved identity with no fetched calls yields zero. | Keep intent, but prove full period coverage before asserting zero. Non-null→null can leave old value. |
| D | No included observations yields null and omitted fact; old values can survive. | Present zero duration is included except S2 business=0/calendar>0 exclusion; consultation uses positive values only. Label no qualifying sample separately from source failure. |
| R | No good/bad ratings yields null and omitted fact; old value can survive. | All rated responses bad yields valid 0%; no ratings is unavailable. Display denominator. |
| B | Historical refresh emits null; no current open tickets yields zero. | Zero requires complete snapshot search; preserve original snapshot time for history. |
| U | No producer → no fact/value, UI dash if assigned and visible. | Never synthesize zero; show unsupported or not configured. Activation requires a new approved contract. |

All profiles inherit P0-02: absent new facts do not reliably retire prior facts/values. Current UI dash does not explain which missing reason applies.

**G7 — History.** Active employees' latest four periods are re-fetched from mutable sources. Older facts are still recomputed and restamped by broad compute. No calculation-version cutover protects prior results. Current targets/line/assignment context applies to old weeks. Future contract: immutable published revisions, effective-date context, explicit correction/backfill and target versions. For D/R, missing denominators prevent exact historical reconstruction from summaries. For U, there is no historical evidence to backfill without additional verified sources.

**G8 — Freshness.** No enforceable metric-specific freshness requirement currently exists. Daily scheduled sync and a source-wide success timestamp are implementation facts, not per-metric SLAs. Recalculation timestamp is not observation freshness. Proposal: for produced current-week metrics, show source-observed time and complete publication age, mark stale after a configurable 36 hours pending agreement, and label open-period data provisional. For backlog, show precise snapshot time. For closed weeks, show closure/correction policy and preserved observed-at. For U metrics, freshness is not applicable until a producer exists. Do not suggest they will update tomorrow.

**G9 — Existing reconciliation.** All metrics use the same fact-to-value engine and shared aggregate helper, with relative threshold comparison (default 5%). This can prove internal consistency but cannot prove source truth; null/null is source_missing. New contracts should use the per-metric independent method below. No metric in this audit is certified against a complete independent vendor ledger.

## Current target configuration

Captured target rows have null effective dates. P = POS; R = Menufy restaurant; C = Menufy consumer; MF = Menufy fallback for no applicable line-specific target. Values are preserved observations, not recommendations.

| Metric | P | R | C | MF |
|---|---|---|---|---|
| tickets_resolved | ≥45; warning ≥35 | 75–128 inclusive | 282–443 inclusive | ≥35; warning ≥25 |
| avg_handle_time | ≤12 min; warning ≤15 | — | — | — |
| avg_response_time | — | ≤60 min | ≤60 min | ≤15 min; warning ≤20 |
| csat_score | ≥85%; warning ≥75 | ≥70% | ≥50% | ≥80%; warning ≥70 |
| backlog_count | ≤8; warning ≤12 | — | — | — |
| inbound_calls_offered | — | 52–72 inclusive | 30–52 inclusive | — |
| outbound_calls | — | 35–75 inclusive | 75–112 inclusive | — |
| avg_hold_time_inbound | — | ≤120 s | ≤120 s | — |
| avg_hold_time_outbound | — | ≤120 s | ≤120 s | — |
| inbound_calls_abandoned_on_hold | — | ≤0 | ≤0 | — |
| csat_response_rate | — | ≥15% | ≥15% | — |
| missed_calls | — | ≤0 | ≤0 | — |
| declined_calls | — | ≤0 | ≤0 | — |

No captured targets for tickets_updated, worked_elevated_tickets, avoidable_worked_elevated_tickets, inbound_calls_accepted, avg_talk_time_inbound, avg_call_duration_inbound, avg_consultation_time_inbound, outbound_calls_completed, outbound_calls_non_answered, avg_talk_time_outbound, first_contact_resolution, or schedule_adherence. These are no-target, not implicitly good. Employee/role/org overrides remain supported by code; this table reflects the captured configuration.

**Product constraint:** Menufy ranges were explicitly left unchanged in prior decisions. Fixing quality/open-period presentation and contract fidelity does not authorize threshold recalibration.

## Independent reconciliation requirements per metric

Every check must fix employee/source identity, period/calendar, source revision, and contract version before comparing numbers. Retain a reviewed ledger of IDs or privacy-preserving references. Count tolerance should be zero; “within 5%” is not acceptable for an exact count.

| Metric | Independent evidence and proposed pass condition |
|---|---|
| tickets_resolved | Resolution/audit ledger for approved definition, with resolver/assignee policy. Exact cohort IDs and count; explain excluded reopen/reassignment cases. |
| tickets_updated | Unique ticket IDs with qualifying updates under approved actor/time definition. Exact set/count; distinguish ticket count from update-event count. |
| avg_handle_time | Ticket ID + eligible resolution business minutes + exclusion reason. Exact denominator and sum; presentation difference no more than declared rounding (0.1 min for current source mean). |
| avg_response_time | Ticket ID + eligible reply business minutes, exact cohort/denominator. Same declared rounding rule; independently validate business/calendar zero exclusion. |
| csat_score | Rating IDs, approved time/assignee, good and bad counts. Exact counts, then ratio difference ≤0.01 percentage point for current two-decimal representation. |
| backlog_count | Timestamped open-ticket ID snapshot. Exact set/count at the same instant, not a later live search used as retrospective truth. |
| worked_elevated_tickets | Ticket/event IDs with approved elevation/actor policy. Exact set/count; source tag snapshot if preserving version 1 meaning. |
| avoidable_worked_elevated_tickets | Avoidability evidence and eligible elevation set. Exact IDs/count; explicitly verify subset relation rather than assume it. |
| inbound_calls_offered | Vendor-verified agent offer records if that is intended, or first-agent inbound call IDs if preserving current meaning. Exact eligible set/count. |
| inbound_calls_accepted | Verified acceptance events or completed-call IDs under approved contract. Exact set/count. |
| inbound_calls_abandoned_on_hold | Unique inbound call IDs with source status, attributed using approved policy. Exact count. |
| avg_talk_time_inbound | Eligible inbound call/leg IDs, talk seconds and denominator. Exact sum/count; ≤0.1 s current source rounding difference. |
| avg_hold_time_inbound | Eligible inbound call/leg IDs including zero holds, hold seconds/count. Same rounding rule. |
| avg_call_duration_inbound | Eligible inbound call IDs/states, duration seconds/count. Same rounding rule; check component semantics. |
| avg_consultation_time_inbound | Positive-consultation inbound IDs, seconds and qualifying count. Same rounding rule; zero eligible observations means no sample. |
| outbound_calls | Unique outbound call IDs and source-period coverage. Exact set/count. |
| outbound_calls_completed | Outbound IDs with completed status and approved attribution. Exact set/count. |
| outbound_calls_non_answered | Approved non-answer taxonomy and unique IDs; separately reconcile current failed-only interpretation. Exact set/count. |
| avg_talk_time_outbound | Outbound IDs, included states, talk seconds/count including eligible zeros. Exact sum/count; ≤0.1 s current rounding difference. |
| avg_hold_time_outbound | Outbound IDs, hold seconds/count including zeros. Same rounding rule. |
| csat_response_rate | Not verifiable yet: obtain invitation/eligible denominator and received-response numerator, time alignment and unique IDs before activation. |
| missed_calls | Not verifiable historically yet: verify agent event source and retention, then exact event count. |
| declined_calls | Not verifiable historically yet: verify distinct decline-event source and retention, then exact count. |
| first_contact_resolution | No current contract: define first-contact success, exclusion/reopen horizon, eligible denominator and independent case ledger first. |
| schedule_adherence | No current source: define planned versus actual eligible intervals, exclusions, timezone and denominator before integration/reconciliation. |

Tolerances above describe current rounding units, not permission for cohort differences. For a new exact numerator/denominator representation, compare those components exactly and apply only the display-format tolerance at the final step.

## Proposed formal contract system

Keep definitions centralized in the metric domain and generate documentation/tests from reviewed contract records where practical. A contract should contain:

```text
id, version, label, description, sourceType
sourceFields, cohortPredicate, attributionRule
formula, numerator, denominator, unit, aggregation
grain, calendarVersion, timezone, boundaryConvention
rounding, targetPolicy, targetEffectiveDateRule
missingReasonPolicy, zeroEvidenceRule, openPeriodPolicy
freshnessThreshold, correctionWindow, reconciliationRule
effectiveFrom, supersedes, approvedDecisionReference
```

Separate runtime values from definitions and target instances. Avoid arbitrary executable formula strings edited through an admin form; typed reviewed functions plus declarative metadata fit this application's scale. Resolve source-specific extraction in adapters, canonical business meaning in the domain, and presentation in formatters.

Current violations: semantics live in connector loops while database labels/calculation types live elsewhere; early averages discard supporting counts; quality and freshness are invented by compute; target context is assembled from current employee data; overall status makes its own sufficiency assumptions; CSV repeats status wording and contextual labels.

## Safe contract migration example

For tickets_resolved, **version 1** is the observed current-assignee/updated-period/current-solved-state count. **Version 2** must be defined only after approving the actual event and employee-attribution policy.

1. Record the approved v2 definition and effective date; retain v1.
2. Retain source evidence; shadow compute v2 for representative POS/consumer/restaurant employees, open and closed weeks, and reassignment/reopen cases.
3. Compare ID sets as well as numbers; classify expected semantic differences separately from defects.
4. Review target compatibility without changing the existing Menufy bands by default.
5. Publish v2 to a small authorized canary cohort with visible version/date context.
6. Backfill only periods supported by sufficient evidence; explicitly label unreconstructable periods.
7. Keep historical version access and a reversible publication pointer.

The same discipline applies to Talk attribution, duration denominators, period calendars, and historical target resolution. A numeric result that changes requires an explanation, not merely a successful deployment.

