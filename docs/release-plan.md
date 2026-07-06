# Small Release + Master-List Metrics + Design — Plan

## Context

James wants a small release to demo to four colleagues (Alexander Smith, Barbara Maenza — senior managers over 3 manager-teams each; Mike Pacilio — manager; Adam Seow — their boss), and Alex/Barb supplied a master list of ~28 metrics they capture in 1:1s today. The attached redesign HTML was verified to be **the same design already reviewed, accepted, and committed** at `docs/design/hungerrush-scorecard-ui/` (bundler export, identical metrics/pages/status labels) — no new design work needed beyond the existing Phase 3 plan. James clarified the product philosophy during planning: **coaching-first governs the visual/tonal frame (no red, supportive language), not the content — negative-direction metrics are in-scope.**

Verified current state (read-only, 2026-07-06): all four people exist via graph sync with working hierarchies. Alex: 3 managers (Edge 12/12 matched, Moon 14/14, Courcy 14/12) with live current-week data. Barb: 3 managers (Murray 6/6, Maynard 8/8, Crawford 9/9), live data. Mike: 3 employees (2 matched; the unmatched one is James himself — correct). Adam: rollup thin by design (one-level-down RLS; his directs are Alex/Barb/Mike with 1/0/3 direct employees). Alex has 1 direct employee (Normando Bonadia Jr) invisible to him under senior RLS.

## Decisions locked during planning (user-confirmed)

