# Demo smoke checklist — small release to Alex / Barb / Mike / Adam

> Written in W2 (2026-07-06); **step wording re-checked against the shipped Cadence UI
> at Phase 3 session 2 (2026-07-07)**. Execute on release day, on the Cadence UI —
> the demo is sequenced AFTER the Phase 3 implementation (docs/release-plan.md
> sequencing table; docs/design/hungerrush-cadence/ADOPTION.md).
> James drives, with each account holder present (or screen-sharing) for their pass.

## The four accounts

| Person | Role | Expected scope (verified 2026-07-06) |
|---|---|---|
| Alexander Smith | `senior_manager` | 3 manager teams: Edge 12/12 matched, Moon 14/14, Courcy 14/12 — live data. 1 direct employee (Normando Bonadia Jr) invisible under senior RLS — see the decision item below |
| Barbara Maenza | `senior_manager` | 3 manager teams: Murray 6/6, Maynard 8/8, Crawford 9/9 — live data |
| Mike Pacilio | `manager` | 3 employees; 1 shows "No data" (James himself — correct, no Zendesk agent match) |
| Adam Seow | `executive` (W2) | Org-wide: every active manager's team (87 active manager-role profiles / 351 employees at W2 time). NO admin pages |

## Preconditions (James, before anyone logs in)

- [ ] `GET /health` on the API returns the sha of the release master tip (the only trustworthy deploy check)
- [ ] All migrations through the release are applied in the SQL editor (0017 executive + 0018 title included)
- [ ] Adam's role is `executive` in `profiles` AND he has signed in fresh since the change (JWT claims update only at sign-in / token refresh)
- [ ] `employees.title` is populated (the org sync `POST /api/sync/org` run in the W2 post-merge steps backfills it — the daily 05:00 cron does not)
- [ ] Metric data is fresh: last cron stamp within 4h (check Railway logs `[cron]`, or a current-window-only stamp count — historical `synced_at` window-counting is invalid)
- [ ] A test share link created earlier than 72h ago is confirmed EXPIRED (share-expiry behaves)

## Per-account passes

### 1. Mike Pacilio (`manager`)
- [ ] Microsoft SSO login lands on "Your team" (roster strip + briefing) — no admin or rollup nav visible
- [ ] Roster default "With data" shows his 2 synced people; the "All (3)" pill reveals James's chip reading **"no data yet"**; selecting James shows the briefing's no-data state (message + suggested action, not blank)
- [ ] Pick a synced person: briefing shows talking points ("start here" + opening question) → open action items → notes; evidence panel groups by source with sparklines, BOTH labeled windows (this wk · last wk), coaching prompts, and a per-source `N wk` + synced chip; header shows name + **title** + email
- [ ] Notes: create a 1:1 session note + one action item → reload → both persist; action item toggles (also appears under "Action items" in the briefing)
- [ ] Share link: create for one employee → open in a private window (no login) → SharedScorecardPage renders evidence rows with **per-row synced timestamps**
- [ ] PDF export: downloads with the navy Cadence header, both windows per metric, tone words (Improving / To discuss / Steady), and the exported-by watermark; export appears in the admin export log (James verifies after the pass)

### 2. Alexander Smith (`senior_manager`)
- [ ] Login lands on his view; rollup nav IS visible; admin nav is NOT
- [ ] Rollup shows exactly his 3 manager cards — per-metric chips in Cadence words (N improving / N to discuss / steady / new) + the wins / to-discuss stat pair (counts, never scores/ranks)
- [ ] Drill into one manager team → roster scoped to that FULL team (banner + back link) → open one briefing
- [ ] Notes + share + PDF each work on a drilled-into employee (same checks as Mike's pass)
- [ ] **Decision item — confirm with Alex (carried from W2, do NOT pre-implement):** his direct employee **Normando Bonadia Jr** is invisible to him under one-level-down senior RLS. Choose: (a) reassign Normando's `employees.manager_id` to one of Alex's managers (one audited update), or (b) accept invisibility. Record the choice in the release plan either way

### 3. Barbara Maenza (`senior_manager`)
- [ ] Same pass as Alex (3 cards: Murray / Maynard / Crawford); one drill-down, one scorecard, one note
- [ ] Confirm her view contains NO people outside her 3 teams (senior scope is one level down, not org-wide)

### 4. Adam Seow (`executive`)
- [ ] Login (fresh sign-in) lands with rollup nav visible; **no admin section in the nav**
- [ ] Rollup is **org-wide**: every active manager with employees appears — not just Alex/Barb/Mike
- [ ] Drill into a team OUTSIDE his direct line (e.g. one of Barb's managers) → scorecard opens with full data
- [ ] Direct URL to `/admin/metrics` and `/admin/exports` → redirected away (role gate holds)
- [ ] Sanity: he sees data only — confirm he has no metric-config toggles anywhere

### 5. James (admin, closing pass)
- [ ] Export log lists the PDF exports made during the demo, attributed correctly
- [ ] Audit log shows the share-link uses from the passes above
- [ ] Metric config page loads and a toggle save round-trips (S4 stays fixed)

## If something fails

Fix-forward only if it is cosmetic; anything touching data or access control stops the
demo — note it, continue with the unaffected passes, and file it for a fresh session.
Never live-edit RLS or roles during the demo.
