# Follow-ups

Issues found while fixing the 2026-09-09 silent sync outage (see `INVESTIGATION.md` and
`FIX_LOG.md`) that are deliberately **not** fixed as part of that work — logged here per
CLAUDE.md's Definition of Done ("a fix that surfaces unrelated problems logs them here rather
than bundling unrelated fixes into the same change").

## 1. `csat_score` is broken (Zendesk data limitation, not a pipeline bug)

`src/lib/connectors/zendesk.ts:404-406`. Per the 2026-09-01 metric-integrity audit,
`/satisfaction_ratings.json` returned 0 results in every window tested against the real
account — classified as a Zendesk source/API limitation, not a connector bug. See
`INVESTIGATION.md` §6. Worth a fresh live check once the sync is confirmed healthy again, to
see if it's still returning zero results — but that's a separate investigation, not a fix to
bundle here.

## 2. Talk API fetch fragility — shared try/catch across all 4 weeks

`src/lib/connectors/sync-engine.ts:67-88` wraps the entire 4-week fetch loop in one try/catch.
A failure in any single week's fetch (especially week 0's Talk call fetch, which is
structurally the heaviest — see `INVESTIGATION.md` §4) aborts the whole run, discarding
already-fetched data for the other weeks. Confirmed NOT the cause of the 2026-09-09 incident
(§10 of `INVESTIGATION.md`), but it's a real, separate risk. Fixing it means restructuring the
fetch-then-publish contract to fail per-week rather than per-run — a medium-risk change to core
sync architecture, not a small patch. Scope as its own task.

## 3. Single-Zendesk-subdomain assumption — needs a human, not a code fix

`src/lib/connectors/zendesk-shared.ts:14-17`'s `baseUrl()` only supports one
`ZENDESK_SUBDOMAIN`. Whether the real HungerRush Zendesk account is single- or
multi-brand/subdomain is unconfirmed by any code or doc in this repo (`INVESTIGATION.md` §8).
**Action item for a human**: confirm with Zendesk admin access. If multi-brand, some
tickets/calls could be silently invisible to this connector regardless of any sync-scheduling
fix.

## 4. Whether Vercel is actually invoking `/api/cron/sync` on schedule — still open

Phase 0 of the fix work (see `FIX_LOG.md`) could not be fully resolved: this sandboxed
environment has no cached Vercel CLI authentication and network access to Vercel's own API
timed out, so `vercel crons`/`vercel env ls production` could not be run. **Needs a human with
Vercel dashboard access** to check: is the `0 6 * * *` cron for `/api/cron/sync` listed and
enabled under Project → Settings → Cron Jobs, and what do the Function Invocation Logs show for
that route over the last ~10 days (no invocations at all vs. 401/500 responses)? See
`INVESTIGATION.md` §12 items 1-3 for the exact questions.

## 5. Sync pipeline is slow — sequential, one-row-at-a-time writes inside long transactions

**Resolved as a real finding, not a mystery** (see `FIX_LOG.md` Phase 2 for the full story):
what looked like an indefinite hang during verification was actually two things stacking up —
(a) testing-methodology fallout (abandoned mid-transaction connections from killing the dev
server mid-sync, holding locks that blocked later attempts — not a production issue, a real
Vercel deployment doesn't get torn down mid-transaction like a locally-restarted dev server
does), and (b) genuine, reproducible slowness: `runSync()`'s publish phase and the separate
`computeMetricValuesFromFacts()` step each write one row at a time, sequentially, inside a
single long-lived transaction/loop, with no batching. A full run took ~32 minutes for `runSync`
(2,283 facts) plus ~17.6 minutes for `computeMetricValuesFromFacts` (5,515 values) — both
completed successfully with 0 errors, just slowly.

This isn't urgent (the pipeline works correctly, and daily-cron-frequency syncs have headroom),
but it's worth addressing before data volume grows further: batch the `normalized_facts` and
`metric_values` upserts (e.g. multi-row `INSERT ... VALUES (...), (...), ...` or `unnest()`-based
bulk upserts) instead of one query per fact/value. Medium effort, low risk (same
insert-or-update semantics, just batched) — a good candidate for its own focused task rather
than bundling into a "fix the sync gap" change.
