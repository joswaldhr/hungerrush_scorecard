# Report-matched ticket credits

## October 8, 22:04 UTC — current closed-week row parity

The unchanged September 27–October 3 Menufy dashboard was exported again at 21:57
UTC in view mode; the viewer was closed without filters or editor changes. Compared
with the 17:28 UTC export, 18 cells changed across two update reports. The earlier
parent observation then differed on four employee rows. A fresh bounded parent
join (52 GETs, 4,911 parents, 40 explicit tombstones) restores exact agreement on
all 21 populated current-cohort update rows. Both implementations also agree on all
23 source counts and contributing event sets. One ticket left the selected scope
between the two parent observations. No formula or follower-event exclusion changed.

This supersedes the unexplained second-week count residual below for this export
and observation. It does not establish Explore's contributing update IDs, first-week
parity, fresh event/identity capture or POS semantics. The event capture used here
is still the retained October 6 stream. The two employees absent from the export
retain source-proven zeros, not invented independent report rows. This is the same
23-person source cohort; a meeting-roster archive does not erase historical activity.
No update metric was published. See [aggregate comparison](2026-10-08-menufy-update-late-parity.json).

The production event collector's separate read-only checkpoint is exhausted at
18:43 UTC with an 18:42 UTC watermark. At the 22:05 UTC check this is outside the
one-hour publication freshness window; it must not be described as a fresh capture.
Next qualification needs a fresh coordinated stream and identity snapshot, bounded
parent joins, independent report/source reconciliation across the required periods,
then a separate tested publication adapter and release. Existing solved publication
and legacy human-only restrictions are unchanged.

## October 8 current-cohort update investigation

The current-roster comparison is narrower and more precise than the all-report-row
totals below: of 23 eligible Menufy staff, 21 have rows in the retained September 27–
October 3 reference. Nineteen match; two differ by +1 and -1 update respectively.
The remaining two staff have no reference row, but the complete retained account event
stream contains zero events for each and both retained identities are agents. Re-running
the calculator for all 23 therefore proves those two source zeros; it does not invent
independent report rows or establish historical employment. See
`2026-10-08-menufy-update-cohort.json`. The first retained week's residual of two updates
also belongs to a current employee, distinct from the two second-week discrepancies.

Eleven paced, GET-only audit requests inspect seven low-volume reference updates and
eleven candidate updates on tickets shared by the two differing current employees.
Audit authors match the retained updater IDs, and no inspected comment has a different
author. This rules out author substitution for those candidates, not every update in
the interval. See `2026-10-08-menufy-update-author-check.json`. Excluding comment-only
updates is also rejected: the retained hypothesis breaks all 28 previously matching
rows among its 31 tested rows. Do not change the calculation to fit one small row.
Exact report-detail evidence or a demonstrated source/definition difference remains
necessary for the residuals. No update metric is published by this investigation.

## October 7 solved-only publication adapter

The two solved measures now have distinct qualified-publication contracts and a dedicated
connector using the existing atomic sync service. It independently replays retained
source evidence, checks source/employee/team/period ownership and effective assignments,
and fails on incomplete or stale captures. Staff/assignment changes and fetched-record
tampering stop publication transactionally. Full local PostgreSQL regression passes
(1,049 tests / 131 files). No live policy, route, catalog registration or publication is
enabled. The update-event measure and old human-only keys stay guarded. Fresh collection,
current-week as-of coverage, qualification/release gates and actual scheduled operation
remain tracked in [the completion matrix](2026-10-07-metric-completion-matrix.md).

The October 6 user decision authorizes report-matched credits with explicit labels,
separate from verified-human activity. This supersedes the pending policy choice in
[the earlier correction](2026-10-06-ticket-credit-correction.md). It does not qualify
the old current-assignee / last-updated snapshot or activate a publisher.

## Definition and scope

