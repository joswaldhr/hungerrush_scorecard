# Cadence product direction and growth roadmap

September 29, 2026. Product direction requested by the user; proposed stages and
acceptance measures below are planning targets, not shipped capabilities or delivery dates.
The implementation ledger owns actual release and metric-qualification status.

## The product promise

Cadence is the place managers go to find their team's trusted metrics, already prepared
for the conversation or review they are about to have.

For the initial two managers, success means opening an employee's last completed week
and conducting a 1:1 without first rebuilding the numbers in Zendesk or a spreadsheet.
Over time, the same verified information should support more managers, recurring team
reviews and operational reporting. Managers contribute context and judgment; the app
handles repeatable collection, calculation, organization and presentation.

The repeatable unit is **manager + authorized people + reporting period + agreed metric
set**. A new manager should configure those choices, not commission a separate dashboard
or duplicate calculation code. Teams may have different metrics and targets. Shared
labels must not conceal different definitions, time bases or attribution policies.

## Staged growth

| Stage | Manager outcome | Proposed capability | Evidence needed to advance |
|---|---|---|---|
| 1. Dependable 1:1s for the two pilot managers | Open the scorecard and use it without reconstructing the numbers | Agreed core metrics, last-week review, honest freshness/availability, comparisons, history, presentation and consistent exports | Core metric contracts qualified; both managers use the product through two consecutive weekly review cycles; actual scheduled refreshes and recovery observed |
| 2. Repeatable onboarding for more managers | Get the right people and scorecard without a development request | Approved roster/manager mapping, reusable metric templates, effective-dated targets, scoped delegation, onboarding checklist and support ownership | Another manager can be onboarded primarily through configuration; allow/deny access checks and transfer/history tests pass |
| 3. Prepared recurring team reviews | Open an already assembled weekly or monthly review | Curated team summaries, compatible trends, service/workload totals and reusable meeting packs with employee drill-down | Managers identify specific recurring reports to replace; aggregates reconcile to exact source sets and denominators; no incomparable team ranking |
| 4. Continuity between conversations, if useful | Keep track of agreed follow-ups without maintaining a second tracker | Lightweight agenda, manager-entered notes, actions with owner/due date and previous-meeting context | Managers demonstrate the need; note visibility, retention, correction and access rules are approved; the metrics-only path stays simple |
| 5. Broader operational coverage | Use one familiar workspace across additional teams and approved sources | Additional metric families/connectors, monthly operational reviews, explicitly scoped leadership summaries and possibly employee self-service | Each source and metric is qualified; role and organization boundaries verified; IT ownership, capacity, recovery and costs accepted |

Stages describe an order of proof, not a commitment to ship every proposed feature.
Infrastructure work can proceed alongside the pilot when needed for reliability or
company ownership. A hosting migration does not automatically unlock later product stages.

## Stage 1: what meeting-ready means

The manager journey stays: **1:1s → employee → last week → metrics → meeting**.
Keep this week as clearly labeled progress and retain older-week navigation.

1. The manager sees only their authorized people, with the correct team and role.
2. The agreed core scorecard is populated automatically for its reporting period.
3. Each value has an understandable definition, unit, source period and observation time.
4. Zeros, no eligible activity, missing data and source failures are distinguishable.
5. Prior-week changes and targets appear only when their definitions and historical
   context are compatible. Current-week progress does not receive performance judgments.
6. The manager can present, share an authorized fixed-week link or export the same
   loaded snapshot without rebuilding a report.
7. A discrepancy can be reported with metric and period context, investigated by its
   owner, and corrected with retained revision evidence. Managers are not expected to
   calculate a replacement value in Cadence.

Define an explicit core metric set for each pilot team. Every core metric must be
qualified and available when its source cohort legitimately contains data. Unsupported
metrics remain visible with honest explanations where required, but they do not count
as completed pilot coverage. A week having ended is not proof that ingestion or
certification is complete. The current ledger still records unresolved qualification;
the pilot cannot be called complete merely because the page looks finished.

Separate three questions in the experience: **Has the period ended? Has the data arrived?
Is this metric qualified for this use?** An availability count answers only the second.

## Shared metric foundation

Define and own each metric once, then reuse it for scorecards, history, exports and
future team or leadership views. Its contract includes:

