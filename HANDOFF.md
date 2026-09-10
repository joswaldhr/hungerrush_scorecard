# Session Handoff — 2026-09-09/10

## TL;DR

The scorecard's sync pipeline had gone silently dead for 5 days (no code was broken — a required
Vercel secret was simply never set). Fixing it surfaced two more real problems underneath, each
found and fixed in turn by **verifying with real production data at every step**, not by reading
code and assuming. All fixes are **committed and pushed to `master`** and live in production.
One real, known gap remains (see "What's still open" below) — not silently left, explicitly
flagged with numbers.

Read in this order if you're picking this up fresh:
1. This file (status + what's next)
2. `FOLLOWUPS.md` — the punch list, most current info per item
3. `FIX_LOG.md` — what was actually changed and how each change was verified
4. `INVESTIGATION.md` — the original deep-dive that started all of this (still accurate for the
   parts it covers; superseded by `FIX_LOG.md`/`FOLLOWUPS.md` for the sync-timeout chapters)
5. `CLAUDE.md` — has a short incident summary and durable lessons folded into the project's
   standing instructions (Definition of Done, known facts about the sync system)

## What happened, in order

1. **Silent outage**: no sync (cron or manual) had run in 5 days. Root cause:
   `CRON_SECRET` was never added to Vercel's environment variables at all — the cron route
   returned a silent 500 every single day, invisible anywhere. **Fixed**: added it, added
   logging so this specific failure can never be silent again, added a staleness banner and an
   optional heartbeat-ping hook.
2. **Found while fixing #1**: the Zendesk HTTP client had no request timeout — a stalled
   connection could hang a sync forever. **Fixed**: added a 30s timeout.
3. **Verifying #1 revealed a second problem**: triggering the real cron endpoint after the fix
   returned `HTTP 504 FUNCTION_INVOCATION_TIMEOUT` at exactly 300 seconds — the real, previously
   unknown Vercel function duration limit. A full sync took ~14 minutes, ~50 minutes before that
   in the pipeline's original unbatched form.
4. **Root cause of the slowness**: three functions wrote one database row at a time,
   sequentially (up to ~8,000 individual queries in a full sync). **Fixed**: batched all three
   into chunked bulk upserts — DB write time dropped from 247.8s to 2.2s (~114x), verified
   against real production data.
5. **Batching alone wasn't enough**: with writes now instant, the remaining ~14 minutes is
   almost entirely the Zendesk API fetch phase (hundreds of sequential requests across 4 weeks
   of data), which batching never touched — still ~3x over the 300s limit.
6. **Fixed by splitting**: the sync now runs as 4 separate cron invocations per day (staggered
   15 min apart), each fetching exactly one week instead of all 4 in one shot. The manual
   "Sync Now" button was equally exposed to the same limit and now defaults to the current week
   only. **Verified live**: Vercel accepted all 4 cron entries, and triggering the current-week
   leg directly completed successfully in 282 seconds.

## What's still open (see `FOLLOWUPS.md` for full detail on each)

**Highest priority — thin safety margin on the current-week leg.** That 282-second result
above means only ~18 seconds of margin under the 300s cap, with the fetch phase alone eating
86% of the budget. Any added load (Zendesk rate-limiting, growing data volume, roster discovery
taking longer) could push it back over. Recommended next step: split the current week's Talk
calls fetch out from its ticket search into its own invocation — that's the specific piece
known to be heaviest (up to 50 sequential pages, since Zendesk's call-export API never signals
"done" for an in-progress week).

**Not yet verified — weeks 1-3 of the split.** Only the current-week leg was triggered and
timed this session; the other three legs share a rate-limit cooldown that made back-to-back
manual testing impractical in one sitting. They're expected to be faster (completed weeks
terminate their call-data fetch quickly) but that's not proven with real numbers yet. Check
`sync_runs.metadata_json` after tomorrow's actual scheduled runs (6:00/6:15/6:30/6:45 UTC), or
trigger `?week=1`/`?week=2`/`?week=3` manually at least 5 minutes apart.

**Two Menufy roster candidates still pending** (Claire Boonmanop, Daniel Coy) — real Zendesk
agents not on Barbara Maenza's original list, worth confirming with her directly rather than
auto-approving. Unrelated to the sync work, predates this session.

**Needs a human, not a code fix**: whether the real HungerRush Zendesk account is single- or
multi-brand (the connector assumes single-subdomain) — confirm with Zendesk admin access.
`csat_score` returning zero results from Zendesk's satisfaction-ratings endpoint — worth a
fresh check now that syncs run reliably again, separate investigation.

## Access notes

A Vercel personal access token was added to `.env` as `VERCEL_API` to enable direct
investigation/verification against the real Vercel project (cron config, deployment status,
environment variables) — this is how the 300s limit and the cron registration were confirmed
with certainty instead of guessed. It's still in `.env` (gitignored, never committed). Revoke
or rotate it from vercel.com/account/tokens if you'd rather not leave it active.

## Repo state

Everything in this handoff is committed and pushed to `master` — `git log` will show the
commits in the order described above. No uncommitted changes as of this handoff.
