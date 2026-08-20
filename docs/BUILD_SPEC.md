# HungerRush Cadence — Claude Code Build Specification v0.1

## 1. Objective

Build Cadence incrementally as a production-quality modular monolith.

The first release must prove one central hypothesis:

> Can Cadence materially reduce the manual work two different Support managers perform when preparing for recurring employee performance conversations?

The application should be useful with synthetic data before live integrations exist.

---

# 2. Phase 0 — Repository Foundation

## Tasks

- Create Next.js App Router application with TypeScript.
- Establish strict TypeScript configuration.
- Establish ESLint/formatting.
- Establish testing framework.
- Add Tailwind.
- Add shadcn/ui or equivalent controlled primitives.
- Establish design tokens.
- Establish PostgreSQL connection.
- Establish Drizzle ORM and migrations.
- Add documentation structure.
- Add environment variable validation.
- Add error logging abstraction.
- Add authentication boundary without assuming a specific IdP until confirmed.

## Acceptance Criteria

- App starts locally.
- Database connection can be validated.
- Migration workflow works.
- Test suite runs.
- Type checking passes.
- No secrets are committed.
- Repository contains the required documentation.
- No vendor integrations are implemented yet.

---

# 3. Phase 1 — Domain Foundation

Implement:

- Organization
- User
- Team
- Employee
- TeamMembership
- ManagerAssignment
- DataSource
- ExternalIdentity

Implement server-side authorization.

Create realistic synthetic pilot fixtures representing:
- one POS Support manager/team
- one Menufy Support manager/team
- multiple employees
- different metric configurations between teams

Do not use the actual sample metrics as permanent requirements.

## Acceptance Criteria

A manager can authenticate and only access assigned employees/teams.

The same application can render two teams with different configured metrics.

An employee can exist without being tied to a specific vendor system.

---

# 4. Phase 2 — Metric System

Implement:

- MetricDefinition
- MetricAssignment
- MetricTarget
- MetricValue
- MetricObservation
- historical queries
- target resolution
- deterministic change/trend rules

Support:
- numeric values
- percentages
- durations
- counts
- neutral metrics

Metric definitions must specify:
- name
- description
- unit
- direction
- aggregation/calculation type
- period
- visibility
- version

Target resolution must be deterministic and tested.

## Important

Do not build arbitrary executable formulas.

Metric calculations should be implemented through typed, controlled calculation strategies/configuration.

## Acceptance Criteria

A synthetic employee can have:
- current value
- previous value
- target
- historical values
- detected change
- detected trend
- status evidence

The UI can consume metrics without knowing their source.

---

# 5. Phase 3 — Briefing Engine

Implement deterministic briefing generation.

Inputs:
- employee/team
- metric values
- targets
- observations
- relevant context
- period

Outputs:
- weekly manager briefing
- employee summary
- 1:1 preparation snapshot

A briefing must retain:
- generation time
- data freshness
- generation version
- evidence/provenance references

The first implementation should be template/rule driven.

Do not add an LLM dependency.

## Acceptance Criteria

Given the same source data and calculation version, the briefing is reproducible.

Every meaningful statement can be traced to supporting facts/observations.

---

# 6. Phase 4 — Core UI

Build the four primary experiences.

## Home

Goal:
"What happened this week that I need to know?"

Order:
1. page header/week
2. team at a glance
3. needs attention
4. notable improvements
5. upcoming 1:1s
6. compact team performance

Home must not become a wall of metrics.

## Team

Goal:
"How is everyone doing?"

Primary:
- employee table
- status
- key change
- trend
- 1:1/preparation state

Secondary:
- filters
- configurable Metrics View

## Employee

Goal:
"What's actually going on with this person?"

Order:
1. identity/status
2. current summary
3. meaningful changes
4. performance metrics
5. historical performance
6. context
7. prepare for 1:1

## 1:1 Preparation

Goal:
"What do I need to know before I meet this person?"

Order:
1. meeting header
2. at-a-glance takeaway
3. what changed
4. what to recognize
5. what to discuss
6. previous context
7. optional suggested questions
8. links to employee/Rippling

The 1:1 page should be visually calmer than the Employee page.

## Acceptance Criteria

- All four pages work from synthetic data.
- Navigation is coherent.
- Drill-down works.
- Loading/empty/error states exist.
- No sample data is hard-coded into components.
- UI is responsive at common desktop widths.
- Unauthorized employee access is rejected server-side.

---

# 7. Phase 5 — Connector Framework

Implement:

- DataSource
- SourceRecord
- NormalizedFact
- SyncRun
- SyncError
- ExternalIdentity resolution
- connector interface
- data-health view

Create connector packages:

- zendesk
- assembled
- rippling

