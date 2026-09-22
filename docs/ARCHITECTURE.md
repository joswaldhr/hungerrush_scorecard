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
| Database | PostgreSQL 17 | Local via Docker Compose; Railway-managed instance in production |
| ORM | Drizzle ORM + drizzle-kit | Schema in `src/lib/db/schema.ts`, migrations + tracked meta in `drizzle/` |
| Auth | Auth.js (next-auth v5 beta) | Microsoft Entra ID SSO in production; Credentials provider for dev only |
| Validation | Zod v4 | Environment validation; POST route body validation is still ad hoc (see Known Gaps) |
| Testing | Vitest, Testing Library, jsdom | Runs against a real Postgres, not mocks, for DB-touching tests |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | typecheck, lint, test, migrate, build on every push/PR |
| Linting | ESLint 9 (flat config), Prettier | next/core-web-vitals + typescript + prettier configs |
| Package manager | pnpm 11 | Workspace-enabled |
| Deployment | Vercel (app), Railway (Postgres) | Auto-deploys from `master` |

## Project Structure

```
src/
  app/
    layout.tsx                 # Root layout (force-dynamic, font, metadata)
    global-error.tsx           # Root error boundary (catastrophic layout failures)
    globals.css                # Design tokens, Tailwind theme
    login/                     # Public login page (SSO + dev credentials picker)
    (app)/                     # Authenticated route group
      layout.tsx               # App shell (sidebar + view-as banner + main content)
      error.tsx / loading.tsx / not-found.tsx
      page.tsx                 # Home (redirects to /one-on-ones)
      one-on-ones/page.tsx, one-on-ones/[id]/page.tsx  # 1:1 picker + prep (Team removed 2026-09-22)
      data-health/             # Sync status + manual "Sync now" trigger
      reconciliation/          # Cadence-vs-source value comparison
      admin/                   # Platform-admin landing + "view as" picker
        employees/, employees/[id]/  # Employee detail (admin-scoped)
        teams/                 # Team management
        roster-review/         # Roster candidate approval/rejection
        metric-visibility/     # Three-tier metric visibility overrides (global default / manager / scorecard)
    api/
      auth/[...nextauth]/route.ts
      cron/sync/route.ts       # Vercel Cron: 4 staggered weekly sync legs
      sync/run/route.ts, sync/health/route.ts
      health/route.ts          # Health check endpoint
      reconciliation/run/route.ts, reconciliation/results/route.ts
      client-error/route.ts    # Server-side log sink for client error boundaries
  components/                  # Sidebar, StatusBadge, MetricHistoryChart, MetricIcon,
                                # MetricCategoryTable, StatCard,
                                # MeetingPrepChecklist, SyncStalenessBanner,
                                # EmptyState/ErrorState, ui/ primitives
  lib/
    auth/                      # Auth.js config, authorization.ts (ManagerContext + view-as)
    db/                        # Lazy-proxy connection, Drizzle schema
    domain/                    # metrics/, briefings/, reconciliation/, roster/
    connectors/                # Connector interface, sync-engine, zendesk.ts,
                                # zendesk-shared.ts (HTTP helper w/ retry/timeout),
                                # zendesk-mock.ts (synthetic-data variant)
    fixtures/                  # seed.ts (real pilot roster), golden-dataset.ts (test fixtures)
    env.ts, logger.ts, rate-limit.ts, utils.ts
  proxy.ts                     # Next.js 16 proxy convention (formerly middleware.ts)
  __tests__/                   # Vitest — domain logic, connectors, sync orchestration, auth
drizzle/                       # Migrations + meta/ (tracked — needed to migrate reliably)
.github/workflows/ci.yml       # typecheck, lint, test, migrate, build on every push/PR
docs/                          # Project documentation
docker-compose.yml             # Local PostgreSQL (also used as the CI test database)
```

