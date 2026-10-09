# Scorecard query batching candidate

Following PR65, two authenticated production week reads still took 3,514/3,590 ms
(reported function durations 3,400/3,612 ms). The earlier representative SQL execution
was 0.257 ms and database round trip roughly 110 ms. Queue cancellation improved
navigation correctness but did not establish acceptable backend latency.

## Small, scoped changes

- Manager context now reads organization-scoped assigned teams and effective team
  memberships in one left join. Membership dates stay in the join condition so an
  empty team remains assigned. Employee IDs still pass through the existing separate
  organization check; individual assignments never grant the whole team.
- Metric assignments load alongside the existing organization/employee guards, with
  an explicit organization-scoped team join. Metric values, definitions, targets and
  visibility reads begin only after those guards succeed. Period and qualification
  logic is unchanged.
- Authenticated week responses include four allowlisted `Server-Timing` durations:
  `auth`, `context`, `employee`, `metrics`. Values are finite milliseconds, clamped
  to 0–30,000 and rounded to one decimal. No identity, payload, SQL, error detail or
  dynamic label enters the header. Unauthenticated responses omit it. Private,
  no-store behavior remains unchanged; no server cache or pool settings are added.
  Authenticated reads with a measured phase sum of at least 1,000 ms emit one
  `Slow scorecard week read` info entry containing only those numeric timings and
  HTTP status. Fast and unauthenticated reads emit no timing log. This enables
  request-log diagnostics when the browser cannot expose response headers.

The ordinary team-assigned manager path removes one SQL statement and two sequential
database phases (approximately nine to seven phases; administrator view-as eleven to
nine). At 110 ms per round trip, this suggests roughly 220 ms structural savings,
not a measured speedup or a solution to all of the observed 3.5-second latency.
Header measurements will isolate the next bottleneck before larger changes.

## Validation and release limits

59 focused tests pass across authorization, account-read recovery, metric queries and
the week endpoint. Typecheck, scoped ESLint, modified-source formatting and diff checks pass. PostgreSQL checks use the explicit isolated loopback test database.
Added regressions preserve empty teams, inclusive membership starts, exclusive ends,
future-membership exclusion and organization boundaries for direct employee grants.
Existing tests retain same-organization administrator view-as, metric scope, historical
targets, source compatibility, visibility and effective metric assignments.

The follow-up logging extension passes all 14 endpoint tests, including mocked-clock
slow/fast/unauthenticated/error cases; these tests perform no database access.

The candidate still requires exact full CI/build, synthetic hosted verification and
post-release measurements. Automatic deployment of this candidate branch is disabled.
No vendor calls, production database changes, demo changes or metric policy changes
were made during this implementation.
