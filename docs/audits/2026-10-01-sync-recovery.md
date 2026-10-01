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

Full exact-candidate CI, hosted sign-in and actual export-file inspection, fresh encrypted
backup/restore, bounded source replay against retained evidence, scoped production deployment
and genuine scheduled evidence remain required. The first long bootstrap may need more than
one invocation; unfinished work is not reported as successful sync. Legacy checkpoint retention
and storage growth must be reviewed before activating persistent collection in production.
No schedules, production settings, demo deployment or Zendesk objects changed in this increment.
