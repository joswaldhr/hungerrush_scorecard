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
- [x] Historical metric values — schema, compute, and query layer built; no
      history exists yet because no vendor sync has run against the pilot
      roster. Verify once a sync has completed.
- [x] Deterministic trend/change observations

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
- [ ] Verified Zendesk integration — connector is built and configured
      against the real account, but no sync has been run end-to-end yet
      (Data Health shows "Never synced"). Run one and confirm real values
      land in `metric_values` before checking this off.
- [ ] Verified Assembled integration — same as above.
- [ ] Rippling capability discovery — blocked. No Rippling API access,
      scopes, or credentials have been confirmed; per project rules, this
      must not be guessed at.
- [x] Source reconciliation — tooling built and confirmed working live: a
      run correctly reported "source missing" for everything, since no
      sync has populated source data yet.
- [ ] Permission review — not yet scoped. Needs a decision on what this
      review covers (access model audit? real-manager sign-off on scope?)
      before it can be tracked as done.

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
