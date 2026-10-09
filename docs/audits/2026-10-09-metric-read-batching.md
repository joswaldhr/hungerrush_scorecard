# Metric read batching candidate — October 9, 2026

This focused read-path change combines the selected and comparison weeks into one
metric-value query, retaining each exact start/end pair. Independently partitioning
the returned values preserves callers that request the same period for both columns.
Closed-week reviews omit the target query because the existing historical-context
policy already withholds those targets. Current-week target resolution is unchanged.

For a nonempty metric assignment set, closed-week reads use six SQL statements instead
of eight, with peak parallel demand reduced from five to three. Current-week reads use
seven statements with peak demand four. Authorization checks, effective dates,
visibility, metric values, provenance compatibility and target eligibility are unchanged.
No database migration, cache, pool configuration, driver setting, vendor request or
publication behavior changes. Candidate branch automatic deployment is disabled.

The installed Drizzle postgres-js adapter uses `client.unsafe(query, params)`, whose
installed postgres.js 3.4.9 implementation defaults to unnamed, unprepared execution.
Parameterized reads perform a describe exchange before execution even on warm sockets.
The driver also opens another closed connection before attempting busy-connection
pipelining, and fetches array type metadata during each connection's startup. Reducing
query fan-out may avoid additional connection startup. This is a code-supported
hypothesis, not a measured hosted latency improvement; no driver defaults are changed.

Regression coverage observes executed SQL at the existing driver's logger, verifies
one metric-value query and the target-query boundary, and exercises mixed employees,
zero versus missing comparisons, identical periods and rejected mismatched date pairs.
Existing query and authorization tests cover provenance, visibility and access boundaries.
Release still requires exact CI, isolated Preview checks and production smoke tests.

Local validation: 78 tests pass across the real PostgreSQL metric queries,
authorization, admin scope and authenticated scorecard-week route suites. Tests used
only the explicit loopback `cadence_test` database; no shared environment file was
loaded. TypeScript, scoped ESLint, formatting and whitespace checks also pass.
Hosted performance has not been measured for this candidate.
