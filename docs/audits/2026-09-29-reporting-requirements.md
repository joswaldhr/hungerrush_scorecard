# Core 1:1 reporting requirements and source qualification

## September 29 viewer follow-up

Authenticated **1x1 / Last Week** inspection now verifies the selected report filters
and dates without opening editors. See [viewer contract findings](2026-09-29-menufy-viewer-contract.md).
Inbound, outbound, CSAT, ticket updates and state time have different group scopes.
Away/Transfers Only comes from the historical Agent state daily report, filtered to
Talk/two support groups; its displayed Sum includes Online. This closes source discovery
and named selection gaps below, not state-history automation, complete report delivery,
human provenance or September 20–26 qualification. No new assignments or publication.

## Retained manager-template baseline — discovered September 29

A local two-page PDF of the manager's Rippling 1:1 template, printed June 11, 2026,
provides direct historical workflow evidence. Page 1 was text-extracted and visually
inspected; page 2 contains only the print footer. The file is a blank template, not
employee performance evidence. Private source SHA256:
`3c2bee4eafa045ffcdb7c9dfa3a99d29ed815699ca076cbcf622dfd7040ba84a`.
The PDF/screenshots, private template URL and identity information are not committed.
The source's age means current use and unchanged requirements are not established.

The template has **13 metric prompts**, plus two separate attendance prompts and
discussion/ticket-review/action-item sections. Seven metric labels have corresponding
assigned Cadence keys; six do not. Label correspondence does not certify the calculation.
This is the concrete starting meeting-pack baseline, distinct from the 21 currently
assigned Menufy keys and their existing acceptance obligations. Do not silently drop
existing requirements or claim the template is already covered by the current key list.

| Template prompt | Current mapping / required work |
|---|---|
| IB calls offered | `inbound_calls_offered`; saved filter and offered-component version qualification |
| IB answered | `inbound_calls_accepted`; confirm accepted-leg meaning versus distinct calls |
| Declined | `declined_calls`; retain transfer-declined inclusion and exact leg scope |
| Missed | `missed_calls`; retain call-date and source scope |
| Percent of calls answered | No assigned equivalent; accepted/offered is the retained report formula, but both sets must use one qualified scope/version; no offers means no sample, not 0% |
| OB calls | `outbound_calls`; reconcile participating calls with the report's attribution |
| Tickets updated | `tickets_updated` exists but is withheld; template label alone does not resolve events versus distinct tickets or approved human attribution |
| Away | No assigned equivalent; establish source, unit and historical coverage |
| Transfer only | No assigned equivalent; establish source, unit and historical coverage |
| Total hours away / transfer only | No assigned equivalent; establish compatible state durations, period boundaries, overlap and complete capture before summing |
| Total IB Talk Time | No assigned equivalent; retained report SUM leg talk is relevant. Do not replace with `avg_talk_time_inbound` or reconstruct from rounded averages |
| Total OB Talk Time | No assigned equivalent; qualify source leg SUM and report participation scope, distinct from `avg_talk_time_outbound` |
| CSAT Score | `csat_score`; match the released contract to the manager's intended rating cohort |

The separate attendance prompts concern current points and rolling 90-day unplanned
attendance. Source and policy ownership are not established. Do not infer attendance
points or employment judgments from Zendesk state durations. Leave the existing HR
workflow in place while the user has explicitly limited this phase to Zendesk metrics.
Discussion/ticket review/action items are not numerical source contracts.

### Important source limit for the state-time prompts

