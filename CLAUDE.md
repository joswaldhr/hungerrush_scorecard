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
- if it involves data (a sync, a metric, an aggregation, a migration): be verified against real
  data with actual query/output results pasted somewhere reviewable — "should work now" is not
  a valid stopping point
- if it touches a scheduled/cron job: be triggered for real using the platform's own test/trigger
  tooling if one exists, rather than reasoned about from the code alone — auth and caching
  failures on cron jobs are frequently silent and invisible from a code read
- if an investigation or report file already exists for the task at hand (e.g.
  `INVESTIGATION.md`), have been read in full first — don't re-diagnose from scratch or
  contradict its findings without new evidence
- if the fix surfaces unrelated problems, have them logged to `FOLLOWUPS.md` with a pointer to
  where they were found, rather than bundled into the same change
- when genuinely blocked on something only a human can check (dashboard access, a business
  decision, credentials), stop and ask for the specific fact needed — don't guess and ship a
  "covers both cases" change

## Metrics/sync system — known facts (see INVESTIGATION.md for detail)

- All Zendesk data arrives via polling (daily Vercel Cron + a manual "Sync Now" button) — no
  incoming webhooks exist anywhere in this app.
- Ticketing metrics and Talk (call) metrics are separate Zendesk API surfaces with independent
  failure modes.
- The connector assumes a single Zendesk subdomain — unverified whether the real account is
  multi-brand (see `FOLLOWUPS.md`).
- Week-boundary math (Monday–Sunday, UTC) is independently reimplemented in 5+ places; the
  mocks/scripts use local server time, not UTC, which is a known divergence confined to
  dev/test fixtures. Reuse an existing UTC implementation (e.g. `zendesk.ts`'s `weekOf()`) —
  don't write a new one.
- No error-monitoring/APM tool and no test coverage on the sync orchestration path
  (`sync-engine.ts`, the cron/sync API routes). Treat this area as untested until that changes.
- `csat_score` is a known, separately-broken metric (Zendesk data limitation, not a pipeline
  bug) — don't conflate it with sync pipeline work.
- Any external HTTP call to Zendesk must have a timeout (`AbortSignal.timeout(...)`). One was
  missing until 2026-09-09 and caused an indefinite hang with zero errors anywhere — see the
  incident note below.

## Incident: Silent 5-Day Sync Outage (2026-09-09)

The scheduled Zendesk sync produced no data for 5 days with zero errors anywhere in the app —
a manager noticed only because "This Week" was empty on the scorecard. Full diagnosis in
`INVESTIGATION.md`, the actual fix in `FIX_LOG.md`. Don't duplicate either here; the short
version:

- **Confirmed root cause**: nothing upstream of `runSync()` (the cron route's `CRON_SECRET`
  check, or Vercel simply not invoking the cron) ever reached the sync logic — proven because
  `runSync()` unconditionally writes a `sync_runs` row before doing any work, and none existed
  for 5 days. The exact Vercel-side reason (not invoked vs. silently 401'd) needed Vercel
  dashboard access this environment didn't have — see `FOLLOWUPS.md` item 4 if that's still
  open when you read this.
- **Separately found while verifying**: `zendesk-shared.ts`'s `fetch()` call had no timeout,
  so a stalled connection could hang a sync forever with no error. Fixed alongside.
- **Verification method that actually worked**: triggering a sync through the app's own
  authenticated route (`/api/sync/run`, logged in as a real manager) and then querying
  `sync_runs`/`metric_values`/`data_sources` directly — reasoning about the code was not
  sufficient to catch either bug. If you hit a silent cron failure again, reach for a real
  trigger + real query before guessing from a code read.

## Current Build Constraint

Zendesk, Assembled, and Entra ID integrations are live in production. Only Rippling remains a stub — use synthetic fixtures and adapters for Rippling until live access is confirmed.

Never invent API endpoints, credentials, scopes, or response fields for any vendor.

When a vendor integration requires unknown information, stop at the connector boundary and document the exact missing requirement rather than guessing.
