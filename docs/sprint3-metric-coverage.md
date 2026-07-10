# Sprint 3 Metric Coverage — Alex/Barb Master List vs Plan

**Date:** 2026-07-10 · **Status:** plan amendment, authorized by James
**Amends:** the Sprint 3 implementation plan (Antigravity, final revision, reviewed 2026-07-10)
**Relates to:** `docs/release-plan.md` W3/W4/W5 · REVIEW.md sprint-2 deferrals

James supplied the consolidated list of metrics Alex and Barb track in their manual 1:1
PDFs. This doc maps every item to its disposition and records the **deltas Sprint 3 must
absorb** beyond its final-revision scope. Treat the matrix as the sprint's acceptance
checklist: at sprint end, every row below must be in its stated state.

---

## Coverage matrix

Dispositions: **LIVE** (in production today) · **SPRINT 3** (in the final-revision plan
as written) · **ADD** (new — this amendment) · **DISPLAY** (derived at render time, not
stored) · **DECISION** (blocked on a definition from Alex/Barb) · **NOTES** (belongs in
1:1 notes, not a metric).

### Call metrics (source: Zendesk Talk — all gated on the W3 discovery script)

| Master-list item | Metric key | Disposition |
|---|---|---|
| IB calls offered | `ib_calls_offered` | SPRINT 3 |
| IB calls answered | `ib_calls_answered` | SPRINT 3 |
| IB calls declined | `ib_calls_declined` | SPRINT 3 |
| IB calls missed | `ib_calls_missed` | SPRINT 3 |
| IB answer rate (%) | `pct_ib_answered` | **ADD** — was in release-plan W3 batch 1, dropped in the final revision. One more module computing answered ÷ offered from the same call data (percent, higher_is_better). |
| OB calls | `ob_calls` | SPRINT 3 |
| IB talk time | `ib_talk_time` | SPRINT 3 |
| OB talk time | `ob_talk_time` | SPRINT 3 |
| Calls abandoned on hold | `calls_abandoned_hold` | **ADD (conditional)** — extend the discovery script: does the incremental calls export expose abandoned-on-hold, and is it attributable to an agent? (A call abandoned before answer has no agent; abandoned-while-on-hold should.) Build the module only if discovery confirms both (count, lower_is_better). |

### Ticket metrics (source: Zendesk)

