# Menufy inbound publication preflight — September 30

This increment adds enforced containment and an inactive assignment preflight for
the reconciled inbound candidate. It does not activate a publisher or certify a
manager scorecard.

## Implemented

- The normal sync transaction rejects `inbound_report_candidate` records and the
  `zendesk-inbound-report-v1` contract, including a forged eligibility marker.
- Explicit false or malformed publication eligibility rejects normalization and
  metric aggregation. Aggregation checks retained contributors as well as new
  facts. Existing qualified CSAT, first-reply and outbound contracts are unchanged.
- The inactive preflight reads source, team, effective definitions/assignments and
  active employee identities in one read-only repeatable-read transaction. It
  checks account and organization binding, prospective Sunday cutover, exact
  team-wide assignments, unique user identities and metric semantics.
- Proposed assignment semantics are counts in calls/SUM, answer percentage in
  percent/LATEST (a precomputed complete employee-period ratio), total talk in
  seconds/SUM and maximum hold in seconds/MAX. No definitions, assignments or
  targets are created or edited by the helper.
- PostgreSQL regression tests exercise attempted candidate publication, ineligible
  normalized facts, retained ineligible contributors and scope/configuration
  failures. Rejected publication must retain previous source records, facts,
  values, revisions and successful checkpoint; failed-run diagnostics remain.

## Validation and boundaries

Local validation: typecheck, scoped ESLint and 23 calculator, source-description,
source-context and eligibility tests pass. Full CI with isolated PostgreSQL and
the production build is required on the committed candidate; result will be
recorded in the implementation ledger.

The preflight has no route, environment flag, scheduler or source-fetch caller.
It is not an authorization token: future publication must revalidate bindings
inside its write transaction. Current primary-team membership cannot establish
historical eligibility. Source GETs and production/demo writes were not performed.

Remaining work includes the actual qualified publisher and replacement rules,
transaction-time binding checks, further period/coverage reconciliation, proposed
metric assignment review, hosted scorecard/export checks, recovery rehearsal and
prospective canary verification. Raw SUM/MAX must never be inserted into existing
AVG fields. No successful candidate publication is claimed by these rejection
tests. Historical repair and unverified human ticket metrics remain disabled.
