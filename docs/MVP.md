# HungerRush Cadence — MVP Checklist v0.1

## Must Have

### Platform
- [x] Next.js/TypeScript foundation
- [x] PostgreSQL/Drizzle
- [x] Authentication boundary
- [x] Server-side authorization
- [x] Database migrations
- [x] Testing
- [x] Design tokens

### People
- [x] Organizations
- [x] Teams
- [x] Employees
- [x] Manager assignments
- [x] Cross-system identity mapping

### Metrics
- [x] Metric definitions
- [x] Metric assignments
- [x] Targets
- [x] Historical metric values — a real sync has now run (see Pilot below);
      214 real metric values exist for POS Support. Only 4 weeks deep so
      far — trend charts will fill in further as more weekly syncs run.
- [x] Deterministic trend/change observations

### Admin
- [x] Platform admin concept (`users.is_platform_admin`) + "view as" a real
      manager's pages/data via a signed cookie, enforced server-side
- [x] Manual "Sync now" trigger on Data Health (rate-limited)

### Manager UI
- [x] Home
- [x] Team
- [x] Employee
- [x] 1:1 Preparation
- [x] Loading/empty/error states
- [x] Data freshness
- [x] Source attribution

### Integration framework
- [x] Data sources
- [x] Connector interface
- [x] Source records
- [x] Normalized facts
- [x] Sync runs
- [x] Sync errors
- [x] Data health

### Pilot
- [x] Real POS Support roster — supersedes the original synthetic-data plan;
      once live Zendesk/Assembled/SSO access was confirmed, the pilot was
      seeded with the real HungerRush POS Support roster instead.
- [x] Real Menufy Support roster — same, real roster in place.
- [x] Verified Zendesk integration — ran a real sync end-to-end: 288 records
      ingested, 587 normalized facts, 214 metric values written, 0 errors.
      Real numbers now show on Home/Team/Employee (e.g. POS Support
      Tickets Resolved 7→13, +81%).
- [x] Verified Assembled integration — ran a real sync: 44 records ingested,
      0 normalized facts, 0 errors. That's the correct outcome, not a
      failure: its only metric (`schedule_adherence`) is structurally
      uncomputable from this account (see ARCHITECTURE.md's Connector
      status) and isn't assigned to either team.
- [ ] Rippling capability discovery — blocked. No Rippling API access,
      scopes, or credentials have been confirmed; per project rules, this
      must not be guessed at.
- [x] Source reconciliation — tooling built and confirmed working live: a
      run correctly reported "source missing" for everything, since no
      sync has populated source data yet.
- [ ] Permission review — not yet scoped. Needs a decision on what this
      review covers (access model audit? real-manager sign-off on scope?)
      before it can be tracked as done.

## Production Readiness

A full audit (security/authorization, testing/quality/performance, deployment/infra/ops)
was run and turned into a phased plan. Status as of this pass:

- [x] Phase 1 — fail loudly on missing prod SSO config; log errors server-side instead of
      losing them client-side (new `/api/client-error` route + restored `global-error.tsx`);
      rate-limit the sync/reconciliation endpoints (verified live).
- [x] Phase 2 — CI (`.github/workflows/ci.yml`: typecheck, lint, test, migrate, build on
      every push/PR, verified green); integration tests for the entire authorization
      boundary (`src/__tests__/authorization.test.ts`), which caught and fixed a real bug
      (a malformed view-as cookie crashed instead of degrading gracefully). Tracking
      `drizzle/meta/` in git (was gitignored — blocked reliable migrations in a fresh
      checkout/CI). All lint issues fixed (was 1 error + 11 warnings).
- [ ] Phase 3 — fix the N+1 query pattern on Team/Home (`getEmployeeMetrics` re-runs
      team-scoped queries per employee: 6 DB round-trips × headcount per page load).
- [ ] Phase 4 — zod validation on POST route bodies, security headers, `/api/health`,
      decide on the `next-auth` beta pin.
- [ ] Phase 5 — accessibility (filter/pagination `aria-pressed`/`aria-current`, real ARIA
      tab roles for the Employee page's Context tabs; `@radix-ui/react-tabs` is installed
      but unused).
- [ ] Phase 6 — wire/document the migration step for actual deploys (currently done by
      hand each time); decide on a custom domain.
- [ ] Phase 7 (decisions needed, not code) — data retention/PII policy; database
      backup/DR strategy (Railway dashboard config, outside this repo); Rippling
      real-vs-link-out decision; scope "permission review."

Full detail lives in the approved plan from that session — ask for it to be
regenerated if the original plan file isn't available.

## Explicitly Deferred

- [ ] Mobile app
- [ ] Full company-wide rollout
- [ ] Generic BI/report builder
- [ ] Full Rippling replacement
- [ ] Large AI layer
- [ ] Employee ranking as primary experience
- [ ] Dozens of integrations
- [ ] Complex workflow automation
- [ ] Automated employment decisions
