# HungerRush Cadence — Metric Traceability

For each live metric, the full path from the vendor API field to the number a manager sees, with exact file references. Pair with `docs/METRIC_REGISTRY.md` (what a metric means) and `docs/audits/2026-09-01-metric-integrity-report.md` (verdicts and findings).

UI consumers for all five live metrics:
- `src/app/(app)/one-on-ones/[id]/page.tsx` (1:1 detail) — via `getEmployeeMetrics`/`getMetricHistoryBatch`

(Team used `getEmployeeMetricsBatch` and was removed 2026-09-22 — see CLAUDE.md's Product UX
revision note. This doc's claim that `one-on-ones/page.tsx` [the picker] also called
`getEmployeeMetricsBatch` was already stale before that removal -- checked directly 2026-09-22:
the picker only calls `getAssignedEmployees`/`getVisibleTeamsForManager`, no metrics. Not a
regression from removing Team; `getEmployeeMetricsBatch` remains live via
`briefings/generate.ts`, so it's not dead code.)

Home (`page.tsx`) redirects to `/one-on-ones`. The standalone Employee route was removed. Line
numbers below predate several rounds of changes to `zendesk.ts` and should be re-verified
against the current file before trusting exact line numbers.

Since 2026-09-17, two more steps sit in every chain below, between `metricValues` and the UI
layer, regardless of which metric: `target-resolution.ts`'s `scoreCandidate` disqualifies a
target whose `line` doesn't match the employee's line before any other scoring, and a
`MetricVisibilityOverride` check (`visibility-resolution.ts`) can hide a row entirely,
independent of whether a value exists.

## Tickets Resolved

```
Zendesk ticket status (solved/closed count, updated in period)
  → zendesk.ts:274-277 fetchRecords() counts tickets, payload.ticketsResolved
  → zendesk.ts:345-357 normalizeRecords() → normalizedFacts.factType = "tickets_resolved"
  → compute-values.ts groups by (employeeId, periodStart, periodEnd), calculationType "sum"
  → aggregateSourceValues() sums the group → metricValues row
  → target-resolution.ts resolveTarget() + evaluateStatus() (minimum, higher_is_better)
  → Team / 1:1 detail / 1:1 list, via getEmployeeMetrics(Batch)
```

## Avg Handle Time

```
Zendesk full_resolution_time_in_minutes.business, tickets created in period
  → zendesk.ts:168-172 businessMinutes() excludes business===0 && calendar>0 as unmeasured
  → zendesk.ts:283-287 averageOf() → payload.avgHandleTimeMinutes
  → zendesk.ts:358-371 normalizeRecords() → normalizedFacts.factType = "avg_handle_time"
  → compute-values.ts, calculationType "average"
  → metricValues → target-resolution.ts (maximum, lower_is_better)
  → Team / 1:1 detail / 1:1 list
```

## CSAT Score

```
Zendesk satisfaction_ratings.score (good/bad) for the assignee
  → zendesk.ts:140-166 fetchRatings() collects ratings by numeric assignee ID
  → zendesk.ts:312-314 good/(good+bad)*100, rounded to 2dp → payload.csatScore
  → zendesk.ts:402-415 normalizeRecords() → normalizedFacts.factType = "csat_score"
  → compute-values.ts, calculationType "average"
  → metricValues → target-resolution.ts (minimum, higher_is_better)
  → Team / 1:1 detail / 1:1 list
```

## Backlog

```
Zendesk open ticket count (status<solved), current week only
  → zendesk.ts:262-265,292 fetchRecords() — weekOffset===0 guard, null for past weeks
  → zendesk.ts:386-399 normalizeRecords() → normalizedFacts.factType = "backlog_count"
  → compute-values.ts, calculationType "latest"
  → metricValues → target-resolution.ts (maximum, lower_is_better)
  → Team / 1:1 detail / 1:1 list (POS only — not assigned to Menufy)
```

## Avg Response Time

```
Zendesk reply_time_in_minutes.business, tickets created in period
  → zendesk.ts:168-172 businessMinutes() same exclusion rule as AHT
  → zendesk.ts:288-289 averageOf() → payload.avgResponseTimeMinutes
  → zendesk.ts:372-385 normalizeRecords() → normalizedFacts.factType = "avg_response_time"
  → compute-values.ts, calculationType "average"
  → metricValues → target-resolution.ts (maximum, lower_is_better)
  → Team / 1:1 detail / 1:1 list (Menufy only — not assigned to POS)
```

## IB (Inbound) / OB (Outbound) calls (Menufy-only, range targets)

Not previously documented here. See `docs/METRIC_REGISTRY.md`'s "Range-target metrics" table
for the target values themselves.

```
Zendesk Talk call records for the period
  → zendesk.ts:268-289 aggregateCalls() -- inbound.length / outbound.length
    (filtered by call.direction === "inbound" / "outbound")
  → zendesk.ts:699-727 normalizeRecords() -> normalizedFacts.factType =
    "inbound_calls_offered" / "outbound_calls"
  → compute-values.ts groups by (employeeId, periodStart, periodEnd), calculationType "sum"
  → metricValues → target-resolution.ts resolveTarget() (range, line-scoped: restaurant vs.
    consumer resolve to different [min, max] bounds) + evaluateStatus()
  → Team / 1:1 detail / 1:1 list
```

`tickets_resolved`'s chain above is unchanged in shape, but its `target-resolution.ts` step
now also resolves a line-scoped range target for Menufy employees, not just the POS/Menufy
team-wide minimum targets shown in the original diagram.

## Where the chain breaks for the 2 unassigned metrics

**First Contact Resolution** — the chain never starts. No connector emits a `first_contact_resolution` `normalizedFacts` row (Zendesk has no native FCR field), and no `metric_assignments` row exists for either team, so even if a value existed it would never render.

**Schedule Adherence** — the chain never starts. The Assembled connector was removed from the codebase. The metric definition row exists but has no connector to produce data and no assignment to either team.

## Not part of this chain

**Entra ID (Microsoft)** never writes a `normalizedFacts` row and is not a `sourceStrategy`
any metric definition uses. Live today only as the SSO authentication provider
(`src/lib/auth/index.ts`) -- an identity-verification/departure-check role was described in
earlier versions of this doc but is not actually implemented (verified 2026-09-21: no
connector/sync code or database row for an `"entra"` data source exists; `data-health/page.tsx`
has a dead UI branch for it). See `docs/INTEGRATIONS.md`.

**Rippling** contributes nothing to this chain — no connector code exists. Only a "Open in Rippling" link-out via `RIPPLING_MANAGER_URL`.