All phases through pilot hardening, live Zendesk integration, platform admin, and CI are
implemented — see `docs/MVP.md` for the current checklist and `docs/PRODUCT.md`'s "What Ships"
section for scope. Assembled connector was removed (see Connector Architecture below).
Rippling has no real integration — only a link-out via `RIPPLING_MANAGER_URL`.

## Domain Boundaries

### People

Organization, User, Team, Employee, TeamMembership, ManagerAssignment.

Cadence owns the canonical employee identity. External systems map to it through ExternalIdentity records. People entities are vendor-agnostic; no Zendesk/Assembled/Rippling assumptions leak into these models.

`User.is_platform_admin` marks the platform-admin flag (currently just James Oswald) used by the `/admin` "view as" flow — an admin with no manager assignment of their own can render any real manager's pages/data via a signed httpOnly cookie, resolved server-side in `getEffectiveManagerContext`. A manager's own assignment always takes priority over view-as.

### Metrics

MetricDefinition, MetricAssignment, MetricTarget, MetricValue, MetricObservation, MetricVisibilityOverride.

Metric definitions are data-driven and versioned. Different teams can have different metric sets. Targets resolve through a deterministic priority chain (employee-specific > role > team > org default). Calculations use typed strategies, not arbitrary executable formulas. Historical values are persisted, never recomputed in place.

The `MetricStatus` TypeScript type (computed at query time, not a DB column) includes a `no_data` value distinct from `off_target` — a metric with no recorded value for a period is never silently evaluated as if it were zero.

