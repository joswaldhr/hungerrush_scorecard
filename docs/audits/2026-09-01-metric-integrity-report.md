# Cadence Metric Integrity & Reporting Audit — 2026-09-01

Scope: read-only audit of the metric pipeline (Source → Ingestion → Database → Normalization → Calculation → API → UI) plus a new golden-dataset fixture and deterministic unit tests. No production behavior was changed in this pass — findings below are documented, not fixed. See `C:\Users\JamesOswald\.claude\plans\lively-dancing-harbor.md` for the approved scope and the two decisions that bound it: (1) audit + tests, not fixes; (2) live-source reconciliation is documented as a gap, not built this pass.

Companion documents: `docs/METRIC_REGISTRY.md` (what each metric means), `docs/METRIC_TRACEABILITY.md` (source→UI chain per metric).

## Overall Status: **WARNING**

Not FAIL — the 5 live metrics compute correctly for every scenario tested, and no evidence of data corruption, silent zero-substitution, or cross-tenant leakage was found. Not PASS — several real correctness and process gaps exist (below), and the "reconciliation" feature does not do what its name implies. Treat this as: safe to keep using for the pilot's current two-manager, five-metric scope; not yet ready to be presented as "verified against source" or scaled to team-level aggregate reporting without addressing the findings below.

## Metrics

| | Count |
|---|---|
| Defined | 7 |
| Live (assigned + producing data) | 5 |
| Unassigned (UNKNOWN, not FAIL) | 2 |
| Verdict: PASS | 5 of 5 live metrics — see Metric Verdicts below |
| Verdict: UNKNOWN | 2 (first_contact_resolution, schedule_adherence — no source data to evaluate) |

### Metric verdicts

| Metric | Verdict | Basis |
|---|---|---|
| Tickets Resolved | **PASS** | `compute-values.test.ts` sum-aggregation + two-period-grouping cases pass against golden dataset |
| Avg Handle Time | **PASS** | `compute-values.test.ts` average-with-null-skip case passes; null correctly excluded, not coerced to 0 |
| CSAT Score | **PASS** | Same average path as AHT; formula verified by direct source read (`zendesk.ts:312-314`) |
| Backlog | **PASS** | `compute-values.test.ts` latest-aggregation case passes; takes last-recorded value, not max |
| Avg Response Time | **PASS** | Same average path as AHT/CSAT |
| First Contact Resolution | **UNKNOWN** | No source field exists; cannot be tested because it cannot be produced |
| Schedule Adherence | **UNKNOWN** | Source field exists in principle but Assembled's roster doesn't cover this org's agents (see below); zero real facts to validate against |

These verdicts cover **per-employee calculation correctness only**. They do not cover team-level aggregation (see Finding 1) or live-source agreement (see Finding 5) — those are separate, both WARNING.

## Data Sources

| Source | Status | Contributes | Freshness rule |
|---|---|---|---|
| Zendesk | Live | All 5 live metrics | >24h since `lastSuccessfulSyncAt` = stale (`data-freshness.tsx:26-28`) — the only freshness SLA that exists anywhere in the app |
| Assembled | Live, but 0 useful output | Nothing currently reaches the UI (see Finding 6) | Same >24h rule, but a "successful" sync can still ingest zero real records |
| Entra ID (Graph) | Live | No metrics — identity verification + departure detection only | N/A |
| Rippling | Stub | Nothing (link-out button only) | N/A |

## Critical Findings

Ordered by potential impact if unaddressed. None of these were fixed this pass.

