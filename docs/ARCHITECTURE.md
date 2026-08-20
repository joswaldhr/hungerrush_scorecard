# HungerRush Cadence -- Architecture Reference v0.1

## System Overview

Cadence is a modular monolith built on Next.js App Router. A single deployable application handles authentication, server-side data access, authorization, background sync, and the manager-facing UI.

There are no microservices. The codebase is organized by domain boundary inside one TypeScript project. External vendor systems are isolated behind a connector interface; the manager UI reads only Cadence-owned normalized data.

## Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack dev) | Server Components by default; client components only when interactivity requires it |
| Language | TypeScript (strict mode, `noUncheckedIndexedAccess`) | |
| Styling | Tailwind CSS v4, CSS custom properties | OKLCH color space, `@theme inline` integration |
| Components | shadcn/ui (new-york style, RSC-enabled) | Radix primitives, class-variance-authority, tailwind-merge |
| Icons | Lucide React | |
| Database | PostgreSQL 17 | Local via Docker Compose; managed instance for production |
| ORM | Drizzle ORM + drizzle-kit | Schema in `src/lib/db/schema.ts`, migrations in `drizzle/` |
| Auth | Auth.js (next-auth v5 beta) | Credentials provider for dev; SSO provider for production |
| Validation | Zod v4 | Environment validation, schema validation for external payloads |
| Testing | Vitest, Testing Library, jsdom | |
| Linting | ESLint 9 (flat config), Prettier | next/core-web-vitals + typescript + prettier configs |
| Package manager | pnpm 11 | Workspace-enabled |

## Project Structure

```
src/
  app/                        # Next.js App Router pages and layouts
    layout.tsx                 # Root layout (font, metadata, html shell)
    globals.css                # Design tokens, Tailwind theme
    login/                     # Public login page
      page.tsx
      login-form.tsx           # Client component for dev login
    (app)/                     # Authenticated route group
      layout.tsx               # App shell (sidebar + main content area)
      page.tsx                 # Home page (manager briefing)
    api/
      auth/[...nextauth]/      # Auth.js API route handler
        route.ts
  components/
    sidebar.tsx                # App navigation sidebar (server component)
    ui/                        # shadcn/ui primitives
      button.tsx
  lib/
    auth/
      index.ts                 # Auth.js configuration and exports
      dev-users.ts             # Synthetic dev login users
    db/
      index.ts                 # Database connection (postgres.js + drizzle)
      schema.ts                # Drizzle schema definitions
    env.ts                     # Zod-validated environment variables
    logger.ts                  # Structured JSON logging abstraction
    utils.ts                   # cn() utility for Tailwind class merging
  middleware.ts                # Auth.js middleware (route protection)
  __tests__/
    setup.ts                   # Vitest setup
    smoke.test.tsx             # Smoke test
drizzle/                       # Generated migration files
docs/                          # Project documentation
docker-compose.yml             # Local PostgreSQL
```

### Planned directories (not yet created)

These directories will be added as their respective phases are implemented:

```
src/
  lib/
    domain/                    # Domain logic independent of React
      people/                  # Organization, Team, Employee, assignments
      metrics/                 # MetricDefinition, targets, values, observations
      briefings/               # Briefing generation, templates
      context/                 # ContextItem, MeetingReference
    connectors/                # External system integrations
      interface.ts             # Common connector interface
      zendesk/                 # Zendesk connector
      assembled/               # Assembled connector
      rippling/                # Rippling connector
    sync/                      # SyncRun orchestration, scheduling
    fixtures/                  # Synthetic data for development and testing
  app/(app)/
    team/                      # Team comparison view
    employee/[id]/             # Employee detail view
    one-on-ones/               # 1:1 preparation view
    data-health/               # Connector/sync health dashboard
```

## Domain Boundaries

### People

Organization, User, Team, Employee, TeamMembership, ManagerAssignment.

Cadence owns the canonical employee identity. External systems map to it through ExternalIdentity records. People entities are vendor-agnostic; no Zendesk/Assembled/Rippling assumptions leak into these models.

