# October 1 sync recovery candidate

## Observed failures

Production's legacy Talk week-offset-3 fetch stopped after 212,380 ms without publishing.
The previous collector loses validated pages on timeout and starts from the reporting-week
boundary again. Because Talk exports are modified-since, older weeks require traversing
later updates too; stopping at the first call created outside the week is invalid.

The current-week CSAT run stopped on HTTP 429 at `tickets/show_many` with a nine-second
Retry-After. Production already allows one collection-wide bounded retry. Its old error
metadata cannot identify whether that allowance had been consumed. Do not claim a proven
root cause from that message alone.

## Completed read-only CSAT diagnosis

At 16:11–16:13 UTC, one controlled GET-only current-week collection used the retained
production policy and fresh database employee bindings. Database access enforced read-only
transactions and checked for active syncs first. It issued 80 GETs (four staff, 38 search,
38 detail), completed in 125,150 ms and used no retries. All 85 independently reconstructed
metric cases matched, across 62 employee records. Account rate-limit headers reported a
700-request allowance, with observed remaining capacity no lower than 568. No source or
metric writes occurred. This proves this observation's calculation agreement, not recovery
of the failed scheduled run or absence of contention at its earlier execution time.

The diagnostics candidate `0a1ffd9` passed full CI `36889256825`. It retains bounded request,
time, retry and stop-reason fields on future failed fetches, without private URLs or payloads.

## Legacy Talk implementation

- Separate versioned legacy storage preserves only identity/timestamps, first-agent,
  direction/status and the four existing duration inputs. Nulls and measured zeros survive.
  Customer phone numbers, ticket text and unrelated vendor fields are discarded.
- Account lease and pacing remain shared with participation collection. Each page commits
  call versions and the cursor together, with lease checks and checkpoint compare-and-swap.
- Failed/incomplete jobs withhold publication. Subsequent jobs resume saved work; completed
  cycles refresh from a five-minute overlap and retain corrections and predecessor versions.
- UTC Sunday–Saturday creation-date filtering and whole-call attribution remain unchanged.
  The participation source schema, policies, targets and metric meanings remain unchanged.
- Readout requires a freshly exhausted cycle; per-week population is capped at 250,000.
  These namespaces are not a new facts publisher or permission for historical repair.

PostgreSQL regression coverage includes fresh-process resume, partial withholding, overlap
refresh, null correction, predecessor retention, stale owner/CAS rejection, foreign URLs,
conflicting versions, transaction rollback, cross-week isolation and stale observations.

## Remaining release gates

Final code candidate `8210d7a8fbc6919708cd829223bde39865c103fe` passes full CI
`36892381643`, including all tests, PostgreSQL migrations, lint/typecheck and build.
Main Preview `dpl_8zmnehw9E3NLehvxorprpwj6Erxx` is Ready on that SHA; its synthetic
publication and isolation gates pass. Seven PostgreSQL recovery tests include a full
1,000-call page (500 measured zeros, 500 missing talk measurements). Anonymous inbound
requests return 401; export requests redirect to sign-in. This does not verify signed-in
browser behavior or actual file delivery. Production and the demo aliases are unchanged.

The legacy resume path has an explicit `ZENDESK_LEGACY_TALK_RESUME=1` opt-in. It is unset
on production and synthetic main Preview. Clearing it preserves saved evidence and restores
the previous collector. Candidate `e94afa1` passed full CI `36891453194` before this opt-in
and the subsequent CSAT pacing change. An offline replay preserves all ten consumed fields
across 25,694 retained calls and matches 507 agent/direction groups across three reporting
intervals. This is field/input preservation, not new report-semantic certification.

CSAT now uses valid account quota headers to spread remaining requests and wait for reset
before making another request. The two-request reserve and one-second reset margin are local
conservative choices, not a guaranteed account allocation. It honors the longer of account
reset and Retry-After, preserves the collection-wide single-retry limit, and stops when waiting
would consume the reserved request time. It records only numeric quota fields and wait time.
Malformed headers do not become trusted quota evidence. A known empty quota with no usable
reset stops collection. Thirty-six focused reader/retry/diagnostic tests pass. The prior live
diagnosis did not reproduce 429; neither this change nor those tests certify scheduled recovery.
Header semantics follow [Zendesk's rate-limit documentation](https://developer.zendesk.com/api-reference/introduction/rate-limits/).

Full exact-candidate CI, hosted sign-in and actual export-file inspection, fresh encrypted
backup/restore, bounded source replay against retained evidence, scoped production deployment
and genuine scheduled evidence remain required. The first long bootstrap may need more than
one invocation; unfinished work is not reported as successful sync. Legacy checkpoint retention
and storage growth must be reviewed before activating persistent collection in production.
No schedules, production settings, demo deployment or Zendesk objects changed in this increment.