### Finding 1 — Team-level averages are unweighted (Architecture Risk, not yet a visible bug)
**File:** `src/lib/domain/metrics/queries.ts:280`
**Severity:** High (latent) / Medium (current visible impact)
`getTeamMetricTrend` computes `values.reduce((a,b)=>a+b,0) / values.length` — a flat mean across employees regardless of each employee's underlying ticket/call volume. An employee who handled 5 tickets and one who handled 500 count equally toward the team's average handle time. `metrics-queries.test.ts` locks in and names this behavior (test title: "KNOWN GAP"). **Verdict: WARNING.** Not FAIL because nothing currently displaying wrong data was found — but this is the exact bug class the user's spec called out by name (AHT averaging), and any team-level card/chart that uses `getTeamMetricTrend` should be treated as directionally indicative, not precise, until fixed.

### Finding 2 — `weekDates()` is reimplemented 3 times, 2 of them non-UTC
**Files:** `src/lib/utils.ts:8` (canonical, exported, UTC) vs. `scripts/run-reconciliation.ts:10` (private, local server time) vs. inline arithmetic in `zendesk-mock.ts:40` / `assembled-mock.ts:40` (local server time)
**Severity:** Medium
The real connectors (`zendesk.ts:104-114`, `assembled.ts:82-100`) and all UI pages correctly use UTC. Only the CLI reconciliation script and the two *mock* connectors (dev/test fixtures, not live data) diverge. Near a week boundary, in a server timezone other than UTC, these could disagree with the rest of the app about which week a record belongs to. **Verdict: WARNING**, contained — does not affect live Zendesk/Assembled data, but is a real inconsistency worth eliminating. `week-dates.test.ts` covers and pins the canonical implementation's UTC-only behavior; the 2 non-canonical reimplementations are **not exported**, so they could not be unit-tested without a testability-only source edit — deliberately not made this pass (see Deferred, below).

### Finding 3 — `evaluateStatus` mishandles 2 of 4 `TargetType` values
**File:** `src/lib/domain/metrics/target-resolution.ts:82,105`
**Severity:** Low (currently unreachable) / would be High if triggered
`targetType: "exact"` is evaluated identically to `"minimum"` — no equality check exists, so a value far above an "exact" target still reports `on_target`. `targetType: "range"` silently falls through to `no_target`, even though a target row exists — a manager would see "no target set" instead of a real status. **Neither is reachable today** — no `metricTargets` row anywhere uses `"exact"` or `"range"` (only `"minimum"`/`"maximum"` are seeded) — but `target_type` is a free-text column (`schema.ts:242`), so nothing prevents either value from being entered later, e.g. through a future admin UI. `target-resolution.test.ts` now has explicit tests proving both gaps exist. **Verdict: WARNING** (latent, not currently causing incorrect output anywhere).

### Finding 4 — The observation/insight engine is fully built, tested, and completely unused
**File:** `src/lib/domain/metrics/observations.ts`
**Severity:** Medium (feature gap, not a correctness bug)
`detectObservations()` — threshold crossing, ±10% significant change, 3-period streak trend — is implemented and has 229 lines of passing tests. It is called nowhere outside its own test file: no cron job, API route, or page references it. The `metric_observations` table exists but `seed.ts` only ever deletes from it, never inserts. If the product's "What Changed" narrative is meant to be backed by this deterministic engine rather than only the ad-hoc percent-change logic in `briefings/templates.ts`, that wiring does not exist yet. **Verdict: UNKNOWN / not applicable** — the logic itself is not broken, it simply isn't running anywhere, so there is nothing in production to verify.

### Finding 5 — "Reconciliation" does not check against a live source
**Files:** `src/lib/domain/reconciliation/engine.ts:86-125`, `scripts/run-reconciliation.ts`
**Severity:** Medium — a naming/expectations gap, not a data-corruption risk
`runReconciliation()` compares `metricValues` against `normalizedFacts` — the *same* table `metricValues` was computed from. If ingestion wrote wrong data into `normalizedFacts` in the first place, both sides of the comparison agree and the reconciliation report shows "match." This satisfies "did we aggregate correctly" but not "does Cadence match what Zendesk/Assembled actually say right now." Per the approved plan, building a true independent-source check is explicitly deferred, not attempted this pass. `compareValues`/`aggregateSourceValues` themselves are well-tested (`reconciliation.test.ts`, pre-existing) — the gap is what they're being compared *against*, not their own correctness. **Verdict: WARNING.**

