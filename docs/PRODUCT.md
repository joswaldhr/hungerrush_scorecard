# HungerRush Cadence --- Product Specification v0.1

## What Cadence Is

Cadence is a manager intelligence application that consolidates employee performance data from multiple company systems into a clear weekly briefing and 1:1 preparation experience.

Support managers currently prepare for recurring performance conversations by manually pulling information from Zendesk, Assembled, Rippling, and other tools. This takes time, produces inconsistent results, and means managers often walk into meetings under-prepared or relying on memory.

Cadence replaces that manual gathering with a single application that normalizes data from these systems, detects meaningful changes, and presents the information a manager actually needs --- organized by urgency and relevance, not by source system.

### Target Users

Front-line support managers who run recurring 1:1s with direct reports. These managers need to understand weekly performance trends, identify who needs attention, recognize improvements, and prepare for productive conversations.

The pilot targets two specific teams at HungerRush:
- **HungerRush POS Support** --- the POS product support team
- **Menufy Support** --- the Menufy product support team

These teams have different metrics, different targets, and different team sizes. One configurable platform must serve both without hard-coding either team's specific needs.

### Success Criteria

A pilot manager can open Cadence, understand their team's important weekly changes, inspect an employee, and prepare for a 1:1 --- without manually gathering the same information from multiple systems. The product must demonstrate actual reduction in manager preparation time.

---

## The Four Core Experiences

Cadence has four screens. Each answers a different question at a different level of detail.

### Home

**Question:** "What happened this week that I need to know?"

**Principle:** Home summarizes.

Home is a weekly manager briefing. It is selective, not comprehensive. It surfaces what changed and what needs the manager's attention, then gets out of the way.

**Information hierarchy:**
1. Team at a glance --- employee count, status distribution (on track / watch / needs attention)
2. Needs attention --- employees with declining or concerning metrics, with brief explanation
3. Notable improvements --- employees showing positive trends worth recognizing
4. Upcoming 1:1s --- scheduled meetings with direct links to preparation
5. Compact team performance --- a summary table of key team-level metrics with week-over-week and trend data

Home must not become a wall of metrics. It is a briefing, not a dashboard.

### Team

**Question:** "How is everyone doing?"

**Principle:** Team compares.

Team is a scannable, filterable view of all direct reports. It lets the manager quickly compare employees, spot patterns, and drill into individuals.

**Information hierarchy:**
1. Team summary --- same status distribution as Home, plus overall team trend
2. Filters --- team, period, view mode, status filter, search
3. Employee table --- each row shows identity, status, key change this week, weekly summary, trend sparkline, and next 1:1 date
4. Metrics view --- an alternate tab showing the full configured metric set in a comparative table

The table is paginated. Employees link through to the Employee detail page.

### Employee

**Question:** "What's actually going on with this person?"

**Principle:** Employee explains.

Employee is the analytical detail page. It provides the full picture for one person: current state, what changed, historical trajectory, and surrounding context.

**Information hierarchy:**
1. Identity and status --- name, role, team, manager, overall status
2. Executive summary --- a brief narrative of the week's key takeaway
3. What changed this week --- each metric's movement with direction and magnitude
4. Performance metrics --- current values, prior values, targets, status, and trends
5. Historical performance --- a chart showing a selected metric over time against its target
6. Context --- coaching sessions, quality reviews, previous 1:1 notes, open action items, attendance
7. Data provenance --- source systems, last update time, employee ID, hire date

Employee links directly to 1:1 Preparation.

### 1:1 Preparation

**Question:** "What do I need to know before I meet this person?"

**Principle:** 1:1 Preparation prepares.

This is a meeting-focused distillation of the Employee page. It is visually calmer and organized around the conversation, not the data.

