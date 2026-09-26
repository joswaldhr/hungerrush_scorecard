# Resumable Talk collector and outbound candidate

September 26, 00:40 UTC / September 25 Central. Branch implementation only; no new
production route, environment policy, cron, source collection or metric publication.
Zendesk report/dashboard editors remain closed. This increment used retained private
source data and synthetic local database tests; it issued no new Zendesk requests.

## Implemented

- Outbound participation uses linked-ticket groups, explicit Central reporting dates,
  numeric agent/supervisor legs and distinct employee-call IDs. Repeated legs retain
  their duration contributions. Null and zero remain separate; unresolved outcomes
  withhold affected counts. Missing employee-leg parent calls reject the result.
- The account-observed completed/zero-talk mapping matches the retained Menufy reports
  across two weeks. This does not universally redefine API completion or prove a human
  customer answered. The POS exact employee-call report comparison remains unobserved.
- Calls retain ticket linkage, whole-call talk and voicemail evidence needed by that
  classification. Source schemas discard unrelated payload fields.
- Separately namespaced call/leg records, immutable source-version evidence and resume
  checkpoints commit in one transaction. Compare-and-swap checks reject stale responses;
  conflicting same-version evidence rejects the entire page. A malformed persisted
  checkpoint is rejected rather than silently treated as a completed stream.
- Account-wide leases cover duplicate source configurations using database time and
  transaction locks. Stale cleanup cannot release a successor. Request reservations and
  Retry-After survive handoff, including to a different source bound to the same account.
- Calls and legs alternate within a bounded worker. Reads use an account/endpoint/query
  allowlist, explicit GET, rejected redirects, request timeout and invocation budget.
  Database lock/statement timeouts bound contention. Calls, legs and metrics have separate
  completeness states: exhausted exports do not certify a joined employee population.

## Validation

Thirty focused checks pass: nine real PostgreSQL storage tests, ten cursor tests,
seven outbound tests and four transport/worker tests. The storage tests include a real
PostgreSQL constraint failure on the final checkpoint update after page/revision writes:
all writes roll back, the old checkpoint survives, and the page can be retried.
Other cases cover concurrent claims/responses, account changes, foreign organizations,
expired owners, retained corrections, invalid continuations and persistent rate delays.

Retained Menufy replay after adding the missing-parent rejection still matches **44
employee-period cases / 220 comparisons / zero differences**. Earlier independent Python
reconstruction establishes 2,896 employee-call rows / 11,584 compared fields with no
missing/extra rows or value differences. Evidence is aggregate-only; raw source, identities
and downloads remain private. Full candidate CI/build is required before any production merge.

## Remaining activation gates

The worker is not connected to an HTTP route, cron or publisher. It does not replace the
legacy Talk fetcher. Coordinate or eliminate overlap with that fetcher before activation;
the new account lease cannot rate-limit unrelated existing integrations automatically.
Retained ticket-group scope observations are qualification inputs, not yet a durable
outbound ticket-metadata collector. Join/freshness gating, qualified policies, targets,
publication ownership and hosted synthetic rehearsals remain implementation work.

All five parents missing from the earlier current-week read are present in the newer
retained call census; their update timestamps are after the earlier read. This is new
observation evidence, not an atomic source snapshot or current-week certification.

Production verification remains 4/40 assigned metrics. Human ticket counts stay unavailable;
ticket-action shadow ingestion/action-v2 publication and historical repair remain disabled.
Follow [the safety plan](../SAFETY_GUARDRAILS.md) for backup, scoped release and rollback.