- Business meaning, intended use, source and accountable metric owner.
- Unit, numerator/denominator, inclusion/exclusion rules and employee attribution.
- Reporting timezone, period boundaries, observation cadence and expected availability.
- Missing/zero rules, quality limitations and reconciliation evidence.
- Definition version and effective date; applicable team/role and target version.

A weekly review, monthly pack and team total must not invent separate formulas. Monthly
percentages and average durations require appropriate underlying sums/counts; summing
weekly distinct tickets or averaging employee percentages can produce the wrong answer.
Reconcile each new aggregation before publication. New metric sets are curated
configuration, not an unrestricted formula editor for every manager.

Capture historical team/manager membership, definition and target context so a transfer
or changed target does not rewrite an earlier conversation. For an important review,
distinguish its retained as-presented snapshot from later corrected values, with the
revision and reason accessible. Existing stored weeks alone do not prove this full
meeting-snapshot feature is implemented.

## Scaling the people and workflow

Manager onboarding should select an approved roster scope, metric template and reporting
rules, then verify the first scorecard and access boundaries. Departures, transfers,
temporary cover and sub-manager assignments need explicit effective dates and audits.
Do not infer organization-wide access from a senior job title.

Keep responsibilities clear:

| Role | Proposed responsibility |
|---|---|
| Manager | Review assigned people, add context when supported and flag discrepancies |
| Metric/data owner | Approve definitions, source coverage, quality and corrections |
| Application administrator | Configure approved assignments, templates and permissions |
| IT/operations | Own hosting, deployments, security, backups, monitoring and recovery |
| Leadership viewer, later | See explicitly granted summaries; no automatic access to private notes |

Notes and follow-ups, if introduced, require separate visibility from shareable metrics.
Exporting a scorecard must not silently include private coaching material. Automated
reminders and calendar/email integrations are separate future decisions, not enabled by
this roadmap. Employee self-service likewise requires a defined access policy.

## Future navigation, without expanding today's UI

As needs become proven, possible destinations are:

- **1:1s:** the established person-and-week review, still the default for the pilot.
- **Team review:** curated totals/trends for an authorized team, proposed for Stage 3.
- **Review packs:** repeatable meeting/report formats built from the shared metric layer.
- **Follow-ups:** optional actions and meeting continuity, proposed for Stage 4.
- **Administration and data health:** configuration and operational support with role-based access.

Do not add empty navigation or restore the removed Team/Home experiences during roadmap
work. Later team views need a specific product design and acceptance decision. They are
not employee leaderboards. Keep administrative diagnostics away from the everyday manager
path while preserving clear user-facing data warnings.

## Success measures

Measure a baseline with both pilot managers, then compare actual usage; proposed targets
are not current results:

| Measure | Proposed acceptance |
|---|---|
| Manual preparation avoided | Both managers complete two consecutive weekly review cycles without manually reconstructing any agreed core metric |
| Time to prepare | Aim for under five minutes per employee; record baseline and observed time before agreeing a savings claim |
| Metric correctness | Every agreed core metric contract qualifies; no unexplained source-set, count or denominator discrepancy |
| Data readiness | Agree the meeting deadline per source and demonstrate scheduled publication by that deadline; surface exceptions promptly |
| Consistency | UI, fixed-period link, retained history and exports agree on period, definition, values and caveats |
| Onboarding | Add the next manager using approved configuration rather than a team-specific code fork |
| Trust and recovery | Explain a value, investigate a discrepancy and demonstrate recovery without losing newer work |

Track metric qualification, availability, scheduler reliability and manager adoption
separately. No single percentage should imply all four are complete.

## Immediate priority order

1. Close the outstanding core metric/source and scheduled-publication gaps for the pilot.
2. Finish the gated last-week review, navigation and export release for the main app.
3. Validate real meeting preparation with the two managers and record the baseline/results.
4. Specify reusable manager onboarding, effective-dated targets and metric ownership.
5. Select the next recurring report to replace, based on the managers' actual work, before
   designing team reviews or adding notes, new vendors or leadership pages.

Use the company-hosting proposal for deployment ownership and migration gates. Preserve
the frozen demo, Zendesk read-only boundary, unavailable unverified human metrics and
disabled ingestion/publication/repair features throughout. No application feature,
permission or metric policy is changed by documenting this direction.