Targets can additionally be scoped to a **line** (a sub-division within a team, e.g. Menufy
Support's Restaurant/Consumer split; null for POS) and can be a **range** target
(`targetMin`/`targetMax`, on-target only strictly between the two) instead of a single
minimum/maximum/exact value. A separate `MetricVisibilityOverride` table controls whether a
metric is shown at all, independent of whether it has a value, with three-tier precedence
(`global_default` -> `manager_override` -> `scorecard_override`, most specific wins), scoped
by team+line so a Menufy-only hide can never leak into POS. Managed via
`/admin/metric-visibility`.

### Briefings

BriefingSnapshot.

Generated deterministically from metric values, observations, targets, and context for a given period. Template/rule-driven in the first implementation. No LLM dependency. Every statement traces to supporting evidence. Snapshots record generation version and data freshness.

### Context

ContextItem, MeetingReference.

Context items represent non-metric information relevant to an employee (coaching notes, schedule changes, etc.). Meeting references link to external calendar/meeting systems. Context is scoped by visibility and expiration. Neither table has a live producer yet (see Known Gaps). The schema also includes related tables for meeting notes, action items, discussion topics, ticket reviews, attendance events, and coaching records — all defined but not yet wired to a UI or data source.

### Connectors / Sync

DataSource, ExternalIdentity, SourceRecord, NormalizedFact, SyncRun, SyncError.

This is the integration boundary. All vendor-specific logic lives inside connector packages. The rest of the application consumes only NormalizedFacts and MetricValues.

## Data Flow

```
External Systems         Connector Layer           Domain Layer              UI Layer

Zendesk API    ------>  zendesk connector  -+
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
                                            Team / 1:1s (Home redirects to Team)
```

1. **Ingest**: Connectors call vendor APIs, triggered on a daily schedule (Vercel Cron, 4 staggered legs at 6:00/6:15/6:30/6:45 UTC, one week-offset per leg) and manually via the Data Health page's "Sync now" button (rate-limited server-side, scoped to week 0). Raw responses are stored as SourceRecords with full payload and provenance.
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
- `assignedEmployeeIds` resolves via `TeamMembership`, not `Employee.primary_team_id` directly — both must be set for a team-scoped assignment to see an employee (a real gap the auth integration tests caught in the fixture, not the app code).
- Every data query filters by the authenticated user's assignments.
- Employees outside the manager's assignment scope are invisible (out-of-scope ids 404 rather than leaking existence).
- `src/proxy.ts` (the Next.js 16 successor to `middleware.ts`) protects all routes under `(app)/`; the login page and auth API routes are public.
- A platform admin with no assignment of their own can additionally resolve another manager's real `ManagerContext` via the `cadence_view_as` cookie — see People above. The view-as lookup only resolves a target user within the admin's own `organizationId` -- a platform admin cannot view as a manager in a different organization.
- A manager's access can come entirely from individual `ManagerAssignment.employee_id` rows with no team-level assignment at all (a sub-manager who owns a slice of a larger team, not the whole team) -- in that case `ctx.assignedTeamIds` is empty even though the manager has real employees to see. `getVisibleTeamsForManager()` (`src/lib/auth/authorization.ts`) derives the teams to actually render from the manager's assigned employees' own `primaryTeamId`, so `one-on-ones/page.tsx` and `reconciliation/page.tsx` render correctly for a sub-manager instead of requiring at least one whole-team assignment (`team/page.tsx` used this too before Team was removed 2026-09-22).
- `requireAdmin()` (`src/lib/auth/authorization.ts`) is the single shared helper every admin page/action uses to gate access and to scope its own queries to the admin's `organizationId` -- admin pages are not implicitly global across every organization.

Production authentication uses Microsoft Entra ID SSO configured through Auth.js; if its env vars are absent in production, the app now refuses to start rather than booting with no working sign-in method. The Credentials provider (synthetic dev users) is hard-disabled in production regardless.

## Connector Architecture

### Interface

Every connector implements a common interface (`src/lib/connectors/types.ts`):

- **healthCheck**: Validate credentials and connectivity.
- **fetchRecords**: Fetch paginated records from the vendor API for a given config/cursor.
- **normalizeRecords**: Transform raw SourceRecords into NormalizedFacts.
- **resolveIdentities**: Map external user identifiers to Cadence Employee records.
- **discoverRoster**: List current members of mapped external groups, for diffing against known identities to surface new-hire/departure candidates.

### Sync lifecycle

1. A SyncRun is created with status `running`.
2. **Fetch phase**: The connector fetches paginated data from the vendor API into memory. The Zendesk connector has built-in retry/backoff for 429 rate-limit responses. A server-side cooldown (`src/lib/rate-limit.ts`) prevents repeated syncs for the same source within 5 minutes. No DB writes happen during this phase (except creating the sync run row).
3. **Publish phase** (runs inside a single DB transaction): Raw payloads are upserted as SourceRecords (deduplicated by payload hash, batched in chunks of 500). SourceRecords are normalized into NormalizedFacts. If the transaction fails, everything rolls back — no partial data visible.
4. NormalizedFacts trigger metric recalculation for affected employees/periods.
5. SyncRun is updated with record counts, cursor position, timing metadata (`fetchMs`, `publishMs`, `computeValuesMs`), and final status.
6. Errors are recorded as SyncError entries (with retryable flag and error type: `fetch_fatal`, `publish_fatal`, or `ingest`).

### Identity resolution

External systems identify employees differently. ExternalIdentity maps vendor-specific IDs to the canonical Cadence Employee. Preferred matching order:

1. Authoritative HR ID (Rippling)
2. Verified source mapping (admin-confirmed)
3. Exact normalized company email
4. Manual admin mapping

Fuzzy name matching alone is not permitted. In practice, the live Zendesk/Assembled connectors match by exact company email.

### Sync properties

- Idempotent: re-running a sync for the same period produces the same result.
- Retryable: partial failures are recoverable.
- Observable: SyncRun status, record counts, errors, and freshness are queryable via Data Health.
- Non-blocking: sync failures do not take down the manager UI.

### Roster discovery

`discoverRosterCandidates()` (`src/lib/domain/roster/reconcile.ts`) diffs a connector's live
group membership against known `ExternalIdentity` rows. New-hire candidates are
**auto-approved** (employee/identity/team-membership rows created immediately) unless a
circuit breaker trips -- more than 5 absolute new candidates, or more than 30% of the active
mapped-team roster in one run -- in which case the whole batch falls back to `pending` for
manual review via `/admin/roster-review`. Departures are never auto-processed; a departed
identity is always written as a `pending` roster candidate for a human to approve.

### Connector status

| Connector | Source role | Status |
|---|---|---|
| Zendesk | Support/ticket operational metrics (tickets resolved, handle time, CSAT, backlog, calls) | **Live**, real API, verified end-to-end against the real HungerRush account. Daily cron (4 legs), parallelized per-employee fetches, retry/backoff on 429s. 24 metrics across tickets + Talk calls. |
| Assembled | Workforce/scheduling metrics | **Removed.** Connector code was deleted — the `schedule_adherence` metric it powered is still defined but unassigned from both pilot teams. `ASSEMBLED_API_KEY` env var reference remains in `env.ts` as a residual. |
| Rippling | Employee identity, org structure, meeting context | **No connector.** A plain "Open Rippling" link-out exists on the 1:1 Prep page (via `RIPPLING_MANAGER_URL`). Real API integration is blocked on HungerRush confirming API access/scopes — do not guess at this; see `docs/INTEGRATIONS.md`. |

## Key Architectural Decisions

### Modular monolith, not microservices

One deployable application. Domain boundaries are enforced through directory structure and import discipline, not network calls. This reduces operational complexity during the pilot.

### Server-side data access only

All database queries and authorization checks happen in Server Components or server actions. Client Components receive pre-authorized, pre-formatted data. No vendor API tokens or database credentials are exposed to the browser.

### No direct vendor API calls from the browser

Manager-facing pages render from Cadence-owned tables (MetricValue, BriefingSnapshot, etc.). Vendor APIs are called only by server-side connectors during a sync. This ensures page loads are fast and do not depend on vendor API availability.

### Environment-driven configuration

All secrets and environment-specific values come from environment variables, validated at startup by Zod (`src/lib/env.ts`). No secrets in code. `.env.example` uses placeholders only — it previously hard-coded the real HungerRush Entra tenant GUID; that's been fixed.

### Synthetic fixtures first, then real data

Every domain and connector was built against realistic synthetic data before live API access was available. Once Zendesk/Assembled/SSO access was confirmed, the pilot roster was replaced with the real POS Support and Menufy Support rosters (pulled from Microsoft Graph) — `docs/MVP.md`'s original "synthetic data" pilot item reflects this supersession. Mock connectors (`*-mock.ts`) still exist and implement the same interface, useful for local dev without hitting real vendor APIs.

### Deterministic calculations, not AI

Briefings and metric observations are generated by versioned, deterministic rules. No LLM in the calculation pipeline. Every output is reproducible and traceable to source data.

### Data provenance and freshness

Every MetricValue records its calculation version, calculation time, and data freshness timestamp. Source records preserve the raw vendor payload and hash. Stale, partial, or missing data is surfaced to the manager as a distinct `no_data` state — never silently converted to zero (this was a real bug, since fixed: `evaluateStatus` used to default a missing value to `0` before comparing it to a target).

### Vendor-agnostic domain model

The core domain (People, Metrics, Briefings, Context) contains no Zendesk, Assembled, or Rippling concepts. Metrics, targets, and assignments are data-driven. The same application supports teams with different metric configurations.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AUTH_SECRET` | Yes | Auth.js session encryption secret |
| `NODE_ENV` | No | `development` (default), `production`, or `test` |
| `ZENDESK_SUBDOMAIN`, `ZENDESK_EMAIL`, `ZENDESK_API_KEY` | No (required once Zendesk sync is used) | Live Zendesk connector credentials |
| `ASSEMBLED_API_KEY` | No (required once Assembled sync is used) | Live Assembled connector credentials |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET` | No | Microsoft Graph app-only (client-credentials) access for org roster sync — separate from SSO below |
| `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ISSUER` | No, but required in production | Microsoft Entra ID interactive SSO app registration. If missing when `NODE_ENV=production`, the app now throws at startup rather than booting with no working sign-in method |
| `RIPPLING_MANAGER_URL` | No | Plain link-out URL shown as "Open Rippling" on the 1:1 Prep page once set — not a deep link to a specific employee (no real Rippling integration exists yet, see Known Gaps) |

All are validated (when present) through `src/lib/env.ts`. There is no `AUTH_PROVIDER` variable — an earlier version of this doc referenced one that was never implemented.

## Deployment Target

- **Application**: Vercel (Next.js hosting with serverless functions), auto-deploying from `master`. No Vercel-specific APIs are used in the domain layer.
- **Database**: Railway-managed PostgreSQL. Local development and CI both use a separate Postgres (Docker Compose locally, a GitHub Actions service container in CI) — never the real Railway instance.
- **Migrations**: Drizzle-kit generates and applies SQL migrations; `drizzle/meta/` (the journal and per-migration snapshots) is tracked in git, not gitignored, so a fresh checkout can migrate reliably. CI runs `drizzle-kit migrate` against its test database on every push. Production (Railway) migrations are still a manual step — see the runbook below. Wiring this into the Vercel build itself (a `vercel-build` script running `pnpm db:migrate && next build`) was considered and deliberately not done here: it would auto-apply schema changes against production on every push with no human gate, which is a CI/CD pipeline change with real blast radius — worth James's explicit sign-off rather than a silent default.
- **Background sync**: Vercel Cron, 4 staggered legs daily at 6:00/6:15/6:30/6:45 UTC (`api/cron/sync?week=0..3`). Each leg syncs one week-offset to stay under the confirmed 300s function duration limit. Manual "Sync Now" (Data Health page) also available, scoped to week 0, rate-limited to one per 5 minutes per data source.

### Production Migration Runbook

Until the pre-deploy step above is decided, apply schema changes to Railway by hand, in this order, for every commit that includes a new migration under `drizzle/`:

1. Get the production `DATABASE_URL` from the Railway dashboard (the Postgres service's **Variables** tab) or `railway variables` if the Railway CLI is linked to this project. Don't put it in `.env` — pass it inline so it can't get committed by accident.
2. Run the migration against production **before or as soon as** the corresponding commit reaches `master` (Vercel auto-deploys from `master`, so app code expecting a new column/table can otherwise go live before the schema does):
   ```
   DATABASE_URL="<railway-connection-string>" pnpm db:migrate
   ```
3. Confirm it applied cleanly — `drizzle-kit migrate` prints each migration file it ran; no output means nothing was pending.
4. If the Vercel deploy for that commit already finished before step 2, check `/api/health` and the app's error logs (Vercel dashboard) for query failures against the missing schema, since there was a window where new code could have hit old schema.

## Testing Strategy

- **CI**: `.github/workflows/ci.yml` runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, a real migration against a fresh Postgres, and `pnpm build` on every push/PR.
- **Unit tests**: Vitest with jsdom for pure function testing for domain logic (target resolution, observations, briefing templates, reconciliation comparison, mock connectors).
- **Integration tests**: `src/__tests__/authorization.test.ts` runs the entire multi-tenant authorization boundary (including the view-as cookie flow, mocked via `vi.mock("next/headers")`) against a real Postgres — `vitest.config.mts`'s `test.env` always points `DATABASE_URL` at the local/CI test database, never a developer's real `.env`, so `pnpm test` can never touch the shared pilot database.
- **Sync orchestration tests**: `run-sync.test.ts` covers the `runSync` fetch→publish→checkpoint flow (happy path, fetch/publish failures, empty data, weekOffset behavior, pagination). `rate-limit.test.ts` covers the cooldown logic. Both use the same mock-tx/mock-db pattern as `compute-values.test.ts`.
- **Known gap**: the DB-orchestrating domain functions (`generate.ts`, `reconciliation/engine.ts`), the real Zendesk connector, and page-level rendering still have zero test coverage — only their pure helpers are tested. Sync orchestration (`runSync`) and rate limiting now have dedicated test files.
- **Type safety**: `tsc --noEmit` with strict mode and `noUncheckedIndexedAccess` as a CI gate.

## Known Gaps (as of the production-readiness pass)

Tracked in more detail in the session that produced this pass — summarized here so a fresh session doesn't have to rediscover them:

- No documented backup/disaster-recovery plan for the Railway database, and no data-retention/PII policy for the real employee data this app stores indefinitely. Both need a decision from James/HungerRush before they can be implemented or written down.
- **Decided (2026-08-27)**: `next-auth` stays pinned to `5.0.0-beta.32` (exact, not a range) — checked npm and no stable v5 has shipped yet, so there is nothing to move to. Re-check when picking up this project again.
- The CSP set in `next.config.ts` allows `'unsafe-inline'` for `script-src`/`style-src` because the App Router injects inline RSC-streaming scripts (`self.__next_f.push(...)`) that a strict `'self'`-only policy would block. Tightening this to a per-request nonce would mean wrapping the `auth` proxy in `src/proxy.ts` to inject and forward the nonce — not done here since it touches the auth gate itself; worth revisiting if XSS hardening becomes a priority.
- Rippling still has no real integration (see Connector Architecture above) — but the sanctioned link-out fallback is now wired: set `RIPPLING_MANAGER_URL` and the 1:1 Prep page shows an "Open Rippling" link.
- **Scoped and reviewed (2026-08-27)**: `docs/MVP.md`'s "permission review" checklist item, read against `docs/BUILD_SPEC.md`'s Phase 10 (where it sits next to "audit/provenance" and "database query review"), meant auditing that every page/route actually enforces the stated authorization model, not just that the `authorization.ts` functions are individually correct (that part was Phase 2's job). The audit found a real gap: `runReconciliation` treated "no teamId" as "compare every employee in the org," and both the `/reconciliation` page and `/api/reconciliation/results` displayed those cross-team employee-level results unfiltered — any manager could see another team's metric values via the reconciliation tool, even though Team/Employee/Home all correctly scope to `ctx.assignedEmployeeIds`. Fixed: "no team selected" now scopes to the triggering manager's own assigned employees, and both the page and the results API filter displayed rows by the *viewing* manager's assignment regardless of who triggered the run. No other page/route was found missing an authorization check.
- **Discovered 2026-08-28 while building roster auto-discovery (Phase 15), partially fixed 2026-08-31**: two-thirds of the seeded `external_identities` rows (24 of 36, for *both* Zendesk and Assembled) used `@revention.onmicrosoft.com` email addresses that matched zero real Zendesk agents (the real domain is `@hungerrush.com`). Since both connectors match tickets/activities by searching on `external_identities.externalId` as a literal email, every affected person had been silently getting no real ticket/activity data matched — not a sync error, just zero matches, which upstream code correctly renders as "no data" rather than a visible failure, so nothing looked broken.
  - **Fixed for Zendesk**: 21 of the 24 verified individually against the live Zendesk API (real, active agent account, name matches the employee record) and corrected to `@hungerrush.com`.
  - **Left unresolved, flagged for James, not guessed at**: 3 people have no clean fix — Crismarie Gabison's `@hungerrush.com` address exists only as an end-user account (not an agent, so it would never match a ticket assignee), and Yuanting Zhou / Hyrum Estrada have no discoverable Zendesk account under any name search. Their `external_identities` rows are untouched.
  - **Assembled is a separate, deeper problem, not touched**: none of the 21 people just fixed for Zendesk could be found in Assembled under any domain or name — Assembled's `/people` list has only 79 people total across the whole HungerRush account, and it looks like it may not track most of this support roster at all. This isn't an email-domain typo like Zendesk's was; it may mean these people were never added to Assembled, or Assembled genuinely isn't scoped to this team. Needs a decision from James, not a blind fix — Assembled's 24 `@revention.onmicrosoft.com` rows are still exactly as they were.
