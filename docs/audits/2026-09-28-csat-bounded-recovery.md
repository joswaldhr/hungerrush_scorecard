# Bounded CSAT rate-limit recovery

## Defect and scope

The September 28 current-week CSAT execution failed on HTTP 429 after about 24 seconds.
A later controlled read/publication completed with independently matching values. The
old error predates endpoint/Retry-After instrumentation, so the specific competing
request or vendor limit is not known. Do not claim that its root cause is proven.

The transport currently fails on every 429, even when the vendor provides a short
safe retry delay and most of the invocation budget remains. This candidate adds one
explicit retry allowance for the dedicated CSAT connector only. Other callers of the
shared reader keep zero retries by default. No schedule, source policy, metric formula,
historical value, employee assignment or target is changed.

## Bounds and failure behavior

- At most one retry across the entire collection, not one per ticket, page or endpoint.
- Only an allowlisted same-account GET is repeated; redirects remain prohibited.
- A valid numeric or HTTP-date Retry-After is required. Never shorten vendor delay.
- Wait at most 60 seconds and retain normal request pacing. Reserve a full 30-second
  request timeout inside the original 240-second collection budget, leaving the existing
  publication margin within the 300-second function.
- Count retries against the original request budget; track retries and wait milliseconds
  in bounded diagnostics. Recheck the deadline after sleeping, including event-loop delays.
- Missing, malformed, excessive or expired delay, a repeated 429, exhausted budget,
  network error or another HTTP status still fails. Existing atomic publication preserves
  the last good observation. No partial fetch is published and no response body/query
  identifiers are added to logs.

## Evidence and release state

Candidate `87eb70edfc1128750c0e8fde091429533ab7dbf4`, PR42. Thirty-five focused tests pass, including same-request
replay, collection-wide retry cap, HTTP dates, invalid/excessive headers, request/time
budgets, delayed wakeup, pacing and unchanged outbound defaults. All 818 tests / 106
files pass locally and in exact CI `36490181974`, together with typecheck, lint,
migrations and production build. No Zendesk requests or
production writes were made while implementing or testing this transport change.

The proposal mitigates recoverable transient failures; it does not guarantee vendor
availability, explain the original rate limit, or establish scheduler certification.
Observe an actual later scheduled run separately after a gated release. No extra sync
should be triggered merely to manufacture that evidence.

## Scoped rollout manifest

- Application-only deployment; no migration, source request, controlled sync, policy
  activation or direct database write is part of rollout. Existing CSAT schedules use
  the bounded retry on their next genuine execution. The change applies prospectively
  to collection transport, not to the metric's period or semantic definition.
- Current rollback: production `ed6b2df`, deployment
  `dpl_DBWaKeHfuutr8i3qeyAawQUCSUJ6`. Restore that compatible deployment on a regression;
  no database restore or policy change is needed for an application-only rollback.
- Fresh September 28 22:10 UTC encrypted backup successfully restores all 33 tables /
  63,633 rows with matching digests. Report:
  `2026-09-28-csat-retry-production-restore.json`. No schema changes are pending; the
  documented legacy 0009 journal omission and line-ending hashes remain unchanged.
- Pre-release read-only census: no running/stale workers and no duplicate scopes.
  Seven protected table digests and all 18 production variable entries are captured
  privately for post-release comparison. Existing production POS manager reads work.
- The UI, authorization and exporters do not change; their main-app upgrade remains
  separate in PR41 and gated on its own hosted synthetic checks. Adam's demo deployment,
  branch, authentication, fixtures and alias remain frozen.
- Require exact production deployment/SHA/alias, core authenticated read, unchanged
  protected rows/settings and master CI after merge. Keep scheduled recovery unverified
  until actual host invocation evidence exists. Do not trigger a sync to create evidence.

## Observed rollout and September 29 follow-up

PR42 merged September 28 at 22:11 UTC as `224176336c9b29c1c7e76c41213d5e52b3d74518`.
Production deployment `dpl_GnmLnC5NGNmMtTJ1nRpnAhqnnisj` is READY and owns the production
alias. Exact master CI `36490899861` passes. On September 29 `/api/health` returns
HTTP 200 / `status:ok`; the frozen demo alias still resolves to its original deployment.

Verification resumed after overnight source jobs. All 18 production variable entries
and six assignment/configuration table digests match the pre-release baseline. The
metric-values digest changed, so the original all-seven-unchanged assertion failed and
is not claimed as passed. The fresh read-only census observes six completed runs after
rollout, including current/prior-week 62-record publications at 08:34 and 10:19 UTC;
this establishes intervening publication, not an exact row-by-row attribution of every
change or host-scheduler verification. No extra sync was triggered. The prior browser
session ended, so a fresh post-release authenticated manager read remains unverified.
Retain those limits rather than converting the late comparison into a false clean result.
