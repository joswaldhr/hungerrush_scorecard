# REVIEW.md — HungerRush Cadence, four-track review

**Baseline:** master `959622f` (2026-07-07) · 154/154 tests green · builds green.
**Execution status (sprint 1, one PR at a time):** PR 1 `audit/admin-role-fix` → **MERGED `8f8228e` 2026-07-08** (0019 applied + verified; sweep executed: 279 → employee, audited, probe passed; serving sha confirmed). PR 2a `audit/sync-hardening` → **MERGED `a14c8ce` 2026-07-08** (serving sha confirmed). PR 2b `audit/toolchain-2026-07` → **MERGED `371b356` 2026-07-08** (npm audit 7 → **0**; serving sha confirmed; first post-deploy cron check pending at the next boundary). PR 3 `audit/ghost-reconciliation` → **MERGED `90f73c2` 2026-07-08** (0020 applied — first paste succeeded, the 42701 was a double-run; serving sha confirmed). PR 4 `audit/contrast-tokens` → **MERGED `f3b0d25` 2026-07-08** (James's visual pass owns the verdict per decision 1). **PR 5 `audit/qol-sprint1` (PR #16) → MERGED `d06fcda` 2026-07-08 — sprint 1 COMPLETE**: unsaved-note guard (NotesPanel dirty flag → confirm on person-switch via the ONE `selectPerson` path + `beforeunload` on tab close), optimistic action-item toggles (flip-first + rollback in `useScorecardNotes`, shared undo copy on both checkbox surfaces), keyboard basics (`/` focuses roster search, `←/→` person nav through `selectPerson` so the guard applies, `Esc` clears — one window listener, inert while typing/with modifiers), freshness chips (`SyncFreshnessChip` + `useDataFreshness`: global header chip on every screen, rollup subtitle chip from the fetched rows' max `synced_at`, amber past the 9h bound). Gate passed: typecheck ×3 / lint / build green; tests 162 → **181** (55 api / 94 web / 32 shared) incl. dirty-guard, beforeunload, and optimistic-rollback paths; npm audit still 0. **Pending checks:** ~~first node-cron-v4 production cron~~ **VERIFIED 2026-07-08 session 31** — `sync_run` audit row stamped 18:06:48Z (408s, 250 employees, 545 metrics, 0 errors; a second clean manual run at 16:47Z); Supabase session survival after AD-disable (IT, open question 2). **Out-of-band (post-sprint-1):** `audit/external-review-fixes` (PR #17) → **MERGED `f4583df` 2026-07-08** (/health sha verified serving it) — Antigravity second-opinion changeset adopted after repair (race guards incl. `useEmployee`, fail-closed paginations). **`audit/command-palette` (PR #18) → MERGED `8d4affe` 2026-07-09** — the wave-2 palette rebuilt in-house, zero new deps; restyle dropped per James. Details under "Discovered during execution"; NEITHER is a sprint-2 item.
**Method:** full code read + live-DB read-only queries + computed WCAG ratios. The app was **not** driven locally in this pass — it sits behind Microsoft SSO; visual findings are code-derived plus today's production screenshots (rollup, briefing, admin), tagged accordingly. Dispositioned items from `docs/refactor-plan.md` (L*/S*/D*) are referenced, not re-litigated.

---

## Track 0 — Security triage

### 0.1 npm audit (7 vulns → 1 real runtime consideration, 6 dev-toolchain)

| Package | Sev | Reachable in this app? | Fix |
|---|---|---|---|
| vitest <3.2.6 (GHSA-5xrq) | Critical | **No in prod, negligible in dev** — vuln is the `vitest --ui` server; this repo never runs it (plain `vitest run`), devDependency only, never in a deployed artifact | Bump to vitest 4 in one toolchain PR; until then accept-with-reason |
| vite ≤6.4.x (3 advisories: path traversal, `fs.deny` bypass on Windows, launch-editor NTLM) | High | **Dev server only** — Vercel serves static build output. Real-but-small local risk: James dev-serves on Windows; a hostile page could probe `localhost:5173` | Bump to vite 8 (MAJOR, with `@vitejs/plugin-react` + `vite-plugin-pwa@1.3`) |
| esbuild ≤0.24.2 (dev-server request relay) | Moderate | Dev server only | Rides the vite 8 bump |
| vite-node / vite-plugin-pwa | Moderate | Dev/build chain only | Rides vitest 4 / pwa 1.3 bumps |
| **node-cron ≤3.x via uuid <11.1.1** (buffer bounds, v3/v5/v6 with `buf`) | Moderate | **Production runtime dep** — but the vulnerable path needs a caller passing `buf` to uuid v3/v5/v6; node-cron's internal use doesn't. Practical reachability ~nil | Bump node-cron 4.6 (MAJOR — re-verify the three schedules in `apps/api/src/index.ts:45-81` fire once after deploy) |

**Verdict [VERIFIED]:** nothing here is exploitable in the deployed app today. Do ONE coordinated toolchain PR (vite 8 + vitest 4 + vite-plugin-pwa 1.3 + node-cron 4), gate on build + 154 tests + a PWA install check + one cron cycle. Sev: Med · Effort: hours. → **SHIPPED in PR 2b** — `npm audit`: **0 vulnerabilities** after the bumps; recharts (unused) removed; all gates in the PR body.

### 0.2 Admin-classification blast radius [VERIFIED] → **SHIPPED — PR 1 merged `8f8228e`, sweep executed + probed 2026-07-08**

Traced end-to-end today (read-only queries against prod):

- `classifyRoles` (`apps/api/src/services/graphSync.ts:111-159`) puts every AD account with no resolvable manager in the "admins" bucket; pass 1–2 (`:209-276`) creates an **auth user + profile with `role='admin'`** for each. **280 such profiles exist**; ~10 are real `@hungerrush.com` humans. Only James is `is_active=true`.
- `is_active` protects **nothing on the caller side**: `visible_manager_ids()` (0017:30-60) reads `caller_role` from the profiles **table** and its admin branch never checks the *caller's* own is_active; the 0010 claims trigger syncs `role` → `app_metadata` unconditionally; the JWT-claims admin policies (0012 metric_definitions UPDATE, 0014 profiles SELECT/UPDATE, 0015 audit_log) check only the claim; the web reads the same claim (`AuthProvider.tsx:38`).
- **Blast radius if any of those ~10 humans signs in via SSO:** full org-wide read of every employee's metrics/sessions/notes, **UPDATE on any profile row** (i.e., can grant roles), metric-config UPDATE, audit-log read, full admin UI. Worse: a *new* manager-less human in AD gets minted `role='admin'` **with `is_active` defaulting to true** at the next org sync.
- Disabled-in-AD accounts: Graph fetch filters `accountEnabled eq true` (`graphSync.ts:66`) so they stop syncing, but an **existing Supabase session survives AD disable until its refresh token dies** — Supabase doesn't re-consult AD except at sign-in [SUSPECTED, standard Supabase behavior].

**Minimal fix (Sev: High · Effort: hours + one audited data sweep):**
1. `graphSync`: stop writing `role='admin'` from classification — admins bucket gets `role='employee'` (or profiles created `is_active=false`); keep `flaggedAdmins` reporting. Admin stays audited-write-only, exactly like `executive` (0017 precedent).
2. 0010 trigger: only stamp the role claim when `is_active = true`; strip it otherwise (claims then self-heal on the sweep below). Avoids touching the profiles-policy recursion history (0004–0006).
3. One-time audited sweep: 279 profiles `role admin → employee` (James excluded), with backup + `audit_log` rows — same protocol as the 10b correction.
4. Verify with a claims probe (pattern exists: `scripts/rls-probe-executive.sql`).

### 0.3 Share links + audit endpoint

- **Token entropy [VERIFIED]:** `token uuid default gen_random_uuid()` (0001:93) = 122 random bits; unguessable, and the global rate limit (100 req/15min/IP, `index.ts:28`) makes enumeration moot.
- **Expiry [VERIFIED]:** 72h enforced server-side (`share.ts:28-33`, 410). First use recorded, **every** access audit-logged with IP (`share.ts:44-54`). Good.
- **What a leaked link exposes [VERIFIED]:** employee name + email + **entire snapshot history, all metrics, all weeks** (`share.ts:81-85`) — not just the current week — until expiry. Acceptable-by-design for a 72h employee-facing link, but worth stating in the pilot guide.
- **No revocation** [VERIFIED]: no endpoint or UI deletes a live token; a mis-sent link stays hot ≤72h. Sev: Low · Effort: hours (creator-scoped delete + a "links I've shared" list — also a Track 2 item).
- **Audit POST is auth-only, not scope-checked** (`audit.ts:18-40`): any authenticated account can insert `pdf_export` rows for any employee_id — integrity pollution only (writes, no reads). Sev: Low · Effort: <1h (validate employee visibility, or accept + note). → **SHIPPED in PR 2a** (employees SELECT under the caller's JWT — the RLS policy *is* `visible_employee_ids()`; 403 otherwise).

---

## Track 1 — Look & feel punch lists

> Charts are hand-rolled SVG (`CadenceSparkline.tsx`) — **recharts has zero imports left** [VERIFIED]; the templated-chart risk doesn't exist, but the dead dependency does (see 1.6). Skeletons are consistent (`animate-pulse` everywhere, no spinners) [VERIFIED]; empty states all carry message + action [VERIFIED — components tested for it].

### Global (do these first — they touch every screen)
1. **[VERIFIED] Tertiary text fails contrast badly: `hr-gray-light` #9EA2BC on white = 2.52:1** (AA needs 4.5). It's used as *text* in ~30 places at 10–11px (trend sublines, synced stamps, "N wk" chips, field labels). Fix: keep the token for dots/decoration, add a `hr-gray-mid` ≈ #71779C-range (≥4.5) for tertiary *text*, sweep the text usages. Sev: High (a11y) · Effort: hours. → **SHIPPED in PR 4** (`hr-gray-mid` #687090 — 4.87 white / 4.55 bg; 35 text usages swept; gray-light is decoration-only).
2. **[VERIFIED] Tint-pair text is marginally under AA:** coral-on-coral-tint 4.02, teal-on-teal-tint 4.02, coral-on-white 4.46. The amber pair already solved this with `hr-amber-deep` (5.42 ✓) — add `hr-teal-deep`/`hr-coral-deep` for text-on-tint (chips, save-state buttons, talking-point kind labels) and keep the base hues for fills/borders. Sev: Med · Effort: hours. → **SHIPPED in PR 4** (`hr-teal-deep` #2E6653 5.91/6.68; `hr-coral-deep` #A8442C 5.36/5.95; rule recorded in CLAUDE.md: colored body text = deep/mid, base hues = fills/dots/strokes/large stats).
3. **[VERIFIED] No type scale — 13px and 13.5px both exist as body sizes**, all sizes are arbitrary (`text-[13px]`, `text-[13.5px]`, `text-[11px]`…). Collapse to one tokenized scale (11/12.5/13.5/15 + display) in `tailwind.config.ts` and sweep. Sev: Low · Effort: hours (mechanical). → **SHIPPED in PR 4** (xs 11 / sm 12.5 / base 13.5 / lg 15, shadowing Tailwind's core steps; 114 arbitrary values + 12 core `text-sm` swept; zero sub-16px arbitraries remain).
4. **Motion is minimal-but-consistent** (hover lifts, color transitions); the one gap: **no transition when switching people** — the briefing hard-swaps content. A 100–150ms fade on `Briefing` mount would make roster flipping feel intentional. Sev: Low · Effort: <1h.

### Briefing (`Briefing.tsx`, `TalkingPoints.tsx`, `EvidencePanel.tsx`, `MetricRow.tsx`)
5. Hierarchy is right — talking points lead, evidence supports, the header stat pair reads instantly [VERIFIED against today's screenshot]. The chrome is not competing.
6. **Action-item toggles are not optimistic** (`useScorecardNotes.ts:109-130` awaits the write before updating state) — on hotel wifi the checkbox lags. Flip local state first, roll back on error (WarnBanner already exists for the failure copy). Sev: Med · Effort: <1h. → **SHIPPED in PR 5** (flip-first + rollback in the hook; both checkbox surfaces show the shared undo copy).
7. **`Export PDF` / `Share` buttons show state but never toast** — status text swaps in-button (good) but reverts after 3s with no persistent confirmation; fine, but the share fallback URL (clipboard denied) renders as a bare string — style it as a copyable input. Sev: Low · Effort: <1h.
8. Evidence rows: the `↑ 12.5%`-style subline colors by tone [VERIFIED] — after fix #2 these pass contrast. Sparkline end-dot + segment-break-on-missing-week is genuinely better than templated charts; keep.

### NotesPanel (`NotesPanel.tsx`)
9. **Unsaved-note data loss:** switching person (roster click) or navigating remounts the panel and silently discards a half-typed note (`useState` only). This is the single worst UX defect in the app. Guard: dirty-state check + confirm on roster switch, `beforeunload` for tab close. Sev: **High** · Effort: hours. (Also Track 2 #1.) → **SHIPPED in PR 5** (roster switch + tab close, exactly as scoped; sidebar/SPA-route navigation is NOT guarded — recorded under "Discovered during execution").
10. Native `<input type="date">` renders browser chrome that clashes with the token system [SUSPECTED — platform-dependent]. Low priority; consider only if it bothers you on demo hardware.
11. Week-group headers ("WEEK OF JUN 29") use the label style at 10px `hr-gray-light` — same contrast fix as #1 covers them.

### Rollup (`RollupPage.tsx`, `RollupCard.tsx`)
12. **No freshness signal anywhere on the page** — cards show counts derived from snapshots but never say when data last synced (the briefing has per-source stamps; the rollup has only the week label). Add the same `synced X ago` chip to the subtitle (max `synced_at` is already in the fetched rows' reach). Sev: Med · Effort: hours. (Track 3 overlap.) → **SHIPPED in PR 5** (subtitle chip from the fetched rows + the QoL-8 global header chip).
13. With 77 managers the page is one long unsectioned scroll [VERIFIED — today's screenshot]. Post-demo: a sticky filter/search input (same pattern as the roster search) for admin/executive-scale viewers. Sev: Low · Effort: hours.

### Public share view (`SharedScorecardPage.tsx`)
14. Solid: brand shell, framing copy, per-row stamps, error cards with actions [VERIFIED]. One gap: **no favicon/theme distinction from the app** — fine — and no `noindex` meta; add `<meta name="robots" content="noindex">` for shared pages (they're unauthenticated URLs). Sev: Low · Effort: <1h.

### PDF export (`pdfExport.ts`)
15. Current output is clean but **typeset in Helvetica** — the one surface that leaves the brand fonts behind. jsPDF embeds TTFs; ship Montserrat (headings) + Inter (body) from the already-self-hosted files. Sev: Med · Effort: hours. → **SHIPPED in PR 19 (fast-follow)**
16. **No sparklines in the PDF** — each metric shows two windows + tone word but no shape. jsPDF lines can draw the same 8-slot polyline in ~30 lines of code, same honest domain. This is the difference between "looks like the product" and "looks like a printout." Sev: Med · Effort: hours. → **SHIPPED in PR 19 (fast-follow)**
17. Multi-page: watermark now on every page [VERIFIED, shipped this week]; add a page number (`2 of 3`) beside it. Sev: Low · Effort: <1h.

### PWA / offline
18. Offline is better than claimed-risk: Supabase reads have a NetworkFirst 24h cache (`vite.config.ts:24-34`), so a manager who opened the app recently sees data offline, and `OfflineBanner` says so [VERIFIED]. Gap: the **Railway API isn't cached** — a shared-link page fails offline (acceptable; public page).
19. Install: manifest has name/icons/theme (`vite.config.ts:10-21`); **no maskable icon variant** — Android install renders the icon in a white circle [SUSPECTED]. Add a `purpose: 'maskable'` 512 icon. Sev: Low · Effort: <1h (needs an asset). → **Scaffolded in PR 4** (commented manifest entry + note; blocked on the design asset per decision 4).

---

## Track 2 — Top QoL gaps (prep → 1:1 → follow-up → next week)

| # | Item | Why | Effort |
|---|---|---|---|
| 1 | **Unsaved-note protection** (dirty guard on person-switch + beforeunload) | Managers type during the 1:1; one stray roster click eats the note | hours · **SHIPPED PR 5** |
| 2 | **Optimistic action-item toggles** | The most-clicked control in the meeting should feel instant | <1h · **SHIPPED PR 5** |
| 3 | **Keyboard basics:** `/` focuses roster search, `←/→` moves between roster people, `Esc` clears search | Prep speed; the "under a minute" bar | hours · **SHIPPED PR 5** |
| 4 | **"Covered" check on talking points** (ephemeral per visit; optionally append "Discussed: …" lines to the session note on save) | During-the-1:1 tracking; keeps the conversation moving | hours |
| 5 | **One-click "insert briefing summary into note"** (talking points → note textarea as bullet lines) | Kills the retype-what-we-discussed step | hours |
| 6 | **Share-link management:** list my active links + revoke (creator-scoped delete) | Closes the Track 0 revocation gap with UX, not just an endpoint | hours |
| 7 | **Roster ordering toggle: "longest since last 1:1 first"** | Logistics ordering (not performance rank — stays compliant); the data (`lastSessionDate`) is already on the chip | hours |
| 8 | **Global freshness chip in the app header** ("data synced 2h ago", amber past the 9h bound) | One glance answers "can I trust this right now" on every screen incl. rollup | hours · **SHIPPED PR 5** |
| 9 | **Print stylesheet for the briefing** (`@media print`: hide nav/roster, keep briefing + evidence) | Managers print for 1:1s; today they'd print the whole chrome | hours |
| 10 | **Weekly action-item digest email** (open items per manager, Monday morning) | Follow-up loop; **blocked on `RESEND_API_KEY`** (the logged email-nudge item) | days · blocked |

Not proposed: week-over-week diff (evidence rows already show both windows), carry-forward of open items (already surfaced for 12 weeks — `ActionItemsList`), per-manager metric selection (deliberately deferred to post-W3/W4 — discussed and recorded separately). Nothing above is blocked by the Assembled/Forethought stubs.

---

## Track 3 — Data correctness & freshness

1. **Ghost employees [VERIFIED — 3 live cases].** `graphSync` pass 4 (`graphSync.ts:291-331`) inserts/updates by email and **never reconciles absences**; `bootstrapAgentIds` clears agent IDs for deactivated Zendesk agents but employees rows live forever. Mechanism: additive migration `0020` `employees.is_active boolean not null default true`; after pass 4, flip `is_active=false` for employee-emails absent from the current Graph member set (never delete — snapshots FK + history rule); `useRoster`/`useManagerRollup` exclude or badge them ("no longer synced"). Keep the audited-delete protocol for true duplicates only. Sev: High (trust) · Effort: hours + migration. → **SHIPPED in PR 3** (pass 5 + circuit breaker + badges; rollup tone counts exclude frozen histories). **Note:** the 3 known ghosts flip live only when their duplicate AD accounts are actually disabled — that Entra work is currently backburnered, so the live demonstration waits on IT; the mechanism is unit-tested (breaker, both flip directions, case-insensitivity).
2. **Staleness visibility — mostly solved, one hole.** Briefing: per-source synced chip + amber "showing last sync" banner past 9h (`evidence.ts:26`, bound documented against the cron gap at `index.ts:59-60`) [VERIFIED]. Shared page: per-row stamps [VERIFIED]. **Rollup: nothing** — see Track 1 #12/QoL #8. Sev: Med. → **CLOSED by PR 5** (rollup subtitle chip + global header chip).
3. **Sync failure handling [VERIFIED]:** crons are in-process (`index.ts:45-81`), failures are caught and **die in Railway logs** — no persistence, no alert. Idempotency is real (upsert on `employee_id,metric_key,period_start`, `syncService.ts:373-379`); restart mid-sync self-heals at the next 4h run; **no overlap guard** — a manual `/api/sync/run` during a cron double-fetches and interleaves two `synced_at` stamps (breaks the documented DB-side verification heuristic). Fixes: module-level `syncRunning` skip-with-log (<1h); write one `sync_run` summary row (mode, written, errors, duration) to `audit_log` per run so failures are queryable and an admin surface can show "last sync: failed" (hours). Retries: none per-employee — acceptable at current volume; the next run re-covers. → **SHIPPED in PR 2a** (guard + 409 on the manual route + `sync_run`/`sync_run_failed` audit rows; a skip is not a run and writes no row).
4. **Metric definitions vs implementation — 4 spot-checks:** `ticket_volume` (updated-in-period), `first_reply_time` (created-in-period, business minutes, L11 exclusions), `csat_score` (ratings *submitted* in period, org-fetch in `prepareRun`) all match `docs/metrics.md` exactly [VERIFIED — table in metrics.md §"Which tickets count" is accurate]. **Drift found:** `occupancy` — the catalog row says `higher_is_better` with no mention that the spec band (75–88, `metricSpec.ts`) overrides direction; and metrics.md §"Direction indicators" still cites **retired tokens** (`hr-green`, `amber-500`). Docs-only fix. Sev: Low · Effort: <1h. Week boundaries: one UTC-Monday util everywhere (L2 closed); rollup/notes format in UTC explicitly [VERIFIED].
5. **Route-level tests worth having (3):** (a) `GET /api/share/:token` — valid → 200 shape exposes *only* name/email/snapshots, expired → 410, unknown → 404; (b) sync auth middleware — no `SYNC_TRIGGER_KEY` env → 403 even with no header (the fail-closed guarantee, `sync.ts:12-19`), wrong key → 403, right key → 202; (c) `POST /api/audit/export` — no bearer → 401, missing employee_id → 400. Supertest is already on the approved list; mock `lib/supabaseAdmin` via `vi.mock`. Effort: hours.
6. **scripts/ drift: none found [VERIFIED-lightly].** All table/column references (`metric_snapshots`, `profiles.role/is_active`, `audit_log`, `employees`) exist in current schema; `rls-probe-executive.sql` targets the 0017 function shape. Standing risk remains (outside workspace typecheck) — unchanged, documented.

---

## Suggested first sprint (~1 week, sequenced)

| Day | Work | Track |
|---|---|---|
| 1 | **Security PR:** org-sync stops minting `admin` + 0010 trigger respects `is_active` + audited 279-profile resweep + claims probe | 0.2 |
| 2 | **Toolchain PR:** vite 8 / vitest 4 / vite-plugin-pwa 1.3 / node-cron 4 + drop unused `recharts` + sync overlap guard + per-run `sync_run` audit row | 0.1, 3.3 |
| 3 | **Ghost reconciliation:** migration 0019 `employees.is_active` + graphSync absence flip + roster/rollup badge | 3.1 |
| 4 | **Contrast + tokens PR:** `hr-gray-mid` text token sweep + teal/coral `-deep` tint-text tokens + 13/13.5 type-scale dedupe | 1.1–1.3 |
| 5 | **QoL quick wins:** unsaved-note guard, optimistic toggles, `/` + arrow-key roster nav, rollup/global freshness chip | 2.1–2.3, 2.8 |

Everything is one-PR-sized; days 1–3 are prerequisites for trusting the tool at wider rollout, days 4–5 are what managers feel. PDF fonts/sparklines (1.15–1.16) is the best *second*-sprint candidate.

## Open questions — decisions recorded 2026-07-07 (sprint kickoff)

1. Visual parity / PDF feel — **James eyeballs live**; PRs ship with before/after descriptions. CLOSED.
2. Supabase session survival after AD-disable — **OPEN, assigned to IT** (empirical check when the first duplicate account is disabled). Mitigation shipped in PR 1: claims stripped when `is_active=false`, propagating at next token refresh (≤1h). Follow-up lever if survival proves long: shorten JWT/refresh lifetimes in Supabase auth settings.
3. node-cron v4 — **hard gate on PR 2b**: three schedules verified firing once on a local/staging boot before merge; stop and show if the v4 API makes this non-trivial.
4. Maskable PWA icon — **approved, blocked on a design asset**; PR scaffolds the manifest entry with a clearly-marked placeholder note, no generated icon in production assets.
5. Audit-POST scope check — **do it** (PR 2a); reuse the 0017 visibility function, don't invent a new check.

## Discovered during execution

- **PR 1:** the pass-2 preserve-set lookup failed *open* — on a transient query error `executiveIds` stayed empty and the sync would have overwritten preserved roles (post-sweep: demoting the only admin). Fixed inside PR 1 (fail closed: no roles written that run) since it's the same lines the PR changes; noted here for the record.
- **PR 5 (residual):** the unsaved-note guard covers exactly its scope — roster person-switches (click and arrow key, both through `selectPerson`) and tab close (`beforeunload`). **SPA route navigation is not guarded**: clicking sidebar "Your team" (→ `/scorecard`, whose auto-pick lands on the *alphabetically first* person — a silent person-switch when the drafted person isn't first) or "Team rollup" still discards a draft with no prompt. Proper route blocking needs `useBlocker`, which requires migrating `BrowserRouter`/`Routes` to a data router (`createBrowserRouter`) — an App-shell change. **→ FIXED in PR 19 (sprint 2)**: migrated to data router and `useBlocker` covers all SPA navigations.
- **PR 5 (deliberate near-duplication):** on the rollup, the subtitle freshness chip (max `synced_at` of the fetched window rows) and the new global header chip (app-wide RLS-scoped max) will usually show the same value. Both were specified (1.12 + QoL 8) and they measure different things; if the double chip bothers the eye at James's pass, dropping the subtitle one is a two-line revert.
- **Post-sprint external review (Google Antigravity, 2026-07-08 — adopted after repair on `audit/external-review-fixes`):** James ran an independent second-opinion review whose agent left an uncommitted changeset. Two real finding classes adopted: (a) **stale-response races** in the per-person hooks — fixed with a fetch-generation guard in `useEmployeeMetrics`/`useScorecardNotes` and **extended to `useEmployee`**, which the changeset missed (same race, and it puts the wrong person's *name* on screen). `useRoster`/`useManagerRollup` share the pattern at lower stakes (page-scope keys, rarely switched mid-flight) — recorded here, not fixed; (b) **latent pagination caps** — graphSync `listUsers` (>1,000 auth users) and the sync's employees reads (>1,000 rows, the L7 class), both paginated, `listUsers` made FAIL-CLOSED (a partial auth map would let pass 1 re-create existing auth users). Repairs required before adoption: 9 `no-explicit-any` lint errors (the changeset's "all green" claim had skipped lint), two more api-side `any`s, the fail-open partial map, and refetch wrappers that bypassed the new guard while churning identity every render. The claimed package-lock/jsdom "fix" was a no-op (line-ending noise; jsdom already an approved devDependency) — discarded.
- **Antigravity wave 2 (same session): Cmd+K command palette + broad restyle — palette REBUILT in-house (`audit/command-palette`), the rest rejected.** The agent's second pass added three unapproved dependencies (`clsx`, `framer-motion`, `tailwind-merge` — rule 8; all replaceable by existing idioms) and rewrote `tailwind.config.ts`/`index.css`/10 components over the PR-4 token lockdown, then withdrew everything into Antigravity's own UI on "finish" — it never reached git. Disposition (James, 2026-07-08): rebuild the palette to house rules, drop the restyle. The rebuild: zero deps, Cadence tokens, S1-drawer overlay idiom, combobox/listbox a11y, lazy roster fetch (query runs on first open, not every page), role-gated pages via the sidebar's gates, Ctrl/Cmd+K + a header trigger. **Note:** palette person-jumps are SPA route nav — they bypass the unsaved-note confirm exactly like sidebar clicks (see the PR-5 residual above); the data-router/`useBlocker` migration closes all of these at once (**→ CLOSED in PR 19**).