| Proposed key | Display label | Unit and attribution |
| --- | --- | --- |
| `zendesk_agent_update_events` | Agent update events | Distinct update IDs credited to a non-end-user updater account |
| `zendesk_tickets_solved_credits` | Tickets solved (Zendesk credit) | Distinct qualifying latest-solve update IDs credited to the updater account |
| `zendesk_assignee_solved_tickets` | Tickets solved (assigned) | Distinct currently solved/closed tickets by current assignee and latest solved date |

These names deliberately do not imply that several updates to one ticket are several
tickets, or that activity under an employee account proves manual authorship. Integration
activity credited to that account can be included. Existing human-only keys remain
unavailable where attribution is unverified. Existing targets cannot be copied to these
new definitions without validating their unit and intended scope.

The inspected Menufy saved report uses Support: Updates history, grouped by updater,
with distinct-count aggregation for agent updates and tickets solved. Its saved filters
select update date, six ticket groups and the Menufy brand. The retained reference uses
September 20–26 in America/Chicago. All 43 report names resolve uniquely against retained
source identities; this is identity matching, not historical employment certification.

The source contract counts each parent update once regardless of how many fields changed.
A solved credit requires a transition into solved/closed from a value other than solved,
a currently solved/closed parent ticket, and an update timestamp equal to the ticket's
latest solved timestamp. The updater-role condition belongs to the agent-updates measure;
it is not silently added to the separate solved formula. These semantics follow
[Zendesk's Updates history definitions](https://support.zendesk.com/hc/en-us/articles/4408827693594-Metrics-and-attributes-for-Zendesk-Support).

Ticket group/brand/status and latest solved time are observed parent attributes. Later
reopens, solves or scope changes can legitimately revise an older week's report. Preserve
the observation time and predecessor evidence; neither today's observation nor a retained
export is automatically a frozen end-of-week record. A source `Create` event can establish
the initial solved status without a previous value. Ten such events are required for the
first retained report comparison; including them matches all 43 solved totals. A `Change`
event with no known previous status still withholds the affected solved total.

Two POS saved reports were inspected briefly, separately, and closed without edits. One
uses COUNT(Solved tickets), assignee rows and solved-date filtering in Support: Tickets.
Another manager-owned report, despite its solved-ticket title, uses COUNT(Tickets),
assignee rows, a created-date filter and a custom team attribute. These differ from both
the legacy Cadence query and Menufy's updater report. The assignee report has no saved
group/brand filter; all 39 currently eligible POS employees map uniquely to its fresh
export. Its September 27–October 3 Central counts match all 39 employees / 1,411 tickets.
This establishes parity with that saved report, not that its name proves the manager's
intended canonical measure. Shared calculator
code does not authorize copying Menufy's six groups, brand or report filters to POS.

## October 6 read-only reconciliation

| Source interval and report | Employee rows | Solved counts matching | Agent update counts matching |
| --- | ---: | ---: | ---: |
| Menufy, September 20–26 retained export | 43 | 43 / 43 (4,151 total) | 36 / 43 |
| Menufy, September 27–October 3 fresh export | 42 | 42 / 42 (4,185 total) | 39 / 42 |
| POS assignee solved, September 27–October 3 fresh export | 39 | 39 / 39 (1,411 total) | Separate meaning; not assessed here |

The first event capture spans 88 pages / 88,004 raw rows; the second spans 86 pages /
86,043 rows. Page overlap is deduplicated. Complete parent joins require 64 and 54
source-confirmed deletion tombstones respectively; missing parents were not assumed
deleted. Independent Python reconstruction matches TypeScript's employee values and
all contributing sets: 13,469 update IDs / 4,151 solved IDs, then 13,672 update IDs /
4,185 solved IDs. POS's independent reconstruction matches all 1,411 ticket IDs and
39 employee counts from a complete 1,713-ticket padded source census. Source-set parity
between two implementations is separate from Explore row-count parity: the report
exports do not supply individual update IDs, so those sets are not claimed independently
matched to report-detail exports.

The old Menufy export's update total is 13,467. Later current-group changes explain
six of seven differing rows, leaving one residual difference of two updates after
the documented cohort adjustment. The fresh export's update total is 13,671 versus
13,672 calculated; three rows differ by one each. A bounded six-ticket audit of the
smallest row confirms all seven source update authors and finds no recent group/brand
change explaining its six-update report count. Do not relabel those residuals as
rounding, latency or human attribution without evidence; the update measure remains
unqualified. Solved measures can proceed through their own remaining qualification
checks independently.

The second event capture encountered one HTTP 429. Collection stopped, honored the
retained Retry-After and resumed with eleven-second spacing; no repeated throttling
occurred. Runtime collection must coordinate the account request budget and resume
across bounded invocations rather than attempting an entire week inside one function.
All brief report inspection/export tabs closed, with no changed filters, Apply or Save.
Private exports, identities, source rows and discrepancy details remain outside Git.

## Candidate and release boundary

`zendesk-ticket-report-credits.ts` is an offline pure calculation with explicit period,
timezone, account attribution and group/brand scope. It retains contributing update IDs,
deduplicates identical page overlap, rejects conflicting versions/duplicate joins, and
distinguishes missing parent/role/solved-time evidence from numeric zero. Source-confirmed
deleted tickets are excluded from the explicit current-group-filtered contract; a missing
parent is never assumed deleted. Conflicting present/deleted observations are rejected.
Incomplete event
coverage withholds both measures. No production source policy, metric definition, target,
assignment, publication flag, old human-action worker or historical repair is changed.

`zendesk-assignee-solved-report.ts` is the separate POS Tickets-dataset calculation;
it uses latest solved time, not last updated time, and preserves current-assignee meaning.
`zendesk-ticket-report-record.ts` builds minimized employee candidate records by replaying
the source calculation, binding account/employee/team/scope and retaining a conservative
observation timestamp. It does not accept supplied totals as evidence. The sync engine's
existing eligibility guard now explicitly blocks this candidate record type and both
new contracts, even if an eligibility marker is stripped or forged. No live collector
or normalizer consumes these records yet; activation requires a reviewed release change.

The inactive `zendesk-assignee-solved-collector.ts` now supplies the closed-week POS
candidate through bounded cursor search and fresh parent/metric-set joins. It shares
one request budget across both phases, rejects missing/duplicate/foreign parent joins,
strips ticket content and refuses an unfinished week. The existing account-bound,
GET-only transport supplies time limits, redirect protection and quota pacing. No
scheduled route consumes this collector.

A second POS source interval, September 20–26, completes with 38 GETs, 1,806 padded
source tickets and 1,464 qualifying tickets across 39 employees. Independent Python
agrees on every employee count and ticket set. Retained incremental history contains
solve events for all 1,464 tickets: 1,441 have the identical solved timestamp, and 23
have their solve event exactly one second after the metric-set solved timestamp.
This is an observed distinction between the two source contracts, not permission to
loosen Menufy's exact-timestamp formula. The POS Tickets-dataset calculation uses the
solved date and has no update-timestamp-equality condition. A regression test preserves
that distinction. No saved second-week POS report export is available; this source
cross-check is not represented as another Explore export match.

The source investigation reuses retained identity/report evidence and uses bounded
GET-only incremental events plus minimal parent-ticket joins. Account scope, continuation,
count and time boundaries are checked; requests are paced below the incremental export
limit. Raw source records and employee comparisons stay outside tracked files.

Before publication: resolve update-count residuals, obtain the additional POS closed-week
and current-week comparisons, establish the intended POS measure, and finish source-set
qualification against available independent evidence. Then wire bounded collection and
the inactive producer through atomic
publication/revisions, validate isolated Preview/export behavior, and follow the fresh
backup, canary and rollback gates. A passing pure-calculation test is not a certification
claim or evidence of deployed values.