### Finding 6 — Assembled genuinely lacks accounts for most of this roster (verified live, updated 2026-09-01)
**File:** `src/lib/connectors/assembled.ts:253` (`if (!person?.agent_id) continue`)
**Severity:** Medium, business decision needed (not an engineering bug)
Verified live against the real Assembled API and the real `external_identities` table (`scripts/check-assembled-roster.ts`, added this pass): **11 of 36 pilot employees (31%) have a working Assembled agent profile with a real `agent_id`**; the other 25 do not appear in Assembled's 78-person `/people` list under any email *or* name variant. This rules out the "same email-domain typo as Zendesk" hypothesis raised earlier in this report and in `docs/ARCHITECTURE.md:307` — it was checked by name specifically. `fetchRecords()`'s `if (!person?.agent_id) continue` is correctly skipping people who are genuinely not in Assembled, not misidentifying people who are. This is not a code defect and nothing in Cadence can fix it; it needs HungerRush ops/IT to provision the missing 25 employees in Assembled. **Verdict: UNKNOWN** (not FAIL — the connector is behaving correctly given real, incomplete source data).

### Finding 7 (Non-Blocking) — 7 silent `catch {}` blocks, all client-side localStorage, none in the calculation pipeline
**Files:** `src/components/meeting-prep-checklist.tsx` (5), `src/components/sidebar-client.tsx` (2)
**Severity:** Low
Repo-wide sweep found exactly 7 empty `catch {}` blocks (verified by direct grep, not estimated). All 7 wrap `localStorage` reads/writes for UI conveniences (a prep checklist, a sidebar collapse state) — a failure there means a UI preference doesn't persist, not that data is lost or miscalculated. One additional empty catch (`client-error/route.ts:19`) is explicitly commented as intentional ("reporting the error must never itself throw"). Every other `catch` in the codebase either logs via `logger.error` (server) or shows a `toast.error` (client) — not silent. Zero `TODO`/`FIXME`/`HACK` markers and zero stray `console.*` calls exist in domain or API code (only in `seed.ts`'s own CLI output and `logger.ts` itself, both expected). **Verdict: PASS** (no calculation-path risk found).

