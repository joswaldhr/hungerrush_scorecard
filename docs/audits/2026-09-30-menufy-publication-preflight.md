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
source-context and eligibility tests pass. Candidate `bcb40b67b0ac35e9bfe8061cef5e8c1542de1c0a`
passes [CI 36775503153](https://github.com/joswaldhr/hungerrush_scorecard/actions/runs/36775503153):
842 tests in 109 files, isolated PostgreSQL migrations, all 22 atomic-publication
tests and four new inbound-binding tests, full lint/typecheck, eight separate
read-only diagnostic guard tests and production build. Run `36775252426` stopped
at test-file formatting; a formatting-only correction resolved that failure.

Static inspection confirms source descriptions, reporting timezones and missing
reasons already travel through the shared metric rows into data details and CSV
exports. No new inbound presentation is activated or hosted export inspected by
this increment; contract-specific display/availability work remains part of the
future publisher integration.

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