1. Alex/Barb **stay `senior_manager`** (demotion would empty their dashboards).
2. Adam gets a **new access tier — NOT admin** (James stays the only admin). → new `executive` role, below.
3. **Negative-direction metrics are in** (SLA breach framing, backlog, missed/declined calls). Visual rules unchanged: no red, coaching language, amber for attention.
4. **Call data source = Zendesk Talk** (existing Zendesk creds likely reach Talk stats endpoints).
5. Structural three — recommendation accepted into plan:
   - **Rank/leaderboard: NOT building.** Compliant 80%: roster **sort-by-metric** (view-level, no stored rank, no composite) — Phase 3 candidate.
   - **Productivity composite: NOT building** (rule #1's exact target; rollup trend counts + tile grid already serve "output at a glance").
   - **Attendance points / 90-day absences: NOT building** (no data source in stack — HR systems; belongs in 1:1 notes free-text if needed).

## Workstreams, in order

### W0 — Cron reliability — ✅ RESOLVED 2026-07-06 (false alarm)
Railway runtime logs (pulled by James) prove every scheduled run since `91084f9` fired on
time: ~20 live syncs at 615–626 rows, daily bootstraps, the Sunday snapshot — one process,
zero restarts, healthy memory (~200–260MB tsx baseline). The "silent windows" were a
measurement artifact: `synced_at` is last-writer-wins, so historical cron windows always
count ~zero after later runs re-stamp the same rows. Verification rule going forward:
Railway logs (filter `[cron]`) or current-window-only stamp counts. Side outcome: the
vestigial `@scorecard/web` Railway service (unexposed, Phase-4-era code, no env vars) was
removed — halves Railway spend. **No release blocker exists. W1 can start immediately.**

### W1 — Phase 1C logic fixes (FRESH SESSION — unchanged scope + one addition)
Exactly as `docs/refactor-plan.md` §d (commits 6–11 + 10b), plus: **pull migration `0016_grant_metric_definitions_update.sql` forward into 1C** so the admin UI save path works (S4) — needed both for the occupancy/adherence re-enable step AND for W3's activate-by-toggle rollout. Rationale for 1C before the release: commit 7's created-in-period split removes the L1 contamination (601k-second reply times) — exactly the numbers metrics-savvy managers will scrutinize; commit 10+10b clean the misleading 0% tiles.

### W2 — Release readiness (1 session) — ✅ CODE COMPLETE session 26 (2026-07-06)

> Delivered in the W2 PR: items 1–5 below (executive role incl. a graph-sync guard so an
> org-sync run never reclassifies a manually-assigned executive; `employees.title` +
> header line; CLAUDE.md philosophy/coral/trend amendments; `docs/demo-smoke-checklist.md`
> with the Normando decision carried to demo day). Remaining are James's steps in the PR
> body: apply 0017 + 0018 in the SQL editor → run `scripts/rls-probe-executive.sql` →
> merge → `/health` sha → `npx tsx scripts/set-adam-executive.ts --execute` → trigger
> `POST /api/sync/org` (backfills titles + live-verifies the guard: Adam stays executive).
> Adam's JWT picks up the role at his next sign-in; his real login at the demo is the
> final check. Item 2 (Normando) is intentionally NOT implemented — decision at the demo.
1. **`executive` role**: migration adds enum value + `visible_manager_ids()` branch (executive → all active manager-role profiles org-wide, admin-like DATA visibility, NO admin pages — frontend gates on `role === 'admin'` stay). Update: JWT claim sync already generic (`profiles.role` → app_metadata); frontend nav/role checks (`RollupPage`, `App.tsx` nav items) add `executive` where `senior_manager` appears; admin pages remain admin-only. Set Adam → `executive` (audited service write or admin UI post-0016). Alternative recorded (not chosen): recursive senior visibility — rejected for now, rewrites the documented one-level scoping org-wide.
2. **Normando Bonadia Jr** (Alex's hidden direct): confirm with Alex at demo — reassign to one of Alex's managers (one `employees.manager_id` update, audited) or accept invisibility. One-liner either way.
3. **CLAUDE.md philosophy amendment** (small commit): record "coaching-first = visual/tonal frame; negative-direction metrics allowed as content; no red / coaching language / no composite / no rank unchanged."
4. **`employees.title` field** (additive column + graph sync maps Azure AD `jobTitle`): master-list "Role" row; also feeds the scorecard header (design shows a title under the name). Small: migration + graphSync field + one UI line.
5. **Demo smoke checklist** (execute with the four accounts on release day): each logs in via SSO → Mike sees 3 rows (1 "No data" = James); Alex/Barb see rollup (3 cards each) + drill into manager teams + scorecard/notes/share/PDF; Adam sees org-wide rollup as executive; SharedScorecardPage from a share link; PDF export lands in export log.

### W3 — Call metrics via Zendesk Talk (1–2 sessions, uses the 1B add-a-metric recipe)
1. **Discovery** (read-only): existing creds against Talk endpoints (`/channels/voice/stats/agents_overview`, `/channels/voice/stats/account_overview`, incremental calls export `/channels/voice/incremental/calls`). Confirms plan availability + which fields exist per agent/period.
2. **Batch 1 metrics** (per recipe: spec in shared METRIC_SPECS + module in `apps/api/src/metrics/` + registry line + migration, `is_active=false` until verified): `ib_calls_answered`, `ib_calls_offered`, `pct_ib_answered`, `ob_calls`, `ib_talk_time`. Extend `ZendeskWeekData` with `calls` (fetched in `fetchWeekData` from the incremental export filtered per agent; org-window fetch in `prepareRun` if the API shape favors it — same pattern as Assembled activities).
3. **Batch 2** (Alex/Barb priority order): `ib_calls_declined`, `ib_calls_missed`, `ob_talk_time`, call-based AHT (decide Talk-AHT vs Assembled `handle_time` — one stays, documented).
4. Characterization tests per module; activate via admin toggle (post-0016) after DB-side value sanity per metric.

### W4 — Ticket extras (small, 1 session with W3-batch-2)
- **`backlog`** (open tickets assigned, lower_is_better): new count in `ZendeskWeekData` (status<solved search) + module.
- **`tickets_assigned`** (their "Tickets"): created/assigned-in-period — natural sibling of commit 7's split; existing `ticket_volume` (updated-in-period) IS their "Tickets Updated". Rename-in-DB decision at migration time.
- **SLA**: `sla_compliance` already exists, inactive because **no SLA policies are configured in Zendesk** — user/Zendesk-admin action; then toggle on. Breach-vs-compliance is a display/direction choice (same computation) — decide at activation; coaching framing stays.
- **Audits / Coachable Moments / Celebrate Wins**: not a metric — a tagged-ticket LIST feature for 1:1s. Logged as Phase 3+ feature candidate.

### W5 — Assembled hours (after 1C commit 10 + WFM state mapping)
`online_hours`, `away_hours`, `transfer_hours` computable from existing `AssembledWeekData.states` (interval math already in `apps/api/src/metrics/intervals.ts`) once the real state-name mapping exists — same discovery 1C commit 10 needs. Gated on Assembled WFM activation (same gate as the standing occupancy/adherence reminder).

### W6 — Parked (no source / needs decision)
- **NPS**: no source in stack — discovery question for Alex/Barb (which tool sends NPS surveys?). Parked.
- **Attendance items**: not building (decision 5).
- **Rank / productivity composite**: not building; roster sort-by-metric logged as Phase 3 candidate.

### W7 — Phase 2 hardening + Phase 3 design implementation (existing plan, unchanged)
Phase 2 per refactor plan (S4 already pulled to 1C; S5 refresh support is a design prerequisite). Phase 3 implements the committed design; **new metrics from W3–W5 appear as tiles automatically** (registry + `metric_definitions` + METRIC_SPECS drive rendering — that's what 1B bought).

## Sequencing summary

> **RESEQUENCED 2026-07-06 (user decision at Cadence adoption — see
> `docs/design/hungerrush-cadence/ADOPTION.md`): the demo now comes AFTER the Cadence
> design implementation.** W0 ✅ and W1 ✅ are done; the live order from here:

| Order | What | Session |
|---|---|---|
| ~~1~~ | ~~W0 cron reliability~~ ✅ resolved (false alarm) | done |
| ~~2~~ | ~~W1 = Phase 1C + 0016~~ ✅ deployed + corrections executed | done (session 25) |
| ~~3~~ | ~~W2 release readiness (executive role, employees.title, philosophy amendment incl. coral rule, smoke checklist)~~ ✅ code complete session 26 — PR open, James's SQL/merge/Adam steps in the PR body | done (session 26) |
| 4 | Phase 2 hardening (refactor plan commits 12–17 — S5 is the Cadence prerequisite; S6 role checks must include `executive`) | fresh session |
| 5 | **Phase 3 = Cadence implementation** (est. 2–3 sessions; scope in ADOPTION.md) | fresh sessions |
| 6 | **SMALL RELEASE / demo to the four** (on the Cadence UI) | user + smoke checklist |
| 7 | W3/W4 metric expansion batches | 1–2 sessions |
| 8 | W5 when WFM mapping lands | per refactor plan |

## Master-list disposition (talking points for Alex/Barb)

| Their item | Disposition |
|---|---|
| Agent, Manager | Already in system (hierarchy) |
| Role | W2 `employees.title` via Azure AD |
| Rank | Not building — roster sort-by-metric candidate instead |
| IB offered/answered/declined/missed, %answered, OB calls, talk times | W3 via Zendesk Talk |
| AHT | W3 (Talk) vs existing `handle_time` (Assembled) — one wins in discovery |
| Tickets / Tickets Updated | `tickets_assigned` (W4) / existing `ticket_volume` |
| Backlog | W4 |
| SLA breach % | `sla_compliance` exists — needs SLA policies configured in Zendesk, then toggle |
| Audits/Coachable/Wins | Feature candidate (tagged-ticket list in 1:1 view), not a metric |
| CSAT | Live today |
| NPS | Parked — no source identified |
| Productivity | Not building (composite) — rollup trend counts serve this |
| Online/Away/Transfer hours | W5 via Assembled states, post-WFM mapping |
| Attendance points, 90-day absences | Not building — HR-system domain; 1:1 notes if needed |

## Verification

- **W0**: armed 18:00 UTC watcher verdict; then 24h of cron windows each showing one clean stamp (DB query recipe in refactor plan).
- **W1**: per-fix expectations already tabled in refactor plan §d (each commit = test update + fix + re-sync + explained diff).
- **W2**: executive role — RLS probe as Adam's JWT (or user login) sees org-wide rollup but 403/redirect on admin pages; typecheck/tests; smoke checklist executed with all four accounts.
- **W3/W4**: characterization tests per new module; deploy with `is_active=false`; enable one metric at a time via admin UI; DB-side value sanity (counts vs a hand-pulled Zendesk Talk report for 2–3 agents) before announcing.
- Context rule respected: each numbered workstream is its own session; nothing else lands in this one.
