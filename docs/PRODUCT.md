# HungerRush Cadence --- Product Specification v0.2

**Revision note (2026-09-03):** After a stakeholder review, this spec was narrowed from the
original four-screen, multi-vendor design (v0.1, below history preserved in git) down to two
screens fed by Zendesk alone. The 1:1 workflow features (coaching records, quality reviews,
action items, meeting notes) were cut as "fluff" — the ask is a simple, accurate metrics
scorecard, not a meeting-management tool. Assembled and Rippling integrations were dropped
entirely; team/roster membership now comes from Zendesk groups only. See
`docs/audits/2026-09-01-metric-integrity-report.md` and this repo's commit history
(2026-09-02 through 2026-09-03) for the full reasoning trail.

## What Cadence Is

Cadence is a manager intelligence application that turns Zendesk support data into a clear
team comparison view and a simple, accurate 1:1 scorecard for each direct report.

Support managers currently prepare for recurring performance conversations by manually pulling
information from Zendesk and other tools. This takes time, produces inconsistent results, and
means managers often walk into meetings under-prepared or relying on memory.

Cadence replaces that manual gathering with a single application that normalizes Zendesk data,
computes real weekly metrics per employee, and presents them grouped the way the legacy paper
scorecards did --- organized for a 1:1 conversation, not a dashboard.

### Target Users

Front-line support managers who run recurring 1:1s with direct reports. These managers need to understand weekly performance trends, identify who needs attention, recognize improvements, and prepare for productive conversations.

The pilot targets two specific teams at HungerRush:
- **HungerRush POS Support** --- the POS product support team
- **Menufy Support** --- the Menufy product support team

These teams have different metrics, different targets, and different team sizes. One configurable platform must serve both without hard-coding either team's specific needs.

### Success Criteria

A pilot manager can open Cadence, compare everyone on their team, and pull up an accurate,
easy-to-read metrics scorecard for one direct report before a 1:1 --- without manually
gathering the same information from Zendesk by hand. The product must demonstrate actual
reduction in manager preparation time.

---

## The Two Core Experiences

Cadence has two screens. Home and the workflow-heavy "1:1 Preparation" page described in v0.1
were cut; the manager's journey is now direct: compare the team, then check one person's
numbers.

### Team

**Question:** "How is everyone doing?"

**Principle:** Team compares.

Team is a scannable, filterable view of all direct reports. It lets the manager quickly compare employees, spot patterns, and drill into individuals.

**Information hierarchy:**
1. Team summary --- status distribution (on track / watch / needs attention), team trend
2. Filters --- team, period, view mode, status filter, search
3. Employee table --- each row shows identity, status, key change this week, weekly summary, trend sparkline
4. Metrics view --- an alternate tab showing the full configured metric set in a comparative table

The table is paginated. Employees link through to their 1:1 scorecard.

### 1:1s

**Question:** "What do I need to know before I meet this person?"

**Principle:** 1:1s prepares --- with numbers, not narrative.

A single, simple, data-driven metrics table for one employee, grouped by category the way the
legacy paper scorecards were. No coaching records, no action items, no notes, no executive
summary --- just the numbers a manager needs before a 1:1, organized to be scanned in under a
minute.

**Information hierarchy:**
1. Identity header --- name, role, team, manager, overall status
2. Period selector --- this week through 3 weeks ago (single calendar weeks only --- see
   Architecture note on periods, below)
3. Metric categories --- one table per `metricDefinitions.category` actually assigned to this
   employee's team (e.g. Ticket/Case Work, Inbound Call, Outbound Call), each row showing this
   week, last week, target, status, and a trend sparkline
4. A category renders only if it has at least one assigned metric with real data --- never a
   placeholder row for an unbuilt metric

**Architecture note on periods:** metric values are stored one row per calendar week
(Monday--Sunday). A "Last N Weeks" selector that requested a multi-week span here would ask for
a row that's never written and would silently show "No Data" for everything --- this was
found and fixed 2026-09-03. A true multi-week rollup would need weighted re-aggregation from
the underlying facts, not a wider exact-match query on `metricValues`.

---

## What Cadence Is Not

**Not a BI tool or report builder.** Cadence does not provide ad-hoc queries, custom report creation, or a drag-and-drop dashboard editor. It presents a curated, opinionated view of what matters.

**Not an employee ranking system.** Cadence does not produce stack rankings, forced distributions, or automated performance ratings. It informs manager judgment; it does not replace it.

**Not an automated decision-maker.** Cadence does not trigger employment actions, generate performance improvement plans, or make recommendations about hiring, firing, or compensation.

**Not an AI product.** The briefing engine is template- and rule-driven. There is no LLM dependency. AI may inform future features, but it is not the foundation.