| Master-list item | Metric key | Disposition |
|---|---|---|
| Tickets updated | `ticket_volume` | LIVE — this is exactly its semantic (updated-in-period). Optional: rename the display name to "Tickets Updated" in the admin UI (DB-owned `name`, no code change). |
| Tickets solved (count) | `tickets_solved` | **ADD** — computable from existing `ZendeskWeekData`: tickets whose metric-set `solved_at` falls in the period (solving updates the ticket, so they're already in the updated-in-period fetch). Count, higher_is_better. No connector change. |
| Elevated tickets (worked) | — | **DECISION** — how is "elevated" marked in Zendesk (tag? group? priority? escalation target)? Ask Alex in the discovery step. Buildable as a filter over existing week data once defined. |
| Avoidable elevated tickets | — | **DECISION** — "avoidable" is a human judgment. Either a Zendesk tag leads apply (then computable) or a manual metric. Same discovery question. |
| Average cases solved / day | — | DISPLAY — `tickets_solved` ÷ workdays at render time. Do NOT store a derived value. |
| Tickets assigned | `tickets_assigned` | SPRINT 3 (created/assigned-in-period; their "Tickets") |
| Backlog | `backlog` | SPRINT 3 (open at week's end; separate `status<solved` search per the plan) |

### Efficiency & adherence (source: Assembled — WFM gate applies)

| Master-list item | Metric key | Disposition |
|---|---|---|
| Schedule adherence | `schedule_adherence` | LIVE but computing **null** until the Assembled WFM productive-state mapping exists (L6). Not a Sprint 3 item — the gate is Assembled-side configuration, not code. |
| Occupancy | `occupancy` | LIVE, same gate. Band metric (75–88 healthy range). |

### Time & activity (source: Assembled — same WFM gate; built `is_active = false`)

| Master-list item | Metric key | Disposition |
|---|---|---|
| Total online time | `online_hours` | SPRINT 3 (W5) |
| Away time | `away_hours` | SPRINT 3 (W5) |
| Transfer-only time | `transfer_hours` | SPRINT 3 (W5) |
| Combined away+transfer total | — | DISPLAY — sum at render time |
| Daily averages (online/away/transfer) | — | DISPLAY — weekly value ÷ workdays |

### Attendance (source: manual — the Sprint 3 manual-source architecture)

| Master-list item | Metric key | Disposition |
|---|---|---|
| Attendance points | `attendance_points` | SPRINT 3 (manual, lower_is_better) |
| Unplanned absences (rolling 90-day) | `unplanned_absences` | **ADD** — one more manual metric. The manager enters the current rolling-90-day count each week; trends then track it like any other metric (count, lower_is_better). |
| Late arrivals (rolling 90-day) | `late_arrivals` | **ADD** — same pattern (count, lower_is_better). |
| Exact minutes late per incident | — | NOTES — per-event detail, not a weekly value. Belongs in the 1:1 session notes. |

### Customer satisfaction

| Master-list item | Metric key | Disposition |
|---|---|---|
| CSAT score | `csat_score` | LIVE (ratings submitted-in-period) |

### Previously dispositioned (unchanged — release plan master-list table)

QA audits count → `tickets_audited` (SPRINT 3 manual) · NPS → parked, no source ·
Rank / productivity composite → not building (rule 1) · SLA breach % → `sla_compliance`
exists, inactive until SLA policies are configured in Zendesk.

---

## Plan deltas (what Antigravity must add to the final revision)

1. **`pct_ib_answered`** — restore to the W3 metric set (module + test + registry line +
   `metric_definitions` row + spec).
2. **Discovery script scope** — add two questions: (a) abandoned-on-hold availability and
   agent attribution in the incremental calls export; (b) surface the raw call-record
   fields so the elevated-tickets tag/group question can be answered from data.
3. **`calls_abandoned_hold`** — build only if discovery confirms attribution.
4. **`tickets_solved`** — add to the W4 set (trivial: filter existing week data on
   metric-set `solved_at` in period).
5. **`unplanned_absences` + `late_arrivals`** — add to the manual-metric set (specs +
   `metric_definitions` rows in the manual-metrics migration + they render in the same
   `ManualMetricsPanel`; no extra UI work beyond two more rows).
6. **Coaching prompts** — required for every added row; check against the
   coaching-language rules (CLAUDE.md rule 12) before finalizing. Lower-is-better
   attendance metrics especially: frame as "discuss", never punitive.

## Open questions for Alex / Barb (discovery step, not blockers for the rest)

1. How are **elevated tickets** identified in Zendesk (tag, group, priority, escalation
   path)? And is "avoidable" recorded anywhere (tag) or is it a judgment call at review
   time (→ manual metric)?
2. Confirm the **rolling-90-day** entry model for absences/lateness: the manager types
   the current rolling count each week (simplest, trends work) vs. wanting the app to
   compute the window (would need per-incident storage — out of scope).

## Standing caveats (expectations to set with Alex/Barb)

- **Metrics are org-global, not per-manager.** Activating these puts them on every
  manager's scorecards; non-phone agents simply show the null-state label ("No data").
  Per-manager metric selection is a separate deferred feature — if Alex/Barb want a
  different set than other managers, that's a new decision, not this sprint.
- **Trends unlock 4 weeks after first sync/entry.** Values render immediately on
  activation; improving/to-discuss words appear once 4 weeks of history exist.
- **The WFM gate is real:** adherence, occupancy, and all three W5 hour metrics stay
  null until Assembled's state taxonomy is mapped (Assembled-side configuration).
- **Everything ships `is_active = false`** and is enabled one metric at a time via the
  admin UI after DB-side value sanity checks (2–3 agents vs a hand-pulled report) — the
  established W3/W4 verification pattern.
