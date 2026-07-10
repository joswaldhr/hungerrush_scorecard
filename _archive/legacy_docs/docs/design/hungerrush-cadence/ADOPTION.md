# Cadence v2 — adopted design direction (2026-07-06)

> **This supersedes `docs/design/hungerrush-scorecard-ui/` as THE Phase 3 design source.**
> Reviewed in full and adopted by James 2026-07-06 (session 25) with the four decisions
> below. The old bundle and the refactor plan's §f½ decision record remain as history;
> where they conflict with this file, this file wins.

Source: `cadence-v2.jsx` (single-file React prototype, mock data — the runtime never
ships; it is the spec).

## The concept

Cadence inverts the scorecard: the **1:1 briefing is the primary pane** (talking points
ordered discuss → celebrate → notes, the top one flagged "start here", each with a
suggested opening question) and **metrics are the supporting evidence panel**, grouped by
source. A horizontal roster strip replaces the dashboard table for picking the person.
This is the most coaching-first framing the product has had.

## Decisions (James, 2026-07-06)

1. **Sequencing — FULL CADENCE BEFORE THE DEMO.** The small-release demo to
   Alex/Barb/Mike/Adam waits for the Cadence implementation. New order:
   **W2 release readiness → Phase 2 hardening (unchanged scope; S5 hook contract is a
   Cadence prerequisite) → Phase 3 = Cadence implementation (est. 2–3 sessions) → demo
   → W3/W4 metric expansion → W5.** The release plan's sequencing table is amended.
2. **Coral adopted as the attention accent.** CLAUDE.md's "never red" rule is AMENDED,
   not repealed: coral `#C4553A` (warm terracotta, always framed as "discuss", never
   "alarm") is the sanctioned attention color; true red remains reserved for genuine
   system errors. Lands in the W2 philosophy amendment + the Phase 3 token swap.
3. **Coaching engine ships FLAGS-ONLY in Phase 3**: talking points + suggested-question
   templates computed client-side from metric flags (discuss/celebrate/steady/new) —
   no schema change. The per-person **context fields** (workload/growth/ramping/personal)
   and their manager edit UI are a **fast-follow after Phase 3** (new table + RLS + UI);
   until then the context-blended question variants are dormant template branches.
   This pulls the old plan's "Phase 5 per-trend-state prompts" idea forward in
   flags-only form. `metric_definitions.coaching_prompt` stays and renders on the
   metric evidence panel; question templates are code-side (they are situational
   engine copy, not per-metric prompts — document any new user-facing strings against
   the coaching-language rules).
4. **Cadence trend semantics become the ONE definition everywhere**, superseding the
   ±2% last-vs-previous decision (old f½ #1): **current value vs prior-period average,
   ±6% threshold, band metrics supported, sparse history (<4 points) = "new" state**
   (trends unlock at week 4; new-hire copy: "keep this one about onboarding").
   Applies to tiles/rows, rollup chips, and frozen last-week views alike.

## What the prototype gets right (adopt as-is)

- **Honest sparklines**: every metric declares a fixed `domain` so small wiggles look
  small; band metrics shade their healthy range. (`MetricSpec` gains optional
  `domain: [lo, hi]` and `band: [lo, hi]` — code-side, no DB change.)
- **Band metrics**: occupancy becomes a band metric (healthy 75–88%; above = burnout
  risk — protective, coaching-first framing). DB `direction` enum stays as-is for now;
  the spec's `band` overrides display/trend logic. A `band` enum migration is deferred
  until a second band metric appears.
- **Per-source degradation**: "‹Source› unreachable — showing last sync (‹when›)".
  Maps directly onto our architecture (frontend already reads only DB snapshots):
  implement as `synced_at`-age staleness display per source. No backend work.
- **New-hire sparse state** and per-source `N wk` history depth chip.
- **Roster chips** with per-person tone dot + next-1:1 time; header counts
  ("N wins / N to discuss") are flag COUNTS — same class as the allowed rollup trend
  counts. Confirmed compliant: no composite, no rank, roster unordered.
- Accessibility floor: aria-labels on sparklines and roster buttons, focus-visible,
  prefers-reduced-motion.

## Required repairs at implementation (compliance)

- Roster label `"needs attention this week"` → coaching-safe copy (e.g. "focus this
  week"); `"one flag"` → rename (echoes "red flag"). Run every engine string through
  the coaching-language check.
- Google Fonts `@import` never ships — self-host Montserrat / Inter / IBM Plex Mono
  (supersedes the old Roboto + Nunito Sans decision).
- `"Tickets solved / wk"` is not a current metric: map the evidence panel to the real
  registry (ticket_volume, first_reply_time, csat_score, resolution_rate + assembled
  when live). A true solved-count metric belongs to the W4 batch if wanted.
- Demo-only bits dropped: mock SOURCES/fetch layer, outage toggle, hardcoded
  actions/context. Actions map to the existing `session_action_items`; notes map to the
  existing session-notes system (week-grouped presentation decision from old f½ #5
  still stands — no schema change).
- Inline styles → Tailwind per stack rules; new tokens land in `tailwind.config.ts`
  and CLAUDE.md's token table is amended in the same commit (navy `#0C1443`,
  teal `#3B8272`, tealTint `#EAF3F0`, coral `#C4553A`, amber `#E9930F`, bg/card/line/
  gray/grayLight per `T` in the source). Old hr-green/hr-navy retire with the reskin.

## Not covered by the prototype — Phase 3 must design these in the same language

Senior-manager rollup, SharedScorecardPage (public, keeps per-tile synced timestamp
rule), PDF export, admin pages (metric config with is_active toggle + explicit save,
per old f½ #3), login, notes/action-item HISTORY (prototype has a bare textarea),
S1 mobile navigation (roster strip already scrolls horizontally — nav chrome for
rollup/admin still needed), 404 page (S10), document titles (S12).

## Still true from the old f½ record

Composite-score audit discipline (re-ran clean on Cadence), single DB coaching prompt
per metric (evidence panel), no `_ds_bundle`-style runtime imports, real role from
`profiles.role` (no role-switcher), S5 hook/error contract as the Phase 2 prerequisite.