### Metrics

MetricDefinition, MetricAssignment, MetricTarget, MetricValue, MetricObservation.

Metric definitions are data-driven and versioned. Different teams can have different metric sets. Targets resolve through a deterministic priority chain (employee-specific > role > team > org default). Calculations use typed strategies, not arbitrary executable formulas. Historical values are persisted, never recomputed in place.

### Briefings

BriefingSnapshot.

Generated deterministically from metric values, observations, targets, and context for a given period. Template/rule-driven in the first implementation. No LLM dependency. Every statement traces to supporting evidence. Snapshots record generation version and data freshness.

### Context

ContextItem, MeetingReference.

Context items represent non-metric information relevant to an employee (coaching notes, schedule changes, etc.). Meeting references link to external calendar/meeting systems. Context is scoped by visibility and expiration.

### Connectors / Sync

DataSource, ExternalIdentity, SourceRecord, NormalizedFact, SyncRun, SyncError.

This is the integration boundary. All vendor-specific logic lives inside connector packages. The rest of the application consumes only NormalizedFacts and MetricValues.

## Data Flow

```
External Systems         Connector Layer           Domain Layer              UI Layer
                                                                           
Zendesk API    ------>  zendesk connector  -+                              
Assembled API  ------>  assembled connector |                              
Rippling API   ------>  rippling connector  |                              
                                            |                              
                        SourceRecord -------+-> NormalizedFact             
                        (raw payload,           (typed, employee-           
                         provenance)             resolved, period-          
                                                 scoped)                   
                                                    |                      
                                            MetricDefinition +             
                                            MetricTarget     +             
                                            calculation      |             
                                                    |        |             
                                            MetricValue <----+             
                                            MetricObservation              
                                                    |                      
                                            BriefingSnapshot               
                                                    |                      
                                            Server Components              
                                            (auth-gated queries)           
                                                    |                      
                                            Home / Team / Employee / 1:1   
```

1. **Ingest**: Connectors call vendor APIs on a scheduled/background basis. Raw responses are stored as SourceRecords with full payload and provenance.
2. **Normalize**: Connectors transform SourceRecords into NormalizedFacts, resolving employee identity through ExternalIdentity mappings.
3. **Calculate**: The metric system reads NormalizedFacts and applies typed calculation strategies to produce MetricValues. Observations (changes, trends, threshold crossings) are detected by deterministic rules.
4. **Brief**: The briefing engine assembles MetricValues, MetricObservations, and ContextItems into BriefingSnapshots.
5. **Render**: Server Components query Cadence-owned data (MetricValues, BriefingSnapshots) with authorization checks. The browser never calls vendor APIs directly.

## Authorization Model

Authorization is enforced server-side. The hierarchy:

```
Organization
  |
  +-- Team(s)
  |     |
  |     +-- Employee(s) via TeamMembership
  |
  +-- User (manager)
        |
        +-- ManagerAssignment(s) --> Team and/or Employee
```

- A User belongs to an Organization.
- A ManagerAssignment links a User to the Teams and Employees they can access.
- Every data query filters by the authenticated user's assignments.
- Employees outside the manager's assignment scope are invisible.
- Middleware protects all routes under `(app)/`; the login page and auth API routes are public.

Production authentication will use an SSO provider configured through Auth.js. The current development setup uses a Credentials provider with synthetic dev users (disabled in production).

## Connector Architecture

### Interface

Every connector implements a common interface:

- **connect**: Validate credentials and connectivity.
- **sync**: Fetch records from the external system for a given period/cursor.
- **normalize**: Transform raw SourceRecords into NormalizedFacts.
- **resolveIdentity**: Map external user identifiers to Cadence Employee records.

### Sync lifecycle

1. A SyncRun is created with status `running`.
2. The connector fetches paginated data from the vendor API, respecting rate limits.
3. Raw payloads are stored as SourceRecords (deduplicated by payload hash).
4. SourceRecords are normalized into NormalizedFacts.
5. NormalizedFacts trigger metric recalculation for affected employees/periods.
6. SyncRun is updated with record counts, cursor position, and final status.
7. Errors are recorded as SyncError entries (with retryable flag).

