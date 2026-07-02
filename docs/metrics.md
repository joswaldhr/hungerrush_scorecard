# Metric Definitions

Metric definitions live in the `metric_definitions` table — never hardcoded in UI components.
The `coaching_prompt` column is what the frontend must use for all coaching language shown
during 1:1s. The lint rule in `apps/web/eslint.config.js` enforces this.

## Fields per metric

| Column | Type | Notes |
|---|---|---|
| `key` | text | Internal identifier, e.g. `csat_score` |
| `name` | text | Display name shown in UI |
| `unit` | text | `percent`, `seconds`, `count` |
| `source` | enum | `zendesk` \| `assembled` \| `forethought` |
| `direction` | enum | `higher_is_better` \| `lower_is_better` |
| `coaching_prompt` | text | The coaching cue shown during 1:1s — never hardcode this |
| `display_order` | int | Controls UI ordering — not a weight or composite score input |
| `is_active` | bool | Inactive metrics are hidden from the UI **and skipped by the sync** (Phase 1B): the sync writes registry ∩ `is_active`, so toggling in the admin UI starts/stops collection with no deploy |

The DB row is the runtime-editable half of a metric. The code-side half is its `MetricSpec`
(`packages/shared/src/metricSpec.ts`): source, unit, direction, plus the two UI labels
(`nullLabel` for the KPI tile's no-data state, `shortLabel` for rollup chips). Specs are
isomorphic data — the api registry and the web components import the same map.

## Direction indicators

- `higher_is_better` → up arrow is positive (hr-green), down arrow is attention (amber-500)
- `lower_is_better` → down arrow is positive (hr-green), up arrow is attention (amber-500)
- Neutral / no change → slate-400

Never use red for a performance direction. Red is reserved for system errors only.

## Metric catalog

### Zendesk metrics

| # | Key | Display Name | Unit | Direction | Coaching Prompt |
|---|-----|-------------|------|-----------|-----------------|
| 1 | `ticket_volume` | Ticket Volume | count | higher_is_better | How is throughput building this week? Recognize strong output and discuss what support could help maintain the momentum. |
| 2 | `first_reply_time` | First Reply Time | seconds | lower_is_better | How is initial response speed improving? Discuss what's working well and explore opportunities to build toward even faster engagement. |
| 3 | `csat_score` | Customer Satisfaction | percent | higher_is_better | What's driving positive customer feedback? Highlight what's growing and explore opportunities to build on that momentum. |
| 4 | `sla_compliance` | SLA Compliance | percent | higher_is_better | How are service-level commitments being met? Recognize improving trends and discuss what could help build toward more consistent results. |
| 5 | `resolution_rate` | Resolution Rate | percent | higher_is_better | Look at how effectively issues are being resolved. What's working in strong weeks? Where is there an opportunity to grow? |

### Assembled metrics

| # | Key | Display Name | Unit | Direction | Coaching Prompt |
|---|-----|-------------|------|-----------|-----------------|
| 6 | `schedule_adherence` | Schedule Adherence | percent | higher_is_better | Explore how schedule follow-through is going. What routines are working well? Where might there be an opportunity to adjust the daily flow? |
| 7 | `occupancy` | Occupancy | percent | higher_is_better | Look at the balance between productive time and availability. Is the pace sustainable? Discuss what's growing well and where there's an opportunity to improve. |
| 8 | `handle_time` | Average Handle Time | seconds | lower_is_better | Review how customer interaction efficiency is improving. What patterns from strong weeks can be applied more broadly? |

## Sync windows and trend data

Sync pulls one week at a time. Live sync covers Monday 00:00 UTC through the current
timestamp; snapshot sync covers Monday 00:00 UTC through Sunday 23:59 UTC. Trend data
is built from accumulated weekly snapshots — the connectors never pull more than one
week of raw API data per run. Dashboard reads the last 4 weeks of `metric_snapshots`
for sparklines.

## Display formatting notes

- **`first_reply_time` and `handle_time`** are stored in seconds (matching connector output). Display auto-scales: under 60 minutes shows minutes (e.g. 900 seconds → "15.0 min"), 60 minutes or more shows hours (e.g. 442414 seconds → "122.9h"). Values reflect business hours only (Zendesk `reply_time_in_minutes.business` field). The `unit` field stays `seconds` in the DB — formatting is a UI concern.
- **`percent`** metrics are stored as 0–100, not 0–1. Display with one decimal place and a `%` suffix.
- **`count`** metrics display as integers with no suffix.

## Adding a metric (Phase 1B recipe)

Four small artifacts, no sync-logic change, no component change. Worked example: a
`reopen_count` metric (Zendesk, count of tickets reopened this week, lower is better).

**1. Spec entry** — `packages/shared/src/metricSpec.ts`, one entry in `METRIC_SPECS`:

```ts
reopen_count: {
  key: 'reopen_count',
  source: 'zendesk',
  unit: 'count',
  direction: 'lower_is_better',
  nullLabel: 'No data yet',
  shortLabel: 'Reopens',
},
```

**2. Metric module** — new file `apps/api/src/metrics/reopen_count.ts`:

```ts
import { METRIC_SPECS, type MetricSpec } from '@scorecard/shared';
import type { ZendeskWeekData } from './types';

export const spec: MetricSpec = METRIC_SPECS['reopen_count']!;

export function compute(data: ZendeskWeekData): number | null {
  if (data.tickets.length === 0) return null;
  // compute from data.tickets / data.metricSets — pure function, no API calls
  return data.tickets.filter(t => t.status === 'open' /* …reopen predicate… */).length;
}
```

Write its characterization tests alongside (`reopen_count.test.ts`, fixture builders in
`metrics/testUtils.ts`). Follow the null-vs-zero decision: null means "no data", zero
means "measured zero".

**3. Registry line** — `apps/api/src/metrics/registry.ts`: add `import * as reopenCount
from './reopen_count';` and one line in `ZENDESK_METRICS` (or `ASSEMBLED_METRICS`).

**4. Migration** — new numbered file inserting the `metric_definitions` row (key, name,
unit, source, direction, coaching_prompt, display_order, `is_active`). Include the
`-- ROLLBACK:` block; update `docs/architecture.md` after applying. Check the coaching
prompt against the coaching-language rules before finalizing.

The sync picks the metric up on the next run with zero changes to `syncService`,
connectors, or UI components — tiles and rollup chips render from `metric_definitions` +
`METRIC_SPECS`. Start the row with `is_active = false` if you want to deploy the code
before turning collection on.

**If the compute needs data the fetcher doesn't return yet** (e.g. ticket tags): extend
that source's `WeekData` type (`apps/api/src/metrics/types.ts`) and the connector's
`fetchWeekData` to include it. Still no sync-logic change. Data shared by every agent
(SLA targets, org-wide activity lists) belongs in the connector's run context
(`prepareRun`), fetched once per sync run — never per employee.
