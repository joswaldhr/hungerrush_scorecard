# Solved-ticket CSAT candidate

This candidate implements the meaning independently reconciled with both teams' reports.
It is not connected to production publication. The existing ticket-human-attribution
policy, shadow ingestion, action-v2 publication and historical-repair switches stay intact.

## Definition

- Period: Sunday through Saturday, interpreted in `America/Chicago` for this account.
- Cohort: tickets whose latest source `solved_at` falls in the selected local dates.
  Attribution uses the current ticket assignee at observation time. This is not the
  person who authored a reply, performed a solve, or received the rating historically.
- Scope: explicit numeric group IDs per team. POS also requires its inspected brand.
  Deleted selected groups remain in scope. Report names and current roster group
  membership are not substitutes for these IDs.
- CSAT score: good / (good + bad), multiplied by 100. No ratings means unavailable.
- CSAT response: (good + bad) / (offered + good + bad), multiplied by 100. An offer
  without a response produces a real zero; no offered or rated tickets means unavailable.
  "Offered" is the vendor's survey state, not independent email-delivery confirmation.
- Preserve source IDs and raw numerator/denominator values. Round only for presentation.
  No per-employee average-of-percentages may replace combined numerator/denominator math.

## Collection and safeguards

`zendesk-solved-csat.ts` is a candidate collector/calculator separate from the independently
implemented reference. It queries all satisfaction states for explicit numeric employee
identities in the solved-date population,
avoiding the commented-rating search omissions. Search dates are padded by one day on
each side; the final local solved-date filter determines inclusion. Repeated group/brand
properties use Zendesk's documented OR semantics within each property.

Cursor exhaustion, unique ticket IDs and one metric set for every returned ticket are
required. Invalid shapes, unknown rating values, missing brand evidence for a brand-scoped
calculation, incomplete pagination, failed requests and exhausted budgets fail the candidate.
The default request ceiling is 150 for search and metric requests together. Source snapshots
record the beginning and end of collection; sequential reads are not an atomic vendor snapshot.
An initial group-only live attempt exhausted the 100-page search ceiling before producing
a snapshot. The corrected candidate requires explicit employee IDs and rejects query scopes
that exceed the vendor search-term limit. It does not raise the ceiling to crawl unrelated
group activity. A separate initial child-process attempt exited unsuccessfully without a
retained diagnostic result; it is not counted as successful collection evidence.

The live qualification wrapper permits only the configured account's search-export and
ticket-show-many GET endpoints, rejects redirects, spaces requests, stops on HTTP failure,
and has both request and elapsed-time ceilings. It does not run an application sync.

## Release gates still required

1. Replay this candidate against the independent ticket sets and validate live collection,
   including a repeated observation that explains any late source changes.
2. Bind private numeric scopes to the correct source account and team. Fail visibly for
   missing bindings or ambiguous employee identities. Keep staging synthetic and isolated.
3. Integrate the source evidence, explicit missing values and metric version through the
   atomic publisher, screen, historical context and exports. Retain predecessor revisions.
4. Review existing percentage thresholds against the changed date/attribution contract.
   Avoid rating old and new contract values as if their definitions were interchangeable.
5. Pass integration/CI and hosted synthetic checks, then use a fresh production backup,
   restore rehearsal and documented rollback before activation. A passing diagnostic
   does not activate historical repair or make the other metric families complete.

Reference: [Zendesk Support search reference](https://support.zendesk.com/hc/en-us/articles/4408886879258-Zendesk-Support-search-reference).

## Source context and precision increment

The candidate publication infrastructure now retains an explicit source contract and
reporting timezone from normalized facts into metric provenance. Mixed contracts or
timezones roll back the entire publication. This CSAT contract requires exactly one
complete employee-period snapshot; it cannot average multiple percentage summaries.
Current/history/revision views and CSV/text/captured exports retain the observation's
context. Comparisons across incompatible definitions are unavailable, and targets for
an explicit replacement definition are withheld until a contract-specific target policy
is qualified. This increment does not approve existing targets or enable the collector.

A real PostgreSQL test exposed single-precision loss in both normalized facts and
metric values. Migration 0015 widens only those two numeric columns to double precision.
New solved-CSAT values skip the legacy two-decimal storage rounding; raw numerator and
denominator evidence still belongs in the candidate adapter. Double precision follows
JavaScript number precision; it is not arbitrary-precision decimal arithmetic.

The isolated loopback database migrated 0014 -> 0015; its two metric tables were empty.
The populated regression separately runs the actual SQL against transaction-local tables
with null, zero, fractional, large and negative fixtures, checking exact preservation of
their preexisting stored values and precision of newly written fractions. Neither check
substitutes for a fresh production backup and restore rehearsal. The production schema
has not been changed. Widening cannot reconstruct precision lost in historical values.

For deployment, use the established fresh backup/restore gate and bounded lock/statement
timeouts. Stop overlapping publications before the table rewrite. Application rollback
can retain the widened compatible columns; do not narrow them and discard new precision.
Any restored backup must account for intervening writes. Candidate adapter, account/team
scope binding, effective-period cutover, scheduler runtime budget, hosted checks and
production verification remain open.
