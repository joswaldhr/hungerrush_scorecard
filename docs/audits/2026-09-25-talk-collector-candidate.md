# Resumable Talk collector and outbound candidate

**Latest validation — September 26, 01:38 UTC:** code candidate `20f0495` passes CI
36208942784/36208944848 with 749 tests / 99 files, PostgreSQL migrations, typecheck,
lint, build and Preview. The initial new-test formatting failure is fixed. The full
source-connection/publication candidate is committed; activation gates remain below.
This continuation made no Zendesk account requests or edits and no production changes.

September 26, 00:40 UTC / September 25 Central. Branch implementation only; no new
production route, environment policy, cron, source collection or metric publication.
Zendesk report/dashboard editors remain closed. This increment used retained private
source data and synthetic local database tests; it issued no new Zendesk requests.

00:47 UTC follow-up: candidate `602ed29` passed CI runs 36205774133 and 36205776797:
706 tests / 91 files, PostgreSQL 18 migrations, typecheck, lint and production build.
Its Vercel Preview deployment completed. A subsequent snapshot-reader increment is
under validation; the prior green result does not certify that newer candidate.

00:56 UTC follow-up: `6f1f5e7` passed both CI runs 36206208071/36206210445 and Preview.
The final observation-policy increment adds rejection of stale, widely separated,
future, incomplete or out-of-bootstrap employee observations. Freshness/span limits must
be explicit; no production default or schedule was enabled. The final full-CI result is
tracked on PR32 and in the implementation ledger.

## Implemented

- An inactive dedicated outbound connector validates database source/account/organization,
  selected team assignments, native units/aggregation and active external identities before
  requests. It reads a consistent durable call/leg snapshot, resolves staff IDs once and
  shares one complete linked-ticket census across employees. Incomplete stores reject
  before vendor access; freshness is rechecked after reads. No route or configuration
  consumes this connector. Support transport declares GET explicitly.
- A strict inactive policy separates inbound routing-group/line scope from outbound
  current-linked-ticket scope. It requires explicit team keys, a Sunday cutover,
  account/source/organization binding and bounded observation limits; no environment
  variable or route consumes it yet.
- The outbound record builder validates the full joined observation, then retains only
  this employee's necessary call/leg/ticket replay fields. It strips unused line/routing
  fields. Normalization recomputes values from raw evidence, verifies employee/team and
  interval, preserves seconds/denominators, and emits only policy-selected keys.
- Dedicated outbound snapshot facts explicitly supersede matching legacy `agent_stats`
  contributions. They keep prior raw facts and values as revisions, resist later legacy
  refreshes, and propagate null corrections. Source descriptions distinguish employee
  legs, distinct calls, current ticket groups and unclassified outcomes. Comparisons and
  targets retain the existing changed-contract safeguards.
- An inactive outbound ticket reader collects the exact call-created cohort's linked
  ticket IDs in batches of at most 100. Missing, duplicate or foreign returned tickets
  reject the collection; null group/link values remain explicit. Only ID, group and
  update time are retained. Five synthetic tests and typecheck pass. No live reads were
  needed. This reader is not yet connected to durable publication evidence.
- Outbound observation preparation binds metadata to the exact call-population digest,
  rechecks ticket IDs/counts, and enforces account, date/timezone, joined observation age
  and span. Both observation paths reject a reporting period not yet observed and source
  updates newer than the corresponding read. Zero and missing durations remain distinct;
  independent qualification and atomic vendor snapshots are never inferred.
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
- A repeatable-read, read-only database snapshot returns no population while either
  stream is pending, validates stored record IDs and digests, retains missing-parent
  identities for qualification, and rejects over-capacity stores instead of truncating
  their rows. It explicitly does not certify vendor snapshot atomicity or metric coverage.

## Validation

Candidate `4b7a4e8` passed both CI runs 36208475191/36208478329: **741 tests / 97 files**,
migrations, typecheck, lint, production build and Preview. The next connector increment
passes ten affected checks, including four PostgreSQL preflight cases and failures before
vendor access, plus typecheck and targeted lint. Its full CI remains separate.