**Information hierarchy:**
1. Meeting header --- employee identity, meeting date and time
2. At-a-glance takeaway --- one-sentence summary plus key stats (metrics on target, improving, declining)
3. What changed this week --- same metric movements as Employee, in compact form
4. What to recognize --- positive trends and achievements worth calling out
5. What to discuss --- concerns, areas needing conversation, coaching opportunities
6. Previous context --- last 1:1 summary, open action items, recent coaching, quality reviews, attendance
7. Suggested questions (optional) --- conversation starters derived from the data
8. Meeting prep checklist --- a lightweight readiness checklist
9. Links out --- to the full Employee profile and to Rippling for the actual meeting

---

## Manager Journey

The intended workflow moves from broad to specific to action:

**Home** (what matters this week) --> **Team** (compare everyone) --> **Employee** (understand one person) --> **1:1 Preparation** (prepare for the conversation) --> **Rippling / existing meeting workflow** (conduct the meeting)

Each step narrows focus. The manager starts with a briefing, drills into whoever needs attention, reviews their full picture, then walks into the meeting prepared.

---

## What Cadence Is Not

**Not a BI tool or report builder.** Cadence does not provide ad-hoc queries, custom report creation, or a drag-and-drop dashboard editor. It presents a curated, opinionated view of what matters.

**Not an employee ranking system.** Cadence does not produce stack rankings, forced distributions, or automated performance ratings. It informs manager judgment; it does not replace it.

**Not an automated decision-maker.** Cadence does not trigger employment actions, generate performance improvement plans, or make recommendations about hiring, firing, or compensation.

**Not an AI product.** The briefing engine is template- and rule-driven. There is no LLM dependency. AI may inform future features, but it is not the foundation.

**Not a Zendesk/Assembled/Rippling replacement.** Cadence consumes data from these systems. It does not replicate their functionality or replace the need to use them for their primary purposes.

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

**Progressive disclosure.** Home shows the briefing. Team shows the comparison. Employee shows the detail. 1:1 Preparation distills it for the meeting. Each layer adds depth without repeating the previous layer's job.

**Premium, not enterprise.** The visual standard is modern restrained SaaS (Linear, Stripe, Ramp, Vercel quality). Not a dense enterprise reporting portal. Whitespace, hierarchy, and restraint over decoration, density, and feature count.

---

## Pilot Scope

### Teams

| Team | Source Systems | Notes |
|------|---------------|-------|
| HungerRush POS Support | Zendesk, Assembled, Rippling | Larger team, more established metrics |
| Menufy Support | Zendesk, Assembled, Rippling | Separate team, potentially different metric configurations |

### Metric Categories (Illustrative, Not Fixed)

Exact metrics are configured per team. Pilot categories are expected to include:

- **Ticket activity** --- volume, resolution, backlog (from Zendesk)
- **Quality measures** --- CSAT, FCR, quality review scores (from Zendesk)
- **Time measures** --- handle time, response time (from Zendesk)
- **Workforce measures** --- adherence, schedule compliance (from Assembled)

The specific metrics, their definitions, their targets, and their display priority are data-driven and will differ between the two pilot teams.

### Integration Scope

- **Zendesk** --- ticket and support performance data. Exact fields, scopes, and calculations must be verified before live integration.
- **Assembled** --- workforce and scheduling data. Same verification requirements.
- **Rippling** --- employee identity, manager relationships, and meeting context. Capabilities must be discovered; if needed data is unavailable, Cadence links out to Rippling rather than inventing an integration.

### What Ships

- Four core screens (Home, Team, Employee, 1:1 Preparation) working from normalized Cadence-owned data
- Configurable metric definitions, assignments, and targets per team
- Historical metric values with trend and change detection
- Deterministic briefing generation (template/rule-driven)
- Connector framework with verified Zendesk and Assembled integrations
- Rippling integration to the extent capabilities allow
- Data health visibility (freshness, sync status, source attribution)
- Server-side authorization (managers see only their assigned teams and employees)
- Loading, empty, stale, and error states throughout

### What Does Not Ship

- Mobile application
- Generic BI or report-building capability
- AI/LLM-powered features
- Company-wide rollout beyond the two pilot teams
- Complex workflow automation
- Employee self-service views
- Dozens of integrations beyond the three pilot sources
