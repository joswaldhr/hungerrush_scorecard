# Assembled instance discovery — September 29

Read-only authenticated UI audit after the user signed in. This records aggregate
configuration and report capabilities, not certified employee results. No vendor
configuration, schedules, reports, permissions or credentials were changed. No
Zendesk editors were opened. No report-generation API was invoked. The metric
qualification denominator and certification counts remain unchanged.

## Purpose and relationship to Cadence

The observed instance combines workforce planning (forecast demand, required staffing,
schedules), operational monitoring (queues and current activity), and historical
workforce/performance reporting. Cadence should consume qualified measures from these
sources to prepare a single employee review; it should not recreate the scheduling
system or silently adopt every metric bearing a familiar name.

Zendesk and Zendesk Talk are shown as connected. The Zendesk integration displays read
scope and ticket/ticket-event sync indicators; Talk displays state, calculated-metric
and ticket sync indicators. These are UI configuration observations, not proof that
every record is fresh or complete. Assembled's ticket/call results are therefore not
automatically an independent source of truth for Zendesk: common upstream records can
reproduce the same omissions.

The Zendesk embedded app is marked installed and enabled for adherence calculations.
Chrome extension availability, Zendesk activity tracking and approved-website tracking
are enabled. This does not establish installation, activity coverage or data quality for
every agent. No employee monitoring configuration was changed.

## Observed report catalog

All five standard reports exposed under Report were opened as read views.

| Surface | Observed purpose and dimensions | Cadence relevance |
|---|---|---|
| Staffing timeline | Forecast volume; scheduled, required and net staffing; default schedule, Email/Phone; 76 agents in this view | Planned work and scheduling context; not actual attendance |
| Manage forecasts, Review tab | Daily actuals versus model forecasts; new cases, reopened cases, throughput; error measures | Future team capacity context, not employee 1:1 performance |
| Staffing heatmaps | Overall/by-queue views; scheduled, required and net staffing; 30-minute default interval | Team coverage context |
| Schedule analysis | Counts, total hours and distinct days by all/productive/unproductive/time-off events and event types | Candidate scheduled-hours and productive-hours inputs |
| Support volume | Forecast versus actual and Trends; cases opened/reopened/solved, first response, service level, abandoned contacts, occupancy, throughput and staffing | Queue/channel reconciliation; not automatically employee attribution |
| Team performance | 30 selected metrics, channel-specific columns, agent rows; reported update age about two hours | Main candidate workforce and effort comparison report |
| Agent scorecard | Productive adherence, scheduled utilization and solves/day in default trends; daily schedule/state/adherence/occupancy timeline | Explain individual observations and identify mapping/coverage issues |
| Real-time overview | Company view; current status, received volume, first response, service level and handling time by queue | Operational snapshots, not guaranteed end-of-week counts |

Real-time agent analysis was exposed in navigation but not opened. Scheduling automation,
requests, time-off workflows, AI features, permissions and individual employment details
were outside this metric discovery pass. Visible navigation does not prove an enabled
or qualified capability. The 76-person UI cohort and earlier 104-person API census have
different scopes; neither is the 62-person Cadence eligibility denominator by default.

## Team performance metric inventory

The selection dialog showed these 30 labels already checked. No checkbox was changed;
the dialog was cancelled. Selection does not imply non-null values or full coverage.

| Group | Labels |
|---|---|
| Schedule (16) | Productive adherence; Schedule adherence; Conformance; Conformance (strict); Scheduled hours (total); Scheduled hours (productive); Hours in productive adherence; Hours in schedule adherence; Actual productive hours worked; Actual hours worked (total); Actual productive hours percentage; Actual hours worked (non-productive); Occupancy; Occupancy (all channels); Scheduled utilization; Actual utilization |
| Performance (10) | Cases solved; Average handle time; Total handle time; Agent average handle time (solved); Agent ticket time (solved); Agent tickets touched (solved); Messages sent; Unique case solved rate; CSAT responses received; Average CSAT score |
| Productivity against schedule (4) | Solved (per scheduled hour); Solved (per actual hour); Messages sent (per actual hour); Messages sent (per scheduled hour) |

## Definition and configuration findings

Definitions below paraphrase the visible report tooltips; they do not resolve every
account-specific parameter.

