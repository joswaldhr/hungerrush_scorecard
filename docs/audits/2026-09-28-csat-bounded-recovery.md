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

Local candidate, not deployed. Thirty-five focused tests pass, including same-request
replay, collection-wide retry cap, HTTP dates, invalid/excessive headers, request/time
budgets, delayed wakeup, pacing and unchanged outbound defaults. Full exact CI/build
and the production recovery/release gates remain required. No Zendesk requests or
production writes were made while implementing or testing this transport change.

The proposal mitigates recoverable transient failures; it does not guarantee vendor
availability, explain the original rate limit, or establish scheduler certification.
Observe an actual later scheduled run separately after a gated release. No extra sync
should be triggered merely to manufacture that evidence.