### Identity resolution

External systems identify employees differently. ExternalIdentity maps vendor-specific IDs to the canonical Cadence Employee. Preferred matching order:

1. Authoritative HR ID (Rippling)
2. Verified source mapping (admin-confirmed)
3. Exact normalized company email
4. Manual admin mapping

Fuzzy name matching alone is not permitted.

### Sync properties

- Idempotent: re-running a sync for the same period produces the same result.
- Retryable: partial failures are recoverable.
- Observable: SyncRun status, record counts, errors, and freshness are queryable.
- Non-blocking: sync failures do not take down the manager UI.

### Planned connectors

| Connector | Source role | Status |
|---|---|---|
| Zendesk | Support/ticket operational metrics | Mock first, then live after API access confirmed |
| Assembled | Workforce/scheduling metrics | Mock first, then live after API access confirmed |
| Rippling | Employee identity, org structure, meeting context | Discovery required before implementation |

## Key Architectural Decisions

### Modular monolith, not microservices

One deployable application. Domain boundaries are enforced through directory structure and import discipline, not network calls. This reduces operational complexity during the pilot.

### Server-side data access only

All database queries and authorization checks happen in Server Components or server actions. Client Components receive pre-authorized, pre-formatted data. No vendor API tokens or database credentials are exposed to the browser.

### No direct vendor API calls from the browser

Manager-facing pages render from Cadence-owned tables (MetricValue, BriefingSnapshot, etc.). Vendor APIs are called only by server-side connectors during background sync. This ensures page loads are fast and do not depend on vendor API availability.

### Environment-driven configuration

All secrets and environment-specific values come from environment variables, validated at startup by Zod (`src/lib/env.ts`). No secrets in code.

### Synthetic fixtures first

Every domain and connector is built against realistic synthetic data before live API access is available. Mock connectors implement the same interface as production connectors. This allows full UI development and testing without vendor dependencies.

### Deterministic calculations, not AI

Briefings and metric observations are generated by versioned, deterministic rules. No LLM in the calculation pipeline. Every output is reproducible and traceable to source data.

### Data provenance and freshness

Every MetricValue records its calculation version, calculation time, and data freshness timestamp. Source records preserve the raw vendor payload and hash. Stale or partial data is surfaced to the manager, never silently converted to zero.

### Vendor-agnostic domain model

The core domain (People, Metrics, Briefings, Context) contains no Zendesk, Assembled, or Rippling concepts. Metrics, targets, and assignments are data-driven. The same application supports teams with different metric configurations.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js session encryption secret |
| `NODE_ENV` | No | `development` (default), `production`, or `test` |
| `AUTH_PROVIDER` | No | Auth provider hint; credentials warn in production |

Additional connector-specific variables (API keys, base URLs) will be added as integrations are implemented. Each will be validated through `src/lib/env.ts`.

## Deployment Target

- **Application**: Vercel (Next.js hosting with serverless functions). No Vercel-specific APIs are used in the domain layer; the application can be deployed to any Node.js hosting that supports Next.js.
- **Database**: Managed PostgreSQL (provider TBD). Local development uses Docker Compose with PostgreSQL 17 Alpine.
- **Migrations**: Drizzle-kit generates and applies SQL migrations. Migrations run before deployment, not at application startup.
- **Background sync**: Planned as server-side scheduled tasks. Exact mechanism depends on deployment environment (Vercel cron, external scheduler, or manual trigger during pilot).

## Testing Strategy

- **Unit tests**: Vitest with jsdom for component rendering, pure function testing for domain logic.
- **Integration tests**: Database-backed tests for authorization, metric calculation, and sync pipelines.
- **Fixture-driven**: All tests use synthetic fixtures, not live vendor data.
- **Type safety**: `tsc --noEmit` with strict mode and `noUncheckedIndexedAccess` as a CI gate.
