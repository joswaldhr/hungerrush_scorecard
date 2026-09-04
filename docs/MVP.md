# HungerRush Cadence — MVP Checklist v0.1

**Update (2026-09-03):** everything below reflects the state through the "Phase 7 prod-readiness"
pass. Since then, a stakeholder review triggered a real scope cut: Home and the workflow-heavy
"1:1 Preparation" page (with its coaching/quality/action-item/meeting-notes tabs) were deleted;
"Employee" was replaced by a simple metrics-only "1:1s" scorecard; Assembled and Rippling were
both dropped entirely (their integrations below are no longer live — the `[ ] Rippling capability
discovery` item is now moot, not just blocked). Manager UI is now **Team + 1:1s only**. See
`docs/PRODUCT.md`'s revision note for the full reasoning and current spec. Do not treat the
"Manager UI" checklist below as current — it documents what was true as of Phase 7, not today.

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
- [x] Permission review — completed in Phase 7 prod-readiness. Found and
      fixed a cross-team data leak in reconciliation; all other pages/routes
      correctly enforce the authorization model.

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
- [x] Phase 3 — fixed the N+1 query pattern on Team/Home: `getEmployeeMetricsBatch` and
      `getMetricHistoryBatch` run the team-scoped and history queries once per team instead
      of once per employee.
- [x] Phase 4 — zod validation on `sync/run` and `reconciliation/run` POST bodies
      (closes the `thresholdPct` string-coercion gap); CSP/HSTS/X-Frame-Options/
      X-Content-Type-Options headers in `next.config.ts`; unauthenticated `/api/health`;
      `next-auth` beta pin decided (stays pinned — no stable v5 exists yet).
- [x] Phase 5 — accessibility: `aria-pressed` on Team page filter chips and `aria-current`
      on pagination buttons; the Employee page's Context tabs now use `@radix-ui/react-tabs`
      (a new `src/components/ui/tabs.tsx` wrapper) instead of the CSS-only radio hack, giving
      real ARIA tab roles and keyboard navigation.
- [ ] Phase 6 — documented the manual production-migration runbook in
      `docs/ARCHITECTURE.md` ("Production Migration Runbook"). Still open, and needs
      James's decision, not code: whether to also wire an automatic pre-deploy migration
      step (a `vercel-build` script), and custom domain vs staying on `*.vercel.app`.
- [x] Phase 7 (partial) — Rippling link-out implemented (`RIPPLING_MANAGER_URL` env var,
      "Open Rippling" on the 1:1 Prep page); "permission review" scoped and completed (found
      and fixed a real cross-team data leak in the reconciliation tool — see
      `docs/ARCHITECTURE.md`'s Known Gaps). Still open, needing an actual policy answer from
      James, not code: data retention/PII policy; database backup/DR strategy (a Railway
      dashboard config, outside this repo).

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