Initially implement mock connectors using the same interface as future real connectors.

## Acceptance Criteria

A mock connector can:
- ingest records
- preserve source provenance
- resolve employees
- normalize facts
- trigger metric recalculation
- report sync health
- safely retry

---

# 8. Phase 6 — Zendesk Integration

Before coding the live connector:

- confirm API access
- confirm scopes
- confirm exact fields
- confirm historical range
- confirm rate limits
- confirm timezone/reporting period behavior

Then implement only verified data needed for the pilot.

Do not invent API fields.

Add fixtures from approved response samples.

Test:
- pagination
- retries
- rate limits
- partial records
- identity mapping
- duplicate/idempotent sync
- historical period calculations

---

# 9. Phase 7 — Assembled Integration

Follow the same process:

1. Confirm access.
2. Confirm fields.
3. Confirm period/timezone semantics.
4. Build normalized adapter.
5. Add fixtures.
6. Test sync.
7. Recalculate affected metrics.
8. Validate against source reports.

Do not assume the data model based only on the example reports.

---

# 10. Phase 8 — Rippling

First perform discovery.

Determine exactly what HungerRush has approved access to.

Possible uses:
- employee/manager relationships
- meeting references
- previous 1:1 context
- action items
- other employee context

Do not copy or store meeting content unless explicitly required and approved.

If Rippling cannot expose a needed capability, preserve the link-out workflow rather than inventing an integration.

---

# 11. Phase 9 — Data Reconciliation

Before pilot use, compare Cadence results against source systems.

For each pilot metric:

- select representative employees
- select multiple historical periods
- compare Cadence calculation to source report
- document discrepancies
- determine authoritative definition
- lock calculation version

No metric should be considered production-ready merely because the UI displays a plausible number.

---

# 12. Phase 10 — Pilot Hardening

Implement:

- Data Health
- freshness indicators
- stale/partial/error states
- permission review
- audit/provenance
- performance profiling
- database query review
- browser performance review
- accessibility pass
- visual consistency pass

Then collect pilot feedback.

---

# 13. Visual QA Rules

For every screen:

- Compare against approved visual reference.
- Check hierarchy before decoration.
- Remove unnecessary cards.
- Check alignment and spacing.
- Verify responsive behavior.
- Verify empty states.
- Verify long employee names.
- Verify missing metrics.
- Verify unusually large/small values.
- Verify stale data indicators.
- Verify error states.
- Verify keyboard navigation where appropriate.

Do not treat the reference image as a literal pixel-perfect implementation if doing so conflicts with responsive/accessibility requirements. It is the visual target and hierarchy reference.

---

# 14. Performance QA

Measure rather than guess.

Check:

- server response times
- database query times
- client bundle size
- unnecessary client components
- chart bundle impact
- table rendering
- repeated requests
- cache behavior

Core manager pages should use Cadence-owned data.

Never block Home/Team/Employee rendering on live vendor API calls.

---

# 15. Security QA

Verify:

- server-side authorization
- no cross-manager employee access
- no credential leakage
- environment validation
- input validation
- safe external payload handling
- audit/provenance where required
- minimal sensitive data storage
- secure logging

Attempt unauthorized access in integration tests.

---

# 16. Development Rules for Claude Code

Do not build all phases in one session.

Use one focused task/session at a time.

Recommended sequence:

1. Foundation
2. Domain
3. Metrics
4. Briefing
5. Home
6. Team
7. Employee
8. 1:1 Preparation
9. Connector framework
10. Zendesk
11. Assembled
12. Rippling discovery/integration
13. Reconciliation
14. Hardening

After each focused task:
- run tests
- run typecheck
- inspect diff
- update docs if architecture changed
- exit the session

Never allow a session to accumulate unrelated feature work.

---

# 17. First Claude Code Prompt

After the repository has been created and the documents are present, the first task should be:

> Read CLAUDE.md and all documents in /docs.
>
> Do not build application features yet.
>
> Inspect the repository and determine whether the current project structure supports the Cadence architecture.
>
> Produce a concise implementation plan for Phase 0 only.
>
> Identify any conflicts between the existing repository and the Cadence requirements.
>
> Do not make changes until the plan is clear.

After reviewing that output, authorize Phase 0.

---

# 18. Definition of Product Success

The application is successful when a pilot manager can open Cadence, understand their team's important weekly changes, inspect an employee, and prepare for a 1:1 without manually gathering the same information from multiple systems.

Technical success is secondary to this outcome.

The product must demonstrate actual reduction in manager preparation time.

---

# 19. Final Build Principle

Do not optimize for:

"How many metrics can we display?"

Optimize for:

"How quickly can a manager understand what matters and prepare for a useful conversation?"

That is the product.
