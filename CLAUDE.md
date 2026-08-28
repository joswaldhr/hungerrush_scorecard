# HungerRush Cadence — Claude Code Instructions

## Mission

Build HungerRush Cadence as a production-quality manager performance and meeting-preparation application.

Cadence is a manager intelligence layer that brings together relevant employee information from multiple company systems and turns it into a clear weekly briefing and 1:1 preparation experience.

The first pilot is for two Support managers:
- HungerRush POS Support
- Menufy Support

Do not build a POS-specific or Menufy-specific application. The pilot must prove that one configurable platform can support both.

## Source of Truth

Read these documents before implementing:
- docs/PRODUCT.md
- docs/ARCHITECTURE.md
- docs/DATA_MODEL.md
- docs/DESIGN_SYSTEM.md
- docs/INTEGRATIONS.md
- docs/MVP.md

The product specification defines what Cadence should be.
The architecture specification defines how the system should be structured.
If implementation details are ambiguous, preserve the product principles rather than inventing vendor-specific assumptions.

## Non-Negotiable Rules

1. Do not hard-code Zendesk, Assembled, or Rippling assumptions into core domain models or UI.
2. External systems are connectors/data sources, not the application domain.
3. Do not make one manager's current metrics the permanent metric set.
4. Metrics, targets, assignments, context categories, and team views must be data-driven.
5. Do not call external vendor APIs directly from browser components.
6. Use Cadence-owned normalized data for manager-facing pages.
7. Persist historical metric values.
8. Preserve source provenance and freshness.
9. Never silently turn missing/stale/partial data into zero.
10. Enforce authorization on the server.
11. Never expose secrets or access tokens to the browser.
12. Do not build microservices unless a demonstrated requirement appears.
13. Do not add a generic BI/report-builder framework to the MVP.
14. Do not make AI the foundation of the product.
15. Do not create automated employment decisions or employee rankings as the core product.
16. Prefer deleting unnecessary UI over adding more dashboard content.
17. The application must feel like a premium modern SaaS product, not an enterprise reporting portal.
18. Use the HungerRush visual identity as the brand foundation.
19. Build with synthetic fixtures before depending on live integrations.
20. Complete and verify one phase before moving to the next.

## Product UX

The four core experiences are:

Home:
"What happened this week that I need to know?"
Principle: Home summarizes.

Team:
"How is everyone doing?"
Principle: Team compares.

Employee:
"What's actually going on with this person?"
Principle: Employee explains.

1:1 Preparation:
"What do I need to know before I meet this person?"
Principle: 1:1 Preparation prepares.

The manager journey is:
Home -> Team -> Employee -> 1:1 Preparation -> existing meeting workflow/Rippling.

## Visual Direction

Target quality: modern, restrained SaaS.

Use the HungerRush navy and teal as the brand foundation, with mostly neutral surfaces and restrained status colors.

Reference quality:
- Linear
- Stripe
- Ramp
- Vercel

Do not copy those products.

Prioritize:
- whitespace
- hierarchy
- restrained color
- consistent spacing
- typography
- simple visualizations
- progressive disclosure
- responsive layouts
- accessibility
- subtle interaction

Avoid:
- dense dashboards
- excessive KPI cards
- decorative gradients
- heavy shadows
- excessive borders
- giant charts
- excessive animation
- generic AI-dashboard aesthetics

## Engineering Style

Prefer simple, readable TypeScript.
Use domain boundaries.
Keep vendor-specific code inside connectors.
Keep business logic testable outside React components.
Use server-side data access and authorization.
Use typed schemas for external payload validation.
Use database migrations.
Do not create abstractions without a concrete need.
Document non-obvious architectural decisions.

## Development Workflow

For each task:

1. Read the relevant docs.
2. Inspect the existing implementation.
3. State the files/components you expect to change.
4. Implement the smallest coherent change.
5. Run relevant tests/type checks/lint.
6. Fix failures.
7. Review for hard-coded assumptions.
8. Summarize what changed and what remains.

Do not silently expand scope.

## Definition of Done

A feature is not done merely because it renders.

It must:
- satisfy the relevant product requirement
- use the domain model correctly
- respect permissions
- handle loading, empty, stale, partial, and error states where applicable
- have appropriate tests
- avoid vendor coupling
- meet the visual design rules
- avoid unnecessary client-side work
- pass type checking/lint/tests
- be documented when it introduces a meaningful architectural decision

## Current Build Constraint

Zendesk, Assembled, and Entra ID integrations are live in production. Only Rippling remains a stub — use synthetic fixtures and adapters for Rippling until live access is confirmed.

Never invent API endpoints, credentials, scopes, or response fields for any vendor.

When a vendor integration requires unknown information, stop at the connector boundary and document the exact missing requirement rather than guessing.
