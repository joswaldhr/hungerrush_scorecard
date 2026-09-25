# HungerRush Cadence — Metric Registry

> September 24 audit branch: the tables below describe legacy configuration and include
> superseded calendar/null behavior. Use the [contract audit](audits/2026-09-23-metric-contracts.md)
> and [implementation ledger](audits/2026-09-23-implementation-progress.md) for current status.
> The approved ticket policy counts verified human activity only. Until a source-bound
> human-only publisher is validated, Zendesk `tickets_updated` and `tickets_resolved` values
> are unavailable in manager scorecards, comparisons, exports and stored-period views.
> Stored values/revisions are preserved, targets remain configured, and no historical
> recalculation or production deployment is implied. A stored complete flag or version
> number alone does not certify human activity.
>
> Closed-period target judgments are also withheld until historical team/line and target
> context is preserved. Numeric observations remain available under their own quality rules;
> current-week targets still use effective configuration. Exports carry the historical
> target-context warning. This avoids reinterpreting past performance after a profile edit.

Source of truth: `metric_definitions` / `metric_targets` / `metric_assignments` rows. Originally populated only by `src/lib/fixtures/seed.ts` (last verified against `seed.ts` at commit `85969b6` on 2026-09-01) — there is still no admin UI that creates or edits metric configuration. Since 2026-09-17, `metric_targets`/`metric_visibility_overrides` rows can also come from the one-off `scripts/load-target-config.ts` loader (see `scripts/target-config-2026-09.json`), which is how the Menufy line-scoped range targets below were loaded — checking `seed.ts` alone will miss them. If either file has changed since it was last verified against, re-verify this table before trusting it.

This is a reference document, not application code. It exists so that "what does this metric actually mean" has one answer instead of needing to be re-derived from `compute-values.ts` every time. See `docs/METRIC_TRACEABILITY.md` for the full source→UI chain per metric.

## Live metrics (5)

| Field | Tickets Resolved | Avg Handle Time | CSAT Score | Backlog | Avg Response Time |
|---|---|---|---|---|---|
| Key | `tickets_resolved` | `avg_handle_time` | `csat_score` | `backlog_count` | `avg_response_time` |
| Category | productivity | efficiency | quality | workload | efficiency |
| Source system | Zendesk | Zendesk | Zendesk | Zendesk | Zendesk |
| Source field(s) | ticket `status` (solved/closed count) | `full_resolution_time_in_minutes.business` | `satisfaction_ratings.score` | open ticket count | `reply_time_in_minutes.business` |
| Raw → normalized transform | count of tickets with `status` in {solved, closed}, updated in period (`zendesk.ts:274-277`) | mean of business minutes across tickets *created* in period; a ticket with `business === 0 && calendar > 0` is excluded as "not yet measured," not counted as 0 (`zendesk.ts:168-172, 283-287`) | `good / (good + bad) * 100`, rounded to 2dp, over ratings with a definitive score (`zendesk.ts:312-314`) | count of open tickets (`status < solved`) as of the current week only — never computed for a past week (`zendesk.ts:262-265, 292`) | mean of business minutes across tickets *created* in period, same exclusion rule as AHT (`zendesk.ts:288-289`) |
| `calculationType` | sum | average | average | latest | average |
| Unit | tickets | min | % | tickets | min |
| Direction | higher_is_better | lower_is_better | higher_is_better | lower_is_better | lower_is_better |
| Time period | week (Mon–Sun UTC) | week (Mon–Sun UTC) | week (Mon–Sun UTC) | week (Mon–Sun UTC, current week only) | week (Mon–Sun UTC) |
| Timezone | UTC — canonical path (`utils.ts`, `zendesk.ts:104-114` both use `getUTCDay`/`setUTCDate`) | same | same | same | same |
| POS target | min 45 / warn 35 | max 12 / warn 15 | min 85 / warn 75 | max 8 / warn 12 | not assigned to POS |
| Menufy target | min 35 / warn 25 | not assigned to Menufy | min 80 / warn 70 | not assigned to Menufy | max 15 / warn 20 |
| Display format | `value.toFixed(0)` (count) | `value.toFixed(1)m` (duration+min) | `value.toFixed(1)%` (percentage) | `value.toFixed(0)` (count) | `value.toFixed(1)m` (duration+min) |
| Null behavior | facts with `numericValue === null` are skipped from aggregation, never coerced to 0 (`compute-values.ts:49`) | same | same | same | same |
| Missing-data behavior | no `metricValues` row is written for a (employee, period) with zero non-null facts (`compute-values.ts:63`); UI shows `no_data` status, not 0 (`target-resolution.ts:77`) | same | same | same | same |
| Freshness requirement | no explicit SLA is defined anywhere; the de facto rule is the Data Health page's >24h staleness flag (`data-freshness.tsx:26-28`) | same | same | same | same |
| Assignment | POS (primary), Menufy (primary) | POS (primary) | POS (primary), Menufy (primary) | POS (secondary) | Menufy (primary) |

## Range-target metrics (Menufy line-scoped, added 2026-09-17)