| Finding | Consequence for qualification |
|---|---|
| Average handle time describes call/chat resolution effort, excludes Email, and divides total handling time by contacts. Its tooltip describes a typically created-date cohort. | Do not apply this label/formula to email effort or Cadence's legacy full-resolution duration. Verify the exact channel and cohort. |
| Agent average handle time (solved) divides agent ticket time by agent tickets touched. Tickets touched means distinct solved tickets viewed by the agent. | Candidate viewing-effort measure, not proof of the human who updated or solved a ticket. Retained methodology also requires lifetime effort to be distinguished from reporting-week activity. |
| Cases solved can count repeat solves differently depending on configuration; the tooltip also describes a typically created-date cohort. | Exact solve multiplicity, date basis and attribution remain unresolved. Never substitute this count for verified human actions. |
| Productive adherence compares adherence hours during productive scheduled events with productive scheduled hours. | Different denominator from schedule adherence; do not substitute because its percentage looks complete. |
| Schedule adherence describes matching scheduled events except time off. Data handling has this metric On and warns it requires a clock-in/out platform. | The prerequisite is not verified by the inspected connected integrations. Resolve before publication; a visible percentage is insufficient. |
| Automatic end-of-shift productive-state exclusions are Off; manual state editing is Off. | Test lingering states and their duration effect. Do not assume automatic trimming or change these settings. |
| Active state mappings associate ticket viewing with productive Email and Phone events, and Talk online/on-call/wrap-up with productive Phone events. Other states map to default or time-off categories. | Channel overlap and mapped-state meaning affect adherence/occupancy. Numeric occupied/available flags were not readable from the text representation and remain unverified. |
| Queue page shows 16 queues, POS/Menufy hierarchies, and exclusions based on tags/groups/brand, including automated-ticket exclusions. | Reconcile the eligible source sets after queue/exclusion rules, not just headline totals. Exclusion completeness/version history and rule priority are not yet qualified. No queue editor was opened. |

## Periods and observation times

- The signed-in profile and staffing/activity timelines display America/Los_Angeles.
  This is an observed user/display setting, not proof that every API report uses that zone.
- Team performance initially selected September 22–28, a rolling seven-day range.
  Scorecard, support-volume and heatmap views selected September 27–October 3,
  Sunday–Saturday. Schedule analysis selected a single day.
- Therefore even reports in the same account start with different date windows.
  Explicit epoch boundaries, timezone/DST, date basis, filters and as-of times are
  required for comparison with Cadence's Sunday–Saturday UTC period keys and existing
  source-specific reporting zones. No reporting calendar was migrated.
- Team performance, scorecard and support-volume displayed different update ages.
  Record per-report observation time; do not call values identical snapshots merely
  because they were inspected in one browser session.

## Qualification sequence informed by this audit

1. Define the required workforce columns separately: scheduled productive hours,
   productive adherence, schedule adherence and viewing-based handling effort are
   distinct contracts. Keep queue capacity metrics optional context rather than
   expanding the initial 1:1 scope automatically.
2. Establish actual-state coverage and the clock-in/out prerequisite, exact exclusions,
   state-to-event/channel mappings, missing-state treatment, overlap handling and zero
   denominators. Separate a scheduled absence from observed attendance.
3. Establish solved-effort cohort and full-lifetime numerator coverage, unique touched
   ticket denominator, units, idle/background-tab rules and channel eligibility. Do
   not relabel ticket viewing as human ticket actions.
4. Reconcile two closed weeks plus current progress for the complete eligible pilot
   roster using exact source sets and sums/denominators before rounding. The deleted
   identity gap remains open. Six structural schedule samples do not satisfy this gate.
5. Only after source and independent reconciliation gates pass, implement a separately
   disabled producer and isolated persistence/export tests, then use the documented
   family-sized release/canary/rollback procedure. No source activation in this audit.

Further discovery must use documented bounded read APIs or ordinary read views. Do not
open editors, generate analytical jobs, change vendor settings or broaden access to
resolve a gap implicitly. Previously rejected delegated execution tasks were not retried.

The browser was returned to the user's original staffing timeline. It displayed no
new changes to save; no configuration editor or metric-selection dialog was left open.
No production or demo code/configuration changed.

## Evidence references

Authenticated views inspected: `/staffing/timeline`, `/forecast/forecasts` (Review),
`/reports/heatmaps`, `/reports/schedules`, `/reports/support-volume`,
`/reports/team-performance`, `/reports/agent-scorecard`, `/realtime/v4/overview`,
`/settings/integrations`, `/settings/agent-states` (Mappings and Data handling),
`/settings/queue-and-exclusions`, `/settings/staffing`, and the profile timezone field.
These are UI observations, not retained exports or API reconciliation results. Raw
employee rows, source IDs, screenshots and report payloads are not committed.

See [requirements and prior bounded census](2026-09-29-reporting-requirements.md),
[execution plan](2026-09-29-cross-source-execution-plan.md), and
[discovery checkpoint](2026-09-29-cross-source-discovery-checkpoint.md).
