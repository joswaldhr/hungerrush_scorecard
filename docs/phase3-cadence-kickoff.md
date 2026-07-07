# Phase 3 kickoff prompt — Cadence implementation

> Written at Phase 2 close (session 27, 2026-07-06). Paste the prompt below into a FRESH
> session to start Phase 3. Estimated 2–3 sessions; each session re-reads this file and
> hands off per CLAUDE.md rules. Do not start until PRs #5 and #6 are merged and their
> post-merge verifications pass (SYNC_TRIGGER_KEY set → #5 smoke → #6 live CORS check).

---

Phase 3 session: implement Cadence v2 — the adopted design (`docs/design/hungerrush-cadence/`,
est. 2–3 sessions; this may be a continuation session, check the refactor plan status table
and CLAUDE.md session status for where the previous session stopped). Read CLAUDE.md,
agents/FRONTEND.md, docs/design/hungerrush-cadence/ADOPTION.md (the BINDING decision record),
cadence-v2.jsx (the spec — its runtime never ships), docs/refactor-plan.md (§c for S1/S10/S12,
Phase 2 execution notes for the hook contract), and docs/metrics.md in full first. Phase 2 is
CLOSED: the S5 hook contract (`{ …data, loading, error, refetch }`, documented in
agents/FRONTEND.md) and the S6 AuthProvider/AuthGuard pattern are the load-bearing
prerequisites — build on them, do not fork them. Start by fetching origin and branching from
the origin/master tip; run `git log origin/master..origin/<branch>` for the previous session
branches first (stranded-commit check — it has caught real strands before).

Scope (ADOPTION.md is authoritative where this summary and it disagree):

1. **Token swap + typography**: new tokens in `tailwind.config.ts` per the `T` object in
   cadence-v2.jsx (navy `#0C1443`, teal `#3B8272`, tealTint `#EAF3F0`, coral `#C4553A`,
   amber `#E9930F`, bg/card/line/gray/grayLight); amend CLAUDE.md's token table in the SAME
   commit. Coral is the one attention accent (framed "discuss", never "alarm"); true red
   stays system-errors-only. Self-host Montserrat / Inter / IBM Plex Mono — no Google Fonts
   @import, no icon webfonts (lucide-react only). Old hr-green/hr-navy retire with the reskin.
2. **Trend engine (supersedes ALL current trend code — closes refactor-plan D6)**: ONE
   definition everywhere — current value vs prior-period average, ±6% steady threshold,
   direction-aware, band metrics supported (`MetricSpec` gains optional `domain: [lo, hi]`
   and `band: [lo, hi]` — code-side only, no DB change; occupancy becomes a band metric,
   healthy 75–88%), sparse history (<4 points) = "new" state (trends unlock at week 4;
   new-hire copy: "keep this one about onboarding"). Applies to tiles/rows, rollup chips,
   and frozen last-week views alike. Pure, tested functions.
3. **Scorecard = 1:1 briefing pane primary + metrics as evidence panel** (the Cadence
   inversion): talking points ordered discuss → celebrate → notes with "start here" on the
   top one and a suggested opening question each; evidence panel grouped by source with
   honest sparklines (fixed `domain`, band shading), per-source `N wk` depth chip, and
   per-source degradation "‹Source› unreachable — showing last sync (‹when›)" driven by
   `synced_at` age + the S5 hook contract (no backend work). Roster strip replaces the
   dashboard table for person-picking (per-person tone dot + next-1:1 time; header counts
   are flag COUNTS — compliant; roster stays UNORDERED).
4. **Coaching engine — FLAGS-ONLY** (ADOPTION.md decision 3): talking points + question
   templates computed client-side from metric flags (discuss/celebrate/steady/new), no
   schema change. Context fields (workload/growth/ramping/personal) are a fast-follow AFTER
   Phase 3 — leave the context-blended template branches dormant. `coaching_prompt` from the
   DB still renders on the evidence panel. Every engine string passes the coaching-language
   check; required repairs from ADOPTION.md: "needs attention this week" → coaching-safe
   copy (e.g. "focus this week"), rename "one flag" (echoes "red flag").
5. **Map the evidence panel to the REAL registry** (ticket_volume, first_reply_time,
   csat_score, resolution_rate + assembled when live) — "Tickets solved / wk" does not
   exist; a true solved-count belongs to W4, don't build it. Actions map to existing
   `session_action_items`; notes stay on the existing session-notes system, week-grouped
   PRESENTATION only (no schema change). Drop all demo bits: mock SOURCES/fetch layer,
   outage toggle, hardcoded actions/context, role-switcher (real role from `profiles.role`
   via useAuth). Inline styles → Tailwind.
6. **Surfaces the prototype does not cover — design them in the same language**: senior
   rollup (rollup access = senior_manager|executive|admin via the existing AuthGuard),
   SharedScorecardPage (public; KEEPS per-tile synced timestamps), PDF export (keeps
   watermark + audit_log), admin metric config (is_active toggle + explicit save + the
   per-card save state landed in Phase 2), export log, login (skeleton, not spinner),
   S1 mobile navigation (<1024px — roster strip already scrolls; rollup/admin nav chrome
   needed), S10 404 page, S12 document titles + `aria-current` + route focus.
7. **Demo prep at the end**: run `docs/demo-smoke-checklist.md` against the Cadence UI;
   Adam's fresh sign-in (org-wide rollup + `/admin/*` redirect) is on it; the Normando
   Bonadia Jr decision is confirmed with Alex AT the demo — do not pre-implement.

Constraints: composite-score audit re-runs on every new surface (no composite, no rank, no
per-person overall number — flag counts and trend counts are the allowed aggregates); no DB
migrations expected (flags-only engine; if one becomes truly necessary: additive, ROLLBACK
block, applied by James in the SQL editor, docs/architecture.md updated); domain types stay
in packages/shared; component tests may re-add `@testing-library/react` (already on the
approved list — removed in Phase 2 as unused, re-add deliberately with the first component
test); no new runtime dependencies without stopping to ask; never import any `_ds_bundle`-style
prototype runtime.

Verification: typecheck all 3 workspaces + full suite (baseline 79 green, growing) + web lint
after every commit; production stays green at every commit — the reskin can land
surface-by-surface behind master merges as long as every intermediate state is coherent;
James browser-verifies each shipped surface after its deploy (Vercel auto-deploys master;
trust only `GET /health` → sha for the api, read GitHub status descriptions — watch-paths
skips post success without deploying; the stale `fulfilling-alignment - @scorecard/web`
check context is ignorable). Never push master — PR(s) with numbered steps; James's merge is
the authorization. End every session with the standard CLAUDE.md handoff + refactor-plan/
release-plan status updates; the demo happens only after full Cadence ships.
