# HungerRush Cadence — Metric Traceability

## September 25 source-contract updates

The older diagrams below describe legacy observations and contain historical line numbers.
For explicitly classified replacement observations, these paths take precedence:

- Solved-cohort CSAT: `zendesk-csat-connector.ts` → `zendesk-solved-csat-record.ts`
  → atomic sync publication → stored source contract and reporting timezone.
- Created-cohort first reply: `zendesk-first-reply-connector.ts` →
  `zendesk-first-reply-record.ts` → `first-reply-contributors.ts` → atomic publication.
  Reported business-time zeros are retained; native missing durations are excluded from
  the measured denominator. Earlier zero-exclusion descriptions below are superseded.
- **Outbound branch candidate, not activated:** `zendesk-talk-worker.ts` persists call/leg
  records and checkpoints → `zendesk-talk-store.ts` reads a consistent snapshot →
  `zendesk-outbound-connector.ts` validates assignments/identities and collects linked-ticket
  metadata → `zendesk-outbound-observation.ts` checks matching population and freshness →
  `zendesk-outbound-record.ts` retains employee replay evidence →
  `outbound-contributors.ts` selects the dedicated replacement without deleting legacy facts.

Outbound counts use distinct employee-participating calls; duration means use employee
legs and native seconds with separate measured denominators. The stored contract is
`zendesk-call-created-agent-leg-outbound-v1`. Current linked-ticket group scope is explicit;
uncertain outcomes remain null, and incompatible targets/comparisons remain withheld.
No route, live policy or schedule consumes this candidate yet. The
[implementation ledger](audits/2026-09-23-implementation-progress.md) owns exact deployed
state, qualification limits and remaining release gates.

> September 24 audit branch: legacy Zendesk ticket totals still exist as stored evidence,
> but `metrics/availability.ts` prevents unverified human activity from reaching manager
> values, status, comparisons, history or exports. The source calculation below is not
> proof of human activity. See the [human-only contract](audits/2026-09-23-action-metric-v2-contract.md)
> and [current implementation ledger](audits/2026-09-23-implementation-progress.md).

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
