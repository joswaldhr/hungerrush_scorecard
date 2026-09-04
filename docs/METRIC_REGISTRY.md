# HungerRush Cadence — Metric Registry

Source of truth: `metric_definitions` / `metric_targets` / `metric_assignments` rows, currently populated only by `src/lib/fixtures/seed.ts` — there is no admin UI that creates or edits metric configuration (confirmed by grep; only `seed.ts` writes these tables). Last verified against `seed.ts` at commit `85969b6` on 2026-09-01. If `seed.ts` has changed since that commit, re-verify this table against it before trusting it.

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

## Defined but unassigned (2)

These stay in the catalog (`metric_definitions` rows exist) but have no `metric_assignments` row for either team, so they never appear on any manager-facing page. Treat their status as **UNKNOWN / not producing data**, not FAIL — "unassigned" is a deliberate scope decision recorded in `seed.ts`'s own comments, not a broken pipeline.

**`first_contact_resolution`** — category quality, unit %, higher_is_better, calculationType average, sourceStrategy `zendesk`.
Reason unassigned: Zendesk has no native "first contact resolution" field. No connector code computes it. (`seed.ts:531-532`)

**`schedule_adherence`** — category attendance, unit %, higher_is_better, calculationType average, sourceStrategy `assembled`.
Reason unassigned, two compounding causes:
1. Assembled's dashboard-only "productive activity type" mapping has no read API, so adherence can't be derived from `/activities` + `/agents/state` directly (`assembled.ts:132-139` docstring). The connector already works around this via Assembled's own `/reports/adherence` endpoint instead.
2. Even with that workaround in place, Assembled genuinely does not have an account for most of this roster. Verified live 2026-09-01 (`scripts/check-assembled-roster.ts`, cross-referencing Assembled's real `/people` list against the real `external_identities` rows): **11 of 36 pilot employees (31%) have a working Assembled agent profile with a real `agent_id`**; the other 25 do not appear under any email *or* name variant in Assembled's 78-person list. This is not the same email-domain typo bug found and partly fixed for Zendesk — checked by name specifically to rule that out. It means Assembled was simply never provisioned with accounts for most of these support specialists; `fetchRecords`'s `if (!person?.agent_id) continue` (`assembled.ts:253`) is correctly skipping people who genuinely aren't there. Needs HungerRush ops/IT to provision the missing 25 in Assembled — not something Cadence's code can fix.

## Not a metric source

**Entra ID (Microsoft Graph)** contributes no metric values. It performs identity verification (admin-confirmed employee↔Entra account matching) and a daily account-disabled check for departure detection. See `docs/METRIC_TRACEABILITY.md`.

**Rippling** is a stub connector (`rippling-mock.ts` only, no real API calls) plus a static "Open in Rippling" link-out button. It contributes no metric values and is not wired into the sync cron.
