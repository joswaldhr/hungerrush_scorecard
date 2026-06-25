# Metric Definitions

Metric definitions live in the `metric_definitions` table — never hardcoded in UI components.
The `coaching_prompt` column is what the frontend must use for all coaching language shown
during 1:1s. The lint rule in `apps/web/eslint.config.js` enforces this.

## Fields per metric

| Column | Type | Notes |
|---|---|---|
| `key` | text | Internal identifier, e.g. `csat_score` |
| `name` | text | Display name shown in UI |
| `unit` | text | `%`, `min`, `count`, etc. |
| `source` | enum | `zendesk` \| `assembled` \| `forethought` |
| `direction` | enum | `higher_is_better` \| `lower_is_better` |
| `coaching_prompt` | text | The coaching cue shown during 1:1s — never hardcode this |
| `is_active` | bool | Inactive metrics are hidden from the UI |

## Direction indicators

- `higher_is_better` → up arrow is positive (hr-green), down arrow is attention (amber-500)
- `lower_is_better` → down arrow is positive (hr-green), up arrow is attention (amber-500)
- Neutral / no change → slate-400

Never use red for a performance direction. Red is reserved for system errors only.

## Metric catalog

_(Populated in Phase 2 when Zendesk and Assembled connectors are configured and tested.)_

Planned metrics:
- CSAT score (Zendesk)
- First contact resolution rate (Zendesk)
- Average handle time (Assembled)
- Schedule adherence (Assembled)
- Tickets resolved (Zendesk)