### Already fixed — cite as closed, not re-flagged
A cross-team reconciliation leak (`runReconciliation` treating "no teamId" as "show the whole org," letting a manager see another team's employee-level values through the reconciliation tool) was found and fixed 2026-08-27 (`docs/ARCHITECTURE.md:303`). Verified still fixed in current code: `reconciliation/run/route.ts:71` passes `ctx.assignedEmployeeIds` (never "all"), and `reconciliation/results/route.ts:48-49` independently re-filters by the *viewing* manager's assignment regardless of who triggered the run.

## Architecture Risks

- **`pnpm test` is not hermetic.** `authorization.test.ts` and `roster-reconcile.test.ts` require a real Postgres matching exact `docker-compose.yml` credentials (`cadence`/`cadence_dev`, port 5432). On the machine this audit ran on, something else occupies port 5432, so both suites fail with a confusing `password authentication failed` rather than a clear "no test DB available, skipping." Confirmed via direct run: **114 passed, 19 skipped, 2 test files failed** — identical before and after this audit's new tests were added (the new 29 tests are all pure or mocked-`db`, so they never touch this issue). This is an environment/CI-hygiene gap, not a metric-correctness gap — flagged as WARNING, not FAIL.
- **`compute-values.ts` and `getTeamMetricTrend` are not pure functions.** Both call `db` directly, so testing them (`compute-values.test.ts`, `metrics-queries.test.ts`, this pass) required mocking `@/lib/db`'s exact query-chain shape rather than calling a pure core. This works today but means these new tests will need updating if that internal query structure ever changes — a maintenance cost worth knowing about, not a defect.
- **3 duplicate `weekDates()` implementations** (Finding 2) is itself an architecture smell independent of the UTC/local-time correctness question — one function reimplemented 3 times is 3 places a future fix has to remember to touch.

## Permissions Spot-Check

All 8 routes under `src/app/api/**/route.ts` read directly, not re-tested (DB-layer scoping is `authorization.test.ts`'s job):
- `sync/health`, `sync/run`, `reconciliation/run`, `reconciliation/results` — call `getEffectiveManagerContext`, and `reconciliation/*` additionally calls `assertCanAccessTeam` / filters by `ctx.assignedEmployeeIds`.
- `health` — deliberately public (uptime monitor), documented in a code comment, excluded from `proxy.ts`'s auth matcher.
- `cron/sync` — deliberately unauthenticated by session, gated by a `CRON_SECRET` bearer header instead; excluded from the proxy matcher.
- `client-error` — deliberately open (client error sink), returns no sensitive data.
- `auth/[...nextauth]` — framework-owned.

**Verdict: PASS** — no new gap found, spot-check complete.

## Production Blockers

None found that block continued pilot use at current scope (2 managers, 5 live metrics, no team-aggregate reporting surfaced as authoritative). The naive team-averaging (Finding 1) becomes a blocker **specifically if/when** a team-level average is presented as a precise number rather than a rough trend indicator.

## Non-Blocking Improvements (recommended, not required)

1. Fix `getTeamMetricTrend` to volume-weight, or clearly label team averages as "simple average across employees" in the UI until it is.
2. Consolidate the 3 `weekDates()` implementations into one exported, UTC function; delete the other two.
3. Handle `"exact"` and `"range"` `TargetType` values in `evaluateStatus`, or constrain the `target_type` column to an enum so an unhandled value can never be silently entered.
4. Wire `detectObservations()` into the sync pipeline (write to `metric_observations`) and surface it somewhere, or remove the unused table/tests if the feature is no longer planned.
5. Build a true independent-source reconciliation mode (re-fetch from Zendesk directly, compare against `metricValues`, bypassing `normalizedFacts` entirely) if "verified against source" is a claim the product wants to make.
6. Make `authorization.test.ts` / `roster-reconcile.test.ts` fail with a clear "test database unavailable, skipping" message instead of a raw Postgres auth error when the expected local/CI database isn't reachable.
7. `weekDates()`'s `hour` field (`src/lib/utils.ts:26`, used only for the Home page's "Good morning/afternoon/evening" greeting) uses `now.getHours()` — local server time, not UTC and not the viewer's timezone. Cosmetic only; no metric or period-boundary logic depends on it.
8. Resolve James's outstanding decision on whether Assembled actually covers this support roster (Finding 6) — engineering has no further fix to apply until that's answered.

## What this audit did not attempt (explicitly out of scope, not silently skipped)

- Building real independent-source live reconciliation.
- Wiring the observation engine into any real pipeline.
- Editing the 3 non-canonical `weekDates()` reimplementations to make them unit-testable (would require adding `export` — a testability-only, zero-behavior-change edit, but still a source edit outside this pass's "audit only" scope).
- Fixing any of Findings 1-6.
- Live-clock DST testing or a running-app UI/API/database value spot-check — everything in this pass is static source reading plus hermetic unit tests (`pnpm test`, `pnpm typecheck`, `pnpm lint`, all confirmed green for new code).

## Test Evidence

```
pnpm test:      114 passed, 19 skipped, 2 files failed (both pre-existing, both a local
                 DB-credential mismatch unrelated to this audit's changes)
pnpm typecheck: clean (exit 0)
pnpm lint:      clean (0 errors, 0 warnings after this pass's fixes)
New tests added this pass: 29, across 3 new files (compute-values.test.ts,
                 week-dates.test.ts, metrics-queries.test.ts) plus 11 additions to
                 the existing target-resolution.test.ts
```
