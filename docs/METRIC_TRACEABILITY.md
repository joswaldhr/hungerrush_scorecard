# HungerRush Cadence — Metric Traceability

For each live metric, the full path from the vendor API field to the number a manager sees, with exact file references. Pair with `docs/METRIC_REGISTRY.md` (what a metric means) and `docs/audits/2026-09-01-metric-integrity-report.md` (verdicts and findings).

UI consumers as of 2026-09-01 were the same for all five live metrics — confirmed via `grep -l "getEmployeeMetrics|getTeamMetricTrend|getMetricHistory" src/app`:
- `src/app/(app)/page.tsx` (Home)
- `src/app/(app)/team/page.tsx` (Team)
- `src/app/(app)/employee/[id]/page.tsx` (Employee)
- `src/app/(app)/one-on-ones/page.tsx` (1:1 list)

**Update 2026-09-03:** `employee/[id]/page.tsx` was deleted and replaced by
`src/app/(app)/one-on-ones/[id]/page.tsx` — a data-driven metrics table grouped by
`metricDefinitions.category`, still calling `getEmployeeMetrics`/`getMetricHistoryBatch`. Home
was also dropped from manager nav (route still exists, unlinked). This section's per-metric
`normalizeRecords()` line numbers below predate Phase B/C's additions to `zendesk.ts` and
should be re-verified against the current file before trusting exact line numbers.

## Tickets Resolved

```
Zendesk ticket status (solved/closed count, updated in period)
  → zendesk.ts:274-277 fetchRecords() counts tickets, payload.ticketsResolved
  → zendesk.ts:345-357 normalizeRecords() → normalizedFacts.factType = "tickets_resolved"
  → compute-values.ts groups by (employeeId, periodStart, periodEnd), calculationType "sum"
  → aggregateSourceValues() sums the group → metricValues row
  → target-resolution.ts resolveTarget() + evaluateStatus() (minimum, higher_is_better)
  → Home / Team / Employee / 1:1 list, via getEmployeeMetrics(Batch)
```

## Avg Handle Time

```
Zendesk full_resolution_time_in_minutes.business, tickets created in period
  → zendesk.ts:168-172 businessMinutes() excludes business===0 && calendar>0 as unmeasured
  → zendesk.ts:283-287 averageOf() → payload.avgHandleTimeMinutes
  → zendesk.ts:358-371 normalizeRecords() → normalizedFacts.factType = "avg_handle_time"
  → compute-values.ts, calculationType "average"
  → metricValues → target-resolution.ts (maximum, lower_is_better)
  → Home / Team / Employee / 1:1 list
```

## CSAT Score

```
Zendesk satisfaction_ratings.score (good/bad) for the assignee
  → zendesk.ts:140-166 fetchRatings() collects ratings by numeric assignee ID
  → zendesk.ts:312-314 good/(good+bad)*100, rounded to 2dp → payload.csatScore
  → zendesk.ts:402-415 normalizeRecords() → normalizedFacts.factType = "csat_score"
  → compute-values.ts, calculationType "average"
  → metricValues → target-resolution.ts (minimum, higher_is_better)
  → Home / Team / Employee / 1:1 list
```

## Backlog

```
Zendesk open ticket count (status<solved), current week only
  → zendesk.ts:262-265,292 fetchRecords() — weekOffset===0 guard, null for past weeks
  → zendesk.ts:386-399 normalizeRecords() → normalizedFacts.factType = "backlog_count"
  → compute-values.ts, calculationType "latest"
  → metricValues → target-resolution.ts (maximum, lower_is_better)
  → Home / Team / Employee / 1:1 list (POS only — not assigned to Menufy)
```

## Avg Response Time

```
Zendesk reply_time_in_minutes.business, tickets created in period
  → zendesk.ts:168-172 businessMinutes() same exclusion rule as AHT
  → zendesk.ts:288-289 averageOf() → payload.avgResponseTimeMinutes
  → zendesk.ts:372-385 normalizeRecords() → normalizedFacts.factType = "avg_response_time"
  → compute-values.ts, calculationType "average"
  → metricValues → target-resolution.ts (maximum, lower_is_better)
  → Home / Team / Employee / 1:1 list (Menufy only — not assigned to POS)
```

## Where the chain breaks for the 2 unassigned metrics

**First Contact Resolution** — the chain never starts. No connector emits a `first_contact_resolution` `normalizedFacts` row (Zendesk has no native FCR field), and no `metric_assignments` row exists for either team, so even if a value existed it would never render.

**Schedule Adherence** — the chain starts but produces almost nothing. `assembled.ts` does call Assembled's `/reports/adherence` endpoint and does emit a `schedule_adherence` fact when it gets a result, but `fetchRecords()`'s `if (!person?.agent_id) continue` (`assembled.ts:253`) skips any identity Assembled's `/people` list doesn't recognize — which is effectively this entire support roster (79 people total in the whole HungerRush Assembled account). No `metric_assignments` row exists for either team regardless, so the (near-empty) fact stream never reaches the UI either way.

## Not part of this chain

**Entra ID (Microsoft Graph)** never writes a `normalizedFacts` row and is not a `sourceStrategy` any metric definition uses. It performs two unrelated things: (1) admin-driven identity verification (`src/app/(app)/admin/entra-identities`) matching an employee to a real Entra account by name search, never by guessing email; (2) a daily `accountEnabled` check (`entra-check.ts`) against verified identities, feeding `roster_candidates` for departure review. Neither touches `metricValues`.

**Rippling** contributes nothing to this chain — `rippling-mock.ts` is the only implementation, has no real HTTP calls, and its `normalizeRecords()` always returns an empty array by design (identity source only, not metrics — see `connectors.test.ts`'s own assertion of this).
