# Talk participation correction — qualification checkpoint

September 25, 23:52 UTC amendment: the [safety guardrail plan](../SAFETY_GUARDRAILS.md)
prohibits Zendesk writes and report/dashboard editor sessions. Source discovery below
must now use retained evidence and bounded GET APIs. Newer outbound qualification and
local durable-collector work are recorded in the implementation ledger; the 22:00
checkpoint below remains dated evidence, not current implementation status. No call
producer/publication policy has been activated.

September 25, 22:00 UTC. Candidate code only; no call policy, scheduled collector,
production publication, target change or historical repair has been activated.
Production verification remains **4/40 assignments**, from CSAT and first reply.

## Evidence established

The candidate calculator independently matches the retained reference implementations
for **111 employee-period cases / 997 comparisons / zero differences**: 56 Menufy
row-weeks across September 6–12 and 13–19, and 55 POS rows for September 13–19.
Those reference populations were separately compared with report exports, including
exact source-leg IDs. This replay adds implementation parity, not a new source census.
See `2026-09-25-talk-candidate-parity.json`.

A current-week read used 32 GETs, spaced 6.3 seconds apart, in 195.790 seconds:
8,029 calls and 16,026 legs. Calls were read before legs; the streams were not an
atomic snapshot. Initially 25 legs lacked a parent. A bounded seven-request call
overlap added 42 calls and reduced the gap to six legs / five parents. Two affected
agent legs belong to two active POS employees. The other four are external legs.
Do not infer that the parents are deleted, ongoing or excluded by the business scope.
A documented single-call lookup returned 404 for both a missing parent and a known
control, so that API does not establish the status of these legacy export IDs.
See `2026-09-25-talk-current-runtime.json` and `2026-09-25-talk-current-join.json`.

The candidate computes 60 of 62 active employees and rejects the remaining two for
incomplete parent coverage. A separate Python implementation compares **4,982 fields
with zero differences**, including the two unavailable outcomes. This does not
independently certify the current source population. No rows were silently dropped,
and the unavailable outcomes are not reported as successful numeric metrics.
See `2026-09-25-talk-current-candidate-parity.json`.

## Explicit candidate definitions

- Numeric leg agent identifies participation; the call's first-answering agent does
  not receive everyone else's time. Repeated employee legs remain separate, while
  participating call IDs are distinct. Supervisor legs are visible separately.
- Preserve the inspected report's date basis explicitly: Menufy call creation;
  POS leg creation; both in America/Chicago, Sunday–Saturday. These populations
  cannot silently share a contract fingerprint or prior-week comparison.
- Parent call group is final routing scope, not historical employee membership.
  Scope requires explicit numeric groups and an explicit line restriction or null.
  Four unresolved historical POS group labels remain a scope limitation.
- Accepted means an agent leg marked completed with positive reported talk time.
  Missed and declined (including transfer-declined) are separate source categories.
  The inspected report's offered subtotal is accepted + missed + declined; it
  excludes unreachable and other zero-talk completed legs. It must not be labeled
  as every routing offer without a further definition change.
- Duration means use selected agent/supervisor legs except unreachable. Retain
  numerator seconds and a separate measured denominator for each field. Include
  reported zeros; exclude null without substituting zero. The consultation mean is
  therefore among recorded consultation durations, not every participating leg.
  Display H:MM:SS and sample coverage; preserve full precision internally.
- Menufy SUM talk and MAX hold are not averages. POS whole-call hold repeated per
  leg is not employee leg hold. Neither defective comparison is copied into the
  candidate employee mean.
- Abandonment is distinct-call participation in a final on-hold outcome, not
  employee responsibility. Queue/IVR/voicemail abandonment is a different measure.
- Outbound completed call status, positive-talk legs and failed calls remain
  separate evidence. No customer-answer or non-answered classification is inferred.

## Collection design and release gates

Fetching every older reporting week from its beginning repeatedly will exceed the
300-second host limit at the Talk API's ten-request/minute limit. A resumable
incremental collector is required, rather than adding these calls to the existing
ticket, CSAT or first-reply requests.

`zendesk-talk-cursor.ts` implements a pure, serializable one-page transition. It
retains minimal call/leg fields, revisions and a cursor; rejects conflicting source
versions, unexpected continuation origins/resources, regressing watermarks and
cursor cycles; and distinguishes export exhaustion from complete joined coverage.
The persistent adapter is still required. It must atomically commit records,
revisions and cursor under an account-bound lease and compare-and-swap guard. A
timeout or retry must not advance an uncommitted page. Tests cover serialized resume,
corrections, rejection without mutation and unchanged terminal timestamps.

Next implementation and acceptance work, owned by this task:

1. Inspect both managers' outbound reports to resolve attempted/completed/non-answered
   labels and their exact date, group, line and agent filters.
2. Implement durable, separately namespaced call/leg collection with shared rate
   limiting, bounded invocation time, overlap reads, account binding, retained
   revisions and explicit bootstrap/continuation status. Do not enable the unrelated
   human-action shadow ingestion or action-v2 publication flags.
3. Qualify a source-observation policy for independently updated streams. Retain
   unmatched parents, expose unresolved joins, and recheck them after the source
   changes. An exhausted endpoint cannot alone authorize a complete employee value.
4. Bind corrected metric keys to explicit contract names, native units, denominators,
   source sets and freshness. Withhold incompatible targets and comparisons. Keep
   unchanged metric facts and historical observations intact.
5. Exercise real PostgreSQL rollback/concurrency and publication regressions,
   synthetic hosted current/history/revisions and actual CSV/PDF/PNG exports. Then
   use a fresh production restore rehearsal, scoped policy cutover, retained
   predecessor values, independently checked controlled publication and documented
   rollback. Genuine scheduler evidence must be observed separately.

Primary definitions: [Talk incremental exports](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/),
[Voice metric reference](https://support.zendesk.com/hc/en-us/articles/4409156145434-Metrics-and-attributes-for-Zendesk-Voice),
[agent acceptance report recipe](https://support.zendesk.com/hc/en-us/articles/4415791847450-Explore-recipe-Measuring-call-acceptance-data-for-agents).
No employee identifiers, vendor source IDs, line numbers or credentials are committed.