**Not a Zendesk replacement.** Cadence consumes Zendesk data. It does not replicate Zendesk's functionality or replace the need to use it for its primary purpose.

**Not a mobile app.** The pilot is desktop-first. Managers use Cadence on laptops and desktop monitors.

**Not a company-wide platform (yet).** The MVP serves two pilot teams. Broader rollout is a future decision based on pilot results.

---

## Product Principles

**Manager time is the product.** Every design decision should be evaluated against: does this reduce the time a manager spends preparing for performance conversations?

**Summarize, don't overwhelm.** Show what changed and what matters. Do not show everything that exists. Prefer fewer, more meaningful signals over comprehensive data dumps.

**Data-driven configuration.** Metrics, targets, assignments, and team views are configurable per team. Nothing about the metric set, target thresholds, or display order should be hard-coded to one team's current needs.

**Source honesty.** Never silently turn missing, stale, or partial data into zero. Always communicate data freshness and provenance. If a sync failed or data is old, say so.

**Vendor independence.** External systems are data sources behind a connector boundary. The domain model, UI, and business logic must not depend on Zendesk, Assembled, or Rippling schemas. If a vendor is replaced, only the connector changes.

**Evidence over opinion.** Every observation, trend, or status must trace back to specific metric values and calculation rules. No unattributed claims.

**Progressive disclosure.** Team shows the comparison. 1:1s shows one person's numbers. Each layer adds depth without repeating the previous layer's job.

**Premium, not enterprise.** The visual standard is modern restrained SaaS (Linear, Stripe, Ramp, Vercel quality). Not a dense enterprise reporting portal. Whitespace, hierarchy, and restraint over decoration, density, and feature count.

---

## Pilot Scope

### Teams

| Team | Source System | Roster Source | Notes |
|------|---------------|----------------|-------|
| HungerRush POS Support | Zendesk | Zendesk groups (`CustSup - Support Complex Queue`) | Manager: Alexander Smith |
| Menufy Support | Zendesk | Zendesk groups (`Menufy Support - Consumers` + `- Restaurant`) | Manager: Barbara Maenza |

Assembled and Rippling were both evaluated and dropped. Assembled never had accounts for most
of this roster (verified live: 11 of 36 pilot employees, 31%) and its workforce-state API
couldn't produce Schedule Adherence in any case. Rippling never had a real integration beyond
a stub connector and a static link-out. Team/roster membership is Zendesk-groups-only now (see
`docs/audits/2026-09-01-metric-integrity-report.md` Finding 6, and this repo's roster
reconciliation work, 2026-09-02 through 2026-09-03).

### Metric Categories

Exact metrics are configured per team via `metricDefinitions`/`metricAssignments` --- nothing
below is hard-coded into the app. Categories match the legacy paper scorecard's structure:

- **Ticket/Case Work** --- resolved, updated, worked/avoidable elevated tickets (live)
- **Inbound Call** --- offered, accepted, abandoned on hold, avg talk/hold/duration/consultation (live, via Zendesk Talk)
- **Outbound Call** --- total, completed, non-answered, avg talk/hold (live, via Zendesk Talk)
- **Status/Time, Overall Performance (Schedule Adherence, Occupancy)** --- **not yet built.**
  Zendesk Talk's agent-presence API only exposes live/current state, not a historical
  range query, so these can't be computed with the current architecture. Building them needs a
  new scheduled polling capability (snapshot agent state on an interval, accumulate history
  going forward --- no backfill possible). Same root cause also blocks the Missed, Declined,
  and both Transfer call metrics within Inbound/Outbound Call.

### Integration Scope

- **Zendesk** --- the only live data source. Ticket activity, CSAT, and elevation tags for
  case-work metrics; the Talk incremental-calls export for call metrics; Zendesk groups for
  roster/team membership. All fields verified live against the real HungerRush account, not
  assumed from generic documentation.
- **Assembled, Rippling** --- evaluated and dropped. No connector code remains.

### What Ships

- Two core screens (Team, 1:1s) working from normalized Cadence-owned data
- Configurable metric definitions, assignments, and targets per team
- Historical metric values (one row per calendar week) with trend and change detection
- Server-side authorization (managers see only their assigned teams and employees)
- Loading, empty, stale, and error states throughout

### What Does Not Ship (current scope)

- Mobile application
- Generic BI or report-building capability
- AI/LLM-powered features
- Company-wide rollout beyond the two pilot teams
- Coaching records, quality reviews, action items, meeting notes --- cut as workflow "fluff"
  per stakeholder feedback; a manager's own notes may return in a lighter form later, not
  decided
- Status/Time, Schedule Adherence, Occupancy, Missed, Declined, and Transfer metrics --- see
  Metric Categories above; blocked pending a decision on building an agent-state poller
- Employee self-service views
- Any integration beyond Zendesk
