# Ticket-credit correction for both support teams

## Observed defect

Read-only production inspection on October 6 covers all 23 active Menufy employees
and all 39 active POS employees. All 248 source snapshots for the four Sunday-start
periods September 13 through October 4 use current-assignee / last-updated selection.
Retained post-close versions differ in 50 Menufy and 102 POS employee-periods,
affecting 21 and 39 employees respectively. This demonstrates changing saved counts;
it does not establish that each change is wrong or identify who performed an action.
No production writes or vendor API calls were required for this census. Employee
records, revision payloads and ticket IDs remain in private storage outside tracked files.

The legacy query selects tickets assigned to an employee **now** whose most recent
update is inside the period. Solved/closed status is then counted within that set.
It cannot measure the employee's updates or solve actions during that week. Later
updates or reassignment can remove tickets from its earlier-week selection.

## Saved report meaning

One brief, unmodified inspection confirms Menufy's saved report uses the Support:
Updates history dataset, D_COUNT(Agent updates), D_COUNT(Tickets solved), a solved
percentage, and Updater agent name rows. Filters are Update - Date, Ticket brand,
and Ticket group. The report tab was closed immediately; no filters, formulas,
Apply or Save were changed. Existing retained viewer evidence provides the group's
six-group/brand scope and the September 20–26 Central comparison interval.

The retained workbook establishes report totals, not a verified-human calculation.
Agent update events and distinct tickets updated are different units. The standard
Tickets solved definition also checks present solved/closed status and latest solve
timestamp. Reopening or later solving can legitimately revise that report. Report
parity therefore binds the report, scope, reporting timezone and observation time;
freezing an early value is not a general accuracy fix.

Official definition reference:
[Zendesk Support metrics and attributes](https://support.zendesk.com/hc/en-us/articles/4408827693594-Metrics-and-attributes-for-Zendesk-Support).
Alex's ticket report contract must be established independently; Menufy's saved
scope is not copied to POS. Neither report attribution nor a web/API channel proves
every underlying child action was human.

## Implemented containment, not a replacement metric release

- Real Zendesk agent-stat snapshots normalize both human ticket keys to explicit
  nulls, retaining the original payload as diagnostic evidence. This includes
  snapshot zero and absent updated totals; neither becomes a human-activity zero.
- Publication independently enforces the existing human-attribution restriction.
  Retained numeric contributors, a stale producer or a higher definition version
  cannot publish these keys as complete. A touched employee-period is stored as
  null with `unverified_attribution`; existing revision capture preserves its predecessor.
- The change applies across teams and employees. Unrelated metrics, source snapshots,
  employee assignments, targets, the frozen presentation branch and Zendesk are unchanged.
- This is not a historical repair job. On release, only employee-period groups touched
  by an ordinary scoped sync are recalculated. No replay is enabled and older untouched
  values remain preserved behind the existing read guard.

The user subsequently approved separate, clearly labeled report-matched credits on
October 6. The [new report-credit contract](2026-10-06-report-ticket-credit-contract.md)
owns that amendment and qualification work. This containment still prevents the invalid
assignee-to-actor conversion; approving report credits does not relax the old human guard
or make legacy assignee counts valid under the new definition.

## Release requirements

Local PostgreSQL regression covers two synthetic teams, missing/zero inputs, failed
fetch preserving previous values, scoped correction with predecessor revisions,
unrelated backlog values, untouched earlier periods, and stale numeric producer / high
version protection. Full test/type/lint/build evidence belongs in the implementation
ledger. This document alone does not assert deployment.

Code commit `133705a60e628425597686a05b6a734468290d8d` passes exact GitHub
CI/build `37523231917`, including all 997 tests. The local Windows build's existing
cross-root dependency-junction limitation is separate from that successful Linux build.
The correction is pushed to PR43; it is not merged, deployed or run on production.

Before production: focused reviewed candidate and exact CI, fresh encrypted backup and
validated restore, scoped before/after digests, one controlled sync, and actual scheduled
follow-up evidence. Keep action shadow ingestion, action-v2 publication and historical
repair disabled. Report-credit publication separately requires exact formulas and scope
for each manager, complete source sets, identity/timezone/null checks, independent
comparison for two closed weeks plus current progress, and display/export consistency.
