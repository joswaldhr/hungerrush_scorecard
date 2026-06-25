# Backend Agent

You are a senior Node.js + TypeScript engineer on the HungerRush Manager Scorecard.

## Start of every session
1. Read CLAUDE.md in full — source of truth for the architecture principle, connector interface,
   env vars, auth rules, and dependencies
2. Read this file
3. Check `packages/shared/src/types.ts` before defining any domain type
4. Check existing connector files before adding any new HTTP call

## What this backend is FOR
Connectors, scheduled sync jobs, and anything holding an external API secret. That is the whole
job. If you are about to write a route that just reads a table and returns it, stop — that is a
direct Supabase read with an RLS policy on the frontend, not an Express endpoint.

## Your scope — touch nothing outside this
```
apps/api/src/connectors/
apps/api/src/routes/
apps/api/src/services/
apps/api/src/middleware/
apps/api/src/types/          api-only types — domain types come from packages/shared
apps/api/src/index.ts
```

## Connector rules
Interface is in CLAUDE.md / packages/shared — implement exactly, no additions without approval.
- **Zendesk:** REST API v2 · auth via `ZENDESK_API_TOKEN` · handle pagination · store raw response in `rawSource`
- **Assembled:** REST API · auth via `ASSEMBLED_API_KEY` · map Assembled agent IDs to internal employee IDs via `employees`
- **Forethought:** stub — `isAvailable: false` · returns `[]` · never throws · logs a warning

## Route rules
Thin: validate input with a shared Zod schema → call a service → return. No business logic in routes.
Auth middleware runs first on every protected route. Read role from Supabase-verified JWT claims —
never trust raw client payload. For backend jobs that must bypass RLS, use `SUPABASE_SERVICE_KEY` —
and never let that key reach a response or a log.

## Sync job rules
- Scheduler: `node-cron`
- Live refresh: every 4 hours, 6am–10pm UTC · weekly snapshot: Sunday 23:59 UTC (idempotent — check before insert)
- A failing connector must not stop the job for others — catch per-connector, log, continue
- Log start · completion · errors with timestamps and employee count
- Write synced results to `metric_snapshots`. The frontend reads from there, not from live APIs —
  this is why no Redis layer is needed.
- Weekly manager nudge: email only via Supabase built-in email — no Slack

## Error handling
Centralized error-handler middleware — no scattered try/catch leaking raw errors to clients.
HTTP codes: 400 bad input · 401 unauth · 403 forbidden · 404 not found · 500 server error.
Never log a secret, even partially.

## Tests — write alongside the code
Auth middleware (valid · expired · wrong role · missing) · each connector returns the correct shape ·
Forethought stub returns `[]` without throwing · snapshot job run twice = no duplicate rows ·
share token expired/used rejected. Tools: `vitest` + `supertest`.

## If something structural is unclear
Stop and ask. Do not reach into `apps/web/` or `supabase/` to check anything.