Verified against the real database and `zendesk.ts` at commit `11adccc` on 2026-09-21 --
these were not previously documented here.

| Field | Tickets Resolved (Menufy line targets) | IB (Inbound) | OB (Outbound) |
|---|---|---|---|
| Key | `tickets_resolved` | `inbound_calls_offered` | `outbound_calls` |
| Category | ticket_case_work | inbound_call | outbound_call |
| Source system | Zendesk (ticket API) | Zendesk Talk | Zendesk Talk |
| Source field(s) | same as the Live metrics table entry above | count of Talk call records with `direction === "inbound"` in the period | count of Talk call records with `direction === "outbound"` in the period |
| Raw -> normalized transform | same as above | `aggregateCalls()`'s `inbound.length` (`zendesk.ts:269,274`) | `aggregateCalls()`'s `outbound.length` (`zendesk.ts:270,283`) |
| `calculationType` | sum | sum | sum |
| Unit | tickets | calls | calls |
| Direction | higher_is_better | higher_is_better | neutral |
| Menufy target (per line) | range: restaurant [75, 128], consumer [282, 443] | range: restaurant [52, 72], consumer [30, 52] | range: restaurant [35, 75], consumer [75, 112] |
| Menufy target (no line set / not yet tagged) | falls back to the team-wide `minimum` target below -- see the caveat under the Live metrics table's `tickets_resolved` row | no team-wide fallback target exists | no team-wide fallback target exists |
| POS target | unaffected -- `tickets_resolved`'s POS row above is untouched; IB/OB have no POS assignment at all | not assigned to POS | not assigned to POS |
| Range semantics | on-target only strictly within [min, max]; below min is under-volume, above max is flagged too (see `target-resolution.ts`'s range branch) | same | same |

`tickets_resolved`'s Menufy target in the Live metrics table above (`min 35 / warn 25`) is a
real, still-present team-wide fallback row (`team_id` set, `line` null) -- but for the 19 of
20 Menufy employees who have a `line` tagged, the range target above takes precedence per
`target-resolution.ts`'s line-disqualification rule. The fallback only actually applies to an
untagged employee.

## Defined but unassigned (2)

These stay in the catalog (`metric_definitions` rows exist) but have no `metric_assignments` row for either team, so they never appear on any manager-facing page. Treat their status as **UNKNOWN / not producing data**, not FAIL — "unassigned" is a deliberate scope decision recorded in `seed.ts`'s own comments, not a broken pipeline.

**`first_contact_resolution`** — category quality, unit %, higher_is_better, calculationType average, sourceStrategy `zendesk`.
Reason unassigned: Zendesk has no native "first contact resolution" field. No connector code computes it. (`seed.ts:531-532`)

**`schedule_adherence`** — category attendance, unit %, higher_is_better, calculationType average, sourceStrategy `assembled`.
Reason unassigned: the Assembled connector was removed from the codebase. The metric definition row remains in the catalog but has no connector to produce data and no assignment to either pilot team.

## Assigned but no producing connector (3) — always shows "No Data"

Added 2026-09-17 while loading Menufy Restaurant/Consumer target config. Unlike the "defined but
unassigned" pair above, these three **do** have real `metric_assignments` rows (Menufy team) and
real `metric_targets` rows (per-line), so they render as normal rows with a configured target —
but no connector code produces a value for them, so they will show `no_data` status permanently
until that changes. This is expected, not a bug; confirmed and decided explicitly, not discovered
as a surprise later.

**`declined_calls`**, **`missed_calls`** — category inbound_call, unit calls, lower_is_better.
Zendesk Talk's per-call records (`ZendeskCall` in `zendesk.ts`) don't carry a "declined"/"missed"
completion status or a caller-identity field for either of these — the connector's own code
comment (`zendesk.ts` near `aggregateCalls`) already documents that this data only exists on
Zendesk's live-only `agents_overview`/`agents_activity` endpoints, which can't be queried
historically. See the `phone-system` project memory for the fuller picture (24 metrics live, 12
more including these blocked by the same gap).

**`csat_response_rate`** — category quality, unit %, higher_is_better. Likely hits the same wall
that already breaks `csat_score`'s sibling data (Zendesk's `/satisfaction_ratings.json` gap noted
elsewhere in this project's history) — not separately re-diagnosed, flagged as the probable same
root cause rather than assumed without checking.

## Not a metric source

**Entra ID (Microsoft)** contributes no metric values. Live today only as the SSO
authentication provider (`src/lib/auth/index.ts`). The identity-verification / daily
account-disabled check described in earlier versions of this doc is not actually
implemented -- verified 2026-09-21: no connector or sync code for an `"entra"` data source
type exists anywhere in `src/lib`, and no such row exists in the real database (only
`zendesk` and `assembled`). `data-health/page.tsx` has a dead UI branch for it. See
`docs/INTEGRATIONS.md`.

**Rippling** has no connector code. A static "Open in Rippling" link-out button exists via `RIPPLING_MANAGER_URL`. It contributes no metric values.
