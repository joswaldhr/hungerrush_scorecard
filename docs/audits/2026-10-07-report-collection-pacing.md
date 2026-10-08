# Report-event collection pacing correction

The initial collection-only production bootstrap retained 64,426 events over 65
pages before its second HTTP 429. Requests stopped; the source checkpoint, released
lease and cooldown were preserved. Zero solved values have been published, and the
solved catalog/release policy and new schedules remain inactive. Do not resume the
same pacing merely because its minimum Retry-After has elapsed.

The prior eleven-second cadence was below Zendesk's documented incremental export
ceiling, but it did not reserve enough observed headroom. Zendesk documents a shared
[incremental-export global limit](https://developer.zendesk.com/api-reference/introduction/rate-limits/)
and possible account-wide throttling. Other consumers or account pressure are
possible causes; retained responses do not identify the competing consumer or quota.

## Correction and scope

- Reserve at least twenty seconds between event requests, including handoffs.
- Honor bounded numeric account remaining/reset headers before another request,
  retaining two requests of headroom. Persist the deferral before committing a
  successful page so interrupted workers cannot skip a known cooldown.
- On HTTP 429, stop the batch and persist the longest of source Retry-After,
  observed quota reset delay and a one-minute minimum. No same-invocation retry.
- Return only allowlisted numeric quota diagnostics on the authenticated collector
  response. Never include raw headers, response bodies, credentials or source URLs.
- Permit the ordinary twenty-second wait inside the existing invocation budget;
  longer waits or insufficient remaining runtime return with the checkpoint intact.

This changes only report-event transport pacing, not metric definitions, source
selection, stored events, the bootstrap boundary, existing CSAT/first-reply readers,
Talk collection, Zendesk configuration or publication eligibility. No migration is
required. The frozen demo remains unchanged.

## Release and verification

Require PostgreSQL pacing/cooldown/handoff tests, numeric-only transport regression,
type/lint/full CI/build and the existing isolated synthetic complete-path rehearsal.
Then take a fresh encrypted backup with verified restore before releasing this code.
The compatible pre-correction production is `376aaaf` /
`dpl_7TAT6XQEpirG2YpeHG9rG6nMucN7`; its collector must remain unused at the old pace.
The same-code inactive-policy rollback is `dpl_5RiNfm8g4tPgkVxyG4X7aQ7hqYRL`.

Resume a single bounded bootstrap only after deployment verification and a read-only
check for source cooldown, active collection lease and other running syncs. Inspect
the first live response and saved continuation. Repeated throttling stops further
collection for diagnosis; it is not permission to drop records or advance the start.
Measure actual per-invocation throughput and daily delta capacity before installing
the proposed schedule. Slower pacing reduces invocation capacity; one daily slot is
not assumed sufficient. Source completion still precedes fresh joins, independent
reconciliation and the separately controlled solved publication canary.