The official [Zendesk Talk Stats API](https://developer.zendesk.com/api-reference/voice/talk-api/stats/)
documents agent away/transfers-only duration fields, but its statistics cover only the
current day from midnight in the account timezone. This endpoint alone cannot retrieve
last week's complete state durations. This was documentation review, not an authenticated
API call. Do not add today's counter to a weekly scorecard, sum repeated cumulative
observations, or promise a historical reconstruction without a complete history source.
Investigate the actual report/source used for these prompts when viewer access returns.
Assembled remains parked; no WFM connector or status collector was activated.

Immediate delivery priority is now the historically evidenced manager pack: qualify
offered/answered and answer percentage together; retain total-talk measures explicitly;
resolve the state-history and human-update dependencies. Existing response/quality and
other assigned metrics stay intact. New metric keys/assignments are not created by this
requirements correction, and no production arithmetic or certification count changes.

## Active Menufy comparison — September 29

Assembled is parked under the latest user instruction. From the retained assignment
inventory below, Menufy's immediate scope is **21 assigned metric keys / 23 employees**:
four ticket/elevated keys, three response/quality keys, nine inbound keys and five outbound
keys. POS's 19 assignments remain in the overall 40-assignment inventory, outside this
phase. This is a scope count, not 21 certified formulas or proof that Barbara's complete
manual pack contains no additional columns. No fresh production census was run for this
comparison. Historical eligibility must be evaluated for each reporting interval.

| Menufy family | Code/evidence trace | Current gap and next concrete check |
|---|---|---|
| Tickets resolved/updated (2) | `zendesk.ts` legacy normalization; `domain/metrics/availability.ts` withholds both; retained ticket report groups update events by updater | Report update events are not distinct human-worked tickets. Keep unavailable until source-bound human attribution is established; full report group filters remain unknown. |
| Worked elevated/avoidable (2) | `zendesk.ts` tag recognition and legacy normalization; retained report field evidence | Tag presence and current ticket flags do not establish employee work at event time. Establish Menufy classification/attribution before using report totals. |
| First reply (1) | `zendesk-first-reply.ts`, its policy/record/connector, and `first-reply-contributors.ts` | Explicit created-date/current-assignee business-time contract exists. Finish closed-week/target/readiness evidence; do not replace with resolution time or agent effort. |
| CSAT score/response rate (2) | `zendesk-solved-csat.ts`, CSAT policy/record/connector; retained parity/recovery evidence | Preserve solved-date/current-assignee populations and separate denominators. Reuse independent arithmetic evidence and close current operational/target gates. |
| Inbound counts and durations (9) | `zendesk-talk-participation.ts` candidate, `zendesk-call-reference.ts` independent report comparator; September 25 parity and September 28 definition review | Candidate has explicit three/four-component offered variants. Independent comparator previously only supported three; corrected below. Full saved filters and version still need evidence. Report SUM talk/MAX hold remain distinct from candidate averages. No inbound production publisher was activated. |
| Outbound counts and durations (5) | `zendesk-outbound.ts` and record/observation/connector; `outbound-contributors.ts`; retained Menufy release evidence | Current-week controlled values were independently matched. Close actual scheduled readiness and closed-week provenance; never extend that evidence to earlier weeks implicitly. |

Paths above are under `src/lib/connectors` except explicitly named domain files. Shared
publication uses `domain/metrics/compute-values.ts`; its normalized-fact aggregation is
not an independent source comparison. `configuredOutboundPolicy()` explicitly rejects
inbound policy entries. This pass did not alter either publisher or source policy.

### Independent report checker correction

`referenceInboundCalls` now accepts an explicit offered definition, returns the selected
definition plus unreachable/offered leg IDs and counts, and rejects unknown definitions.
Omitting it retains the earlier three-component result for historical diagnostic callers.
The newer four-component option includes only eligible unreachable agent legs after the
existing employee, call-date/timezone, direction, group and line filters. Multiple attempts
on one call remain distinct legs. SUM talk and MAX hold populations stay unchanged.

This is diagnostic code, imported only by its tests in tracked source; it neither publishes
metrics nor proves the saved report's exact current filter scope. Synthetic regression
checks cover repeated attempts, supervisor/other-agent exclusion from offered, group/line/
date/direction exclusion, legacy compatibility and invalid definitions. All 23 tests across
reference, participation and observation pass; TypeScript, scoped ESLint and formatting pass.
The initial pnpm runner refused the shared node_modules junction before running tests;
existing Node package entrypoints were used without reinstalling or removing dependencies.
No environment file, production DB or vendor API was accessed by these tests.

The corrected reference was then replayed against retained private source/report files:
all **448 comparisons across 56 report row-weeks** preserve the older saved results.
On that same older scope, adding unreachable legs changes one September 13–19 row by
two attempts and five September 6–12 rows by 24 attempts in aggregate. This confirms
the definition difference can affect employee results; it is not proof of parity with
the September 28 report's complete filter selection. The private inspection record
identifies the newer inbound report as linked to the agent-audit dashboard, but records
filter names rather than all selected values. See the aggregate
`2026-09-29-menufy-offered-reference-replay.json`; no source rows are committed.

### Completion-status scope and retained CSV inspection

The September 28 inspection records a leg-completion-status filter, but not its selected
values. The independent comparator now supports an explicit status list for the entire
report population, including durations and abandoned-call participation. Undefined/null
preserves the earlier unfiltered replay, an empty array explicitly selects no statuses,
and unknown or duplicate selections fail. Output retains the selected filter. This
implements a comparison capability, not a choice of the manager's actual filter.

Read-only inspection of the two September 25 inbound CSVs found 920 and 1,007 matched
named leg rows, respectively. There were no duplicate named leg IDs, missing source
joins or rows outside the retained period/direction/group/line scope. The rows include
two and 24 unreachable attempts. Both files represent two groups and two lines with
activity, whereas the known earlier report scope selected four groups and three lines.
Thus observed row membership cannot reconstruct the selected filters. CSVs contain
no saved-filter metadata, and do not establish September 28 scope or current use.

The exported columns additionally include answer percentage, transferred-to and distinct
inbound calls. Their presence does not prove that Barbara requires them in the meeting
pack. Keep these potential report-to-scorecard differences explicit; do not silently
add them to or omit them from the final manager requirements.

A September 29 attempt to reach the ordinary Explore viewer failed in Microsoft sign-in
with AADSTS90015 (query string too long), before any Zendesk report/dashboard opened.
The failed tab was closed; user sign-in through the normal company path and a dashboard
viewer was requested. No authentication settings, sessions or permissions were changed.
The remaining selected-filter evidence gap is pending access. No editor fallback is allowed.

Validation: 26 targeted synthetic tests and TypeScript pass; the test scope contains no
database/API work. Retained source/export files were read locally and never modified.

September 29. Working inventory reconstructed from production assignments and retained
manager-report evidence. This is not a claim that both managers have confirmed their entire
manual workflow. Cadence remains a standalone scorecard app; Rippling explains the export
requirement. Company hosting and broader dashboards are separate future work.

## Current required inventory

Fresh read-only production inventory: **23 assigned keys / 40 team assignments**, unchanged.
M = Menufy, P = POS. Definitions below are requirements or explicit unresolved choices,
not permission to alter the existing qualified source contracts. Existing values and
policies remain unchanged. The metric acceptance ledger owns certification status.

| Metric key | Teams | Required meaning / remaining source decision |
|---|---|---|
| tickets_resolved | M, P | Distinct tickets with a verified human solve by the employee in the period; retain reopened/automation policy and source action evidence. Assembled viewing or current assignee cannot substitute. |
| tickets_updated | M, P | Distinct tickets with verified human updates. Manager update-event totals are a different measure; retain the approved human-only policy. |
| worked_elevated_tickets | M, P | Employee work on qualifying elevated tickets; qualify each team's fields and event-time attribution. A checkbox alone is insufficient. |
| avoidable_worked_elevated_tickets | M, P | Qualified worked-elevated population plus independently supported avoidable classification. |
| avg_handle_time | P | Active handling effort, not elapsed resolution time. Assembled solved ticket-viewing effort is a candidate with lifetime numerator and exclusions still unqualified. |
| avg_response_time | M | Existing qualified first public reply / business-time contract; preserve solved/created cohort and observation semantics defined by its released policy. |
| csat_score | M, P | Existing qualified solved-date/current-assignee contract, good responses divided by eligible rated responses. Preserve empty cohort handling and version. |
| csat_response_rate | M | Existing qualified rated/eligible-offer population and solved-date scope. Preserve denominator evidence. |
| backlog_count | P | Assigned open-work snapshot at a disclosed observation time. Do not call a later observation an end-of-week backlog. |
| inbound_calls_offered | M, P | Explicit employee offer/participation population. Retained Menufy formula includes unreachable legs; reconcile definition/version before publication. |
| inbound_calls_accepted | M, P | Qualified accepted employee legs with status/positive-talk rules and exact source sets. |
| declined_calls | M | Distinct qualifying declined/transfer-declined employee legs under retained report scope. |
| missed_calls | M | Distinct qualifying missed employee legs; preserve call-date scope and timezone. |
| inbound_calls_abandoned_on_hold | M, P | Actual on-hold abandonment with disclosed participation attribution. POS report's IVR/queue/voicemail formula is not this measure. |
| avg_talk_time_inbound | M, P | Employee leg talk sum / eligible measured legs; Menufy SUM is not an average. |
| avg_hold_time_inbound | M, P | Explicit employee hold numerator/denominator. Menufy MAX and repeated POS whole-call hold are different measures. |
| avg_call_duration_inbound | M, P | Qualified employee leg duration mean, distinct from entire customer call duration. |
| avg_consultation_time_inbound | M, P | Employee leg consultation mean; distinguish zero from missing measurement. |
| outbound_calls | M, P | Existing qualified distinct employee-participating call population; retain delayed-parent coverage checks. |
| outbound_calls_completed | M, P | Qualified participating calls with explicit completion classification, not a guessed complement. |
| outbound_calls_non_answered | M, P | Qualified non-answer outcomes; unknown outcomes remain unavailable. |
| avg_talk_time_outbound | M, P | Existing qualified employee leg talk numerator and measured-leg denominator. |
| avg_hold_time_outbound | M, P | Existing qualified employee leg hold numerator and measured-leg denominator. |

All duration exports must agree with the displayed H:MM:SS value while retaining source
units and exact sums/denominators. Do not silently change stored minutes to seconds.
Every metric also needs identity/effective membership, reporting timezone/date basis,
zero/no-sample behavior, compatible historical targets, freshness and revisions. Full
contract acceptance remains **0/40**; the last ledger checkpoint has production arithmetic
verified for **14/40**. These counts are not an accuracy percentage or work estimate.

## Assembled requirements to qualify before assignment

Assembled is core to the user's reporting workflow, but exact additional manager columns
have not been established from retained evidence. Keep this list separate from the 40
existing assignments until requirements and source meaning are confirmed.

| Candidate | Proposed source | Qualification needed |
|---|---|---|
| Schedule adherence | Assembled adherence report | Distinguish schedule adherence from productive adherence; capture activity mappings, grace/exclusion settings, actual-state coverage and numerator/denominator. Existing definition has no assignments. |
| Scheduled time | Assembled activities / report | Master schedule, layers, clipped boundaries, productive/auxiliary/time-off exclusions, channel scope and unit. Planned time is not attendance. |
| Actual worked/productive time | Assembled adherence report and states | Correct all-channel vs channel-specific field, state mapping, overlap/missing-state policy and exact reporting period. Not payroll hours. |
| Ticket handling effort | Assembled solved-effort report | Units, full lifetime effort attached to solved cohort, touched-ticket denominator, exclusions and account integration mode; do not replace tickets resolved or human action evidence. |

First-contact resolution also has an unassigned definition; availability in a source UI
does not establish a valid scorecard formula. Do not fabricate or activate it from counts.

## September 29 source observations

The configured Assembled key works. One complete people page returned 104 unique records.
All 23 Menufy employees and 38 of 39 POS employees matched uniquely to nondeleted people.
The remaining POS employee has one exact-email Assembled record marked deleted and no
stored Assembled identity available to resolve it. This supersedes September 25's 62/62
nondeleted roster coverage **for the new observation only**. It does not establish when
or why the source person was deleted, termination, or historical ineligibility.

Six schedule samples (one deterministically selected employee per team, two closed weeks
and a partial current week) returned 168 segments. No invalid intervals, foreign employees,
unknown activity types, duplicated segment IDs or overlapping segments were observed.
Base activity IDs repeat across segments; deduplicating by base ID would discard schedule
data. This is structural availability, not all-employee or metric qualification.

The account returned 18 activity types. No names, identities, schedule contents, descriptions,
credentials or raw vendor records were persisted. Eight GETs collected the census and samples;
one additional GET classified the identity gap. Initial database-only attempts stopped at an
incorrect team-slug guard before vendor requests; it was corrected from verified slugs.

The user's key-list screenshot shows API version 2025-04-15 for the displayed keys. The
API response did not disclose a version, and the configured secret has not been matched to
a named row. Do not regenerate/revoke keys or assume a new version is needed. No version
override was sent. Existing source support remains retired; no report-generation POSTs,
source mutations, employee changes, publication or scheduled integration were performed.

Evidence: `2026-09-29-assembled-readonly-census.json`,
`2026-09-29-assembled-identity-gap.json` and the prior workforce capability report.
API field/endpoint references: [Assembled API](https://docs.assembled.com/).
Retained manager formulas: `2026-09-28-report-definition-review.md`.

## Execution sequence and completion gates

1. Resolve the deleted-person identity/effective-date gap using retained evidence and
   read-only source records; never restore or silently remap a person as a diagnostic.
2. Capture the precise manager-required Assembled columns and account calculation settings.
   Use retained exports or ordinary read views; Zendesk editors remain prohibited.
3. Reuse prior reports when recoverable. Before generating analytical reports, record the
   employee/channel/period scope and request budget explicitly. Report generation is POST,
   not a GET probe. It must not alter schedules, definitions, people or source settings.
4. Reconcile required reports for every eligible employee in two closed weeks plus current
   week; compare exact source sets, sums and denominators. Qualify boundaries, multiple layers,
   zero/no-sample, late changes and effective identities. One sample cannot close this gate.
5. Implement an inactive, bounded source adapter and transactional versioned publication only
   after the metric contracts are settled. Preserve last-good values on incomplete reads.
6. Complete isolated synthetic persistence/UI/export tests, fresh backup/restore and scoped
   canary gates before production activation. Verify genuine scheduled operation separately.
7. Require both managers' agreed report pack to need no manual reconstruction in actual
   weekly use. Presentation polish, unavailable values and successful API access do not
   close the reporting requirement.

The read-only diagnostic has a local exclusive lock, fixed API origin/endpoints, GET-only
transport, redirect rejection, 12-request/180-second budgets, 30-second request timeout,
8 MB response limit, 700 ms request spacing and no retry. It never imports the app connector
or changes its capabilities. Synthetic guard tests run without any environment file or DB.
