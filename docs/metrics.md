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
| `is_active` | bool | Inactive metrics are hidden from the UI |

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

- **`first_reply_time` and `handle_time`** are stored in seconds (matching connector output) but the frontend should display them formatted as minutes (e.g. 900 seconds → "15 min"). The `unit` field stays `seconds` in the DB — formatting is a UI concern.
- **`percent`** metrics are stored as 0–100, not 0–1. Display with one decimal place and a `%` suffix.
- **`count`** metrics display as integers with no suffix.