Candidate `2b2e8b5` passed both full CI runs 36207684917/36207687477 and Preview.
The subsequent policy/publication increment has 23 targeted unit checks and all 20 real
PostgreSQL publication tests passing. The new database case checks exact 2/3-second
precision, null retraction, idempotency, retained revisions, unchanged unrelated values
and earlier periods, protection against later legacy overwrite, and rollback on team
change. A test-only generic inference error was corrected; typecheck passes. Full CI
for this newer increment is still required.

Fifty focused checks pass: eleven real PostgreSQL storage tests, ten cursor tests,
seven outbound tests, four transport/worker tests, seven observation-policy tests, six
outbound joined-observation tests and five
linked-ticket reader tests. Candidate `fedf71c` passed CI 36206690857 with 713 tests / 92
files, migrations, typecheck, lint and build, plus Preview. That result predates the 13
new linked-ticket/joined-observation checks. All 18 affected tests, typecheck and targeted
lint pass; full CI for the new increment follows. The storage tests include a real
PostgreSQL constraint failure on the final checkpoint update after page/revision writes:
all writes roll back, the old checkpoint survives, and the page can be retried.
Other cases cover concurrent claims/responses, account changes, foreign organizations,
expired owners, retained corrections, invalid continuations and persistent rate delays.

Retained Menufy replay after adding the missing-parent rejection still matches **44
employee-period cases / 220 comparisons / zero differences**. Earlier independent Python
reconstruction establishes 2,896 employee-call rows / 11,584 compared fields with no
missing/extra rows or value differences. Evidence is aggregate-only; raw source, identities
and downloads remain private. Full candidate CI/build is required before any production merge.

The POS candidate also matches an independent Python reconstruction of retained raw
calls, ticket groups and legs: **72 employee-period cases / 1,296 fields / zero differences**
across two closed weeks, including exact employee-call/leg sets and duration denominators.
This source reconstruction complements the independently observed 14 daily report totals;
it does not claim an employee-level Explore export was obtained. See
`2026-09-25-pos-outbound-candidate-replay.json`.

A separate local capacity rehearsal committed 5,000 synthetic calls and 10,000 legs in
17 pages, including 1,000-record pages. It recovered the exact 15,000-record snapshot with
zero missing parents. Page writes took 169–579 ms; total storage/read rehearsal was 4.429 s.
This excludes vendor/network latency and does not predict hosted performance. It issued
zero Zendesk requests and zero hosted writes; its isolated test rows were removed afterward.
See `2026-09-25-talk-store-capacity-rehearsal.json`.

## Remaining activation gates

The worker is not connected to an HTTP route, cron or live publisher. It does not replace the
legacy Talk fetcher. Coordinate or eliminate overlap with that fetcher before activation;
the new account lease cannot rate-limit unrelated existing integrations automatically.
Retained ticket-group scope observations and the new inactive ticket reader are not yet
live outbound publication evidence. Joined observation gates, prospective policy and
outbound publication ownership are now implemented on the branch, along with database
assignment/identity preflight and the dedicated source-to-publisher connection.
Source-wide collection coordination, target qualification and hosted synthetic rehearsals
remain open. A live route/policy must not activate the new worker until overlap with the
legacy Talk reader is eliminated or controlled by a shared source/request lease. Preserve
each path's last good observation if a run is busy, partial or rate-limited.

All five parents missing from the earlier current-week read are present in the newer
retained call census; their update timestamps are after the earlier read. This is new
observation evidence, not an atomic source snapshot or current-week certification.

Production verification remains 4/40 assigned metrics. Human ticket counts stay unavailable;
ticket-action shadow ingestion/action-v2 publication and historical repair remain disabled.
Follow [the safety plan](../SAFETY_GUARDRAILS.md) for backup, scoped release and rollback.
