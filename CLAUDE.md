# Cadence engineering rules

## Product

Cadence is an internal manager performance and 1:1 preparation application for HungerRush.
The core journey is 1:1s → employee → reporting period → metrics → the existing meeting
workflow. Preserve the September 22 product decision: do not restore Team, Home dashboards,
or a standalone Employee experience without a new product decision. Do not add employee
rankings, automated employment decisions, generic BI tooling, or AI-generated performance
judgments. Trust and clarity come before visual novelty.

## Documentation and current work

Start with [documentation ownership](docs/README.md), then read the documents relevant to
the change. The [implementation ledger](docs/audits/2026-09-23-implementation-progress.md)
owns the active audit branch's verified state, release gates and next work. The dated
application audit is the original baseline, not a claim that its findings remain unfixed.
Older HANDOFF, INVESTIGATION and FIX_LOG entries are historical evidence; read a relevant
investigation before repeating it, and supersede conclusions only with new evidence.

Schema and executable behavior establish implementation facts. Product decisions establish
intent. If they disagree, document the difference; do not invent vendor behavior or quietly
change business meaning to match the code. Update the owning document with meaningful changes.

## Architecture

Keep a modular Next.js monolith. Server-side authorization and domain readers supply
Cadence-owned data to manager pages. Vendor requests belong in connectors, never browser
components. Metric calculations, target resolution, visibility, availability and status
belong in `src/lib/domain/metrics`, with source-specific contracts at the connector boundary.
Cron and manual publication use the same sync service. Do not add services, generic frameworks
or caches without a measured requirement. Preserve working code and remove only proven dead paths.

Zendesk ticketing and Talk are separate source surfaces. Entra supplies sign-in and separate
Graph roster access. Assembled was removed; Rippling remains a stub. Current app weeks use
Sunday–Saturday UTC via `src/lib/utils.ts`; stored older intervals retain their exact boundaries.

## Data reliability

- Never turn unknown, missing, partial, failed or stale evidence into a believable zero.
- Distinguish source observation time, calculation time, completeness and semantic verification.
- Fetch before publication. Source records, facts, affected metric values, revision evidence,
  checkpoint and success timestamp commit atomically. Failure preserves the last good publication.
- Scope calculation to the changed source and affected employee/period groups. Null corrections
  must retract old values while retaining predecessor evidence; zero remains numeric.
- Preserve source IDs, observation/definition versions and denominators where needed to explain
  a metric. A successful export or internal consistency check is not independent reconciliation.
- Require bounded requests, timeouts, validated same-origin pagination, retry limits, leases
  and resumable checkpoints where source work exceeds one invocation's budget.
- The approved ticket policy credits verified human activity only. Role, channel and updater
  ID alone are insufficient. Manager reads withhold unverified Zendesk ticket counts. Version 2
  remains shadow-only until source-bound identity/activity evidence and reconciliation are proven.
- Do not judge a closed period using today's team/line or edited targets. Until immutable
  historical context exists, retain observations and expose unavailable target comparisons.
- Never silently rewrite historical calculations, periods, source observations or targets.
  Version changes need an explicit effective date, comparison, replay scope and rollback evidence.

## Security and operational safety

Derive identity and organization from server-side authentication. Check object ownership,
assigned employee scope, active status and effective dates on every read and mutation.
Do not expand an individual assignment into team access. Administrative permissions do not
remove organization boundaries. Re-check related IDs and use transactions for multi-step writes.

Never log or commit credentials, raw employee/vendor payloads, or plaintext backups. Keep
telemetry bounded and allowlisted. Tests and fixture resets use explicit isolated loopback
or CI databases and must not load the shared `.env`. Production and Preview have separate
database/authentication settings. Migrations are explicit operations, not build side effects.
Use [the runbook](docs/RUNBOOK.md) for verification, recovery and deployment boundaries.

## UI and performance

Use the existing design system: restrained HungerRush navy/teal, readable operational tables,
consistent typography and spacing, clear keyboard focus, accessible controls and contained
small-screen layouts. Prefer removing clutter over adding cards or narrative. Preserve the
loaded employee/period/value snapshot across navigation and every export; hide stale snapshot
actions while a new period loads. Show uncertainty and recovery states in plain language.

Measure before optimizing. Record representative page/query/source timings and quotas.
Avoid serial source waterfalls, broad historical recomputation and speculative indexes.
Performance improvements must preserve outputs, access checks and freshness semantics.

## Working discipline and completion

Work in focused, reviewable increments tied to an audit finding or product requirement.
State the acceptance check, inspect relevant implementation, make the smallest coherent change,
run meaningful regression checks, review the diff, record evidence and commit before the next
increment. Log unrelated discoveries in the ledger or FOLLOWUPS rather than silently expanding
one change. Do not optimize for line count or a rewrite.

Continue authorized work autonomously under the user's September 24 instruction; do not require
another routine checkpoint approval or a “keep going” message. A missing external fact is not
permission to guess: record the exact uncertainty and continue independent work. Technical
release gates remain requirements, not routine approval prompts.

Use real PostgreSQL tests for transactions, scope and migrations. Validate UI changes in the
hosted synthetic Preview when relevant. Scheduled-job verification includes actual platform
execution and observed output; auth-only rehearsal is distinct from live ingestion/restart.
Run required type/lint/test/build checks for application changes. Record failures and practical
limits honestly. Passing CI or a successful Preview does not mean production was deployed.
Production release requires completed technical gates, a fresh validated backup, a concrete
rollback reference and post-deployment verification. Never claim the app is fully correct while
critical source semantics, recovery or operational verification remain unresolved.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
