# Menufy inbound report candidate

## Change and acceptance

The September 20–26 reconciliation establishes the manager report's four-component
offered count, answer ratio, total talk and maximum hold. The existing app has no
dedicated publication path for that exact report contract. Its average-duration keys
must not receive SUM/MAX values.

`zendesk-inbound-report.ts` implements a separately versioned, inactive calculation.
`zendesk-inbound-report-record.ts` builds minimized employee replay records and derives
normalized candidate facts from their raw evidence. Neither is registered with the live
connector, environment, scheduler, sync engine or metric catalog. There are no database
migrations or assignment changes. Existing inbound/outbound/CSAT/first-reply behavior
and the frozen demo are unchanged.

Acceptance for this increment is exact replay of the 26 named inbound report rows,
independent source-set agreement, conservative missing-data handling, and failure on
invalid source scope, chronology, identity, coverage or observation age. It is not a
production release or an alternate way around the publication gates.

## Candidate metric contract

All rows use Sunday–Saturday reporting keys, Central call-created dates, explicit call
groups/phone lines and the six observed leg statuses. The source groups by leg agent;
the four offered components additionally require Agent leg type. Transfer-declined legs
count as declined. Repeated offers on one call remain separate leg attempts.

| Candidate key | Meaning | Unit / no sample |
|---|---|---|
| `inbound_calls_offered` | Accepted + declined + missed + unreachable agent legs | Count; zero supported after complete observation |
| `inbound_calls_accepted` | Completed agent legs with positive talk time | Count |
| `declined_calls` | Declined and transfer-declined agent legs | Count |
| `missed_calls` | Missed agent legs | Count |
| `inbound_calls_unreachable` | Unreachable agent legs | Count; proposed additional key |
| `inbound_calls_answer_rate` | Accepted / offered × 100 | Percent; null for no offers; proposed additional key |
| `inbound_calls_abandoned_on_hold` | Distinct abandoned-on-hold calls with selected employee participation | Count; not responsibility attribution |
| `total_talk_time_inbound` | SUM of selected leg talk seconds | Seconds; proposed additional key; null for absent/incomplete measurements |
| `max_hold_time_inbound` | MAX of selected leg hold seconds | Seconds; proposed diagnostic key; null for absent/incomplete measurements |

The proposed extra keys are not automatically assigned to employees or added to the
main 1:1. Answer rate and total talk fill identified template gaps; unreachable/max hold
need deliberate product visibility decisions at integration. Outbound total talk is a
separate subsequent extension. None of these fields borrows an average's label or target.
Weekly percentage/max snapshots must not be combined by summing or averaging them as
if they were raw daily observations; integration must preserve the numerator/denominator
or selected period snapshot.

Completed agent legs with missing talk duration cannot establish whether they meet the
positive-talk accepted definition. The candidate withholds accepted/offered/answer rate
for that affected employee and preserves the uncertain leg IDs. Missing durations also
withhold SUM/MAX instead of treating a measured subset as a complete total/maximum.
Measured zero remains zero. This is intentionally more conservative than an Explore
aggregate that silently skips nulls; no such difference occurs in the retained 26 rows.

## Gates retained in code

- A strict policy requires an explicit source/account/organization/team, Sunday cutover,
  call-created date basis, four-component offered definition, group/line selections,
  supported unique metric keys and bounded observation limits. Averages are rejected.
- The builder checks source/team ownership and cutover, then reuses the full Talk
  account, exhausted-stream, bootstrap, chronology, freshness and observation-span checks.
- Missing employee parent calls, duplicate source IDs, invalid times/units/statuses and
  foreign minimized rows fail closed. Unnamed activity cannot be assigned to an employee.
- Raw employee calls/legs survive privately for replay; ticket IDs, unrelated employee
  rows and other unneeded call metadata are dropped. Normalization recomputes values,
  checks employee/team/period again and rejects injected stored totals.
- Facts retain source scope fingerprints, source IDs, observation windows, ratio inputs,
  duration samples/missing IDs and the non-atomic observation limitation. Candidate facts
  explicitly carry `publicationEligible:false`; no scheduler consumes them.

## Verified evidence

The candidate reproduces **234 values and 182 source sets across 26 named rows with
zero differences**, using the private retained source/reference evidence. No new Zendesk
requests were made. This replay tests the calculation, not a fabricated live snapshot:
the merged diagnostic capture is not passed off as a production durable observation.
See [aggregate replay](2026-09-30-menufy-inbound-candidate-replay.json).

The focused suite passes 29 tests: ten new calculation/record safeguards, seven shared
observation checks and twelve independent-reference cases. Typecheck passes. Full CI
and build status must be recorded against the pushed candidate before treating this
increment as validated for integration.

## Remaining release work

1. Add a dedicated opt-in connector/publication scope with effective assignment and
   identity validation, compatible metric definitions, atomic replacement/revisions and
   real PostgreSQL rollback/concurrency tests. Do not broaden the existing outbound policy.
2. Integrate source provenance, availability, labels and exports for the new report
   contract. Keep current-week presentation neutral and historical target context withheld.
3. Establish the current durable source coverage and explicit prospective cutover.
   September 20–26 offline parity is not permission to backfill older production values;
   historical repair remains disabled.
4. Complete isolated synthetic Preview/export evidence, fresh backup/restore, a concrete
   rollback, controlled scoped publication and actual scheduled verification. Unverified
   human ticket metrics and state-history automation remain separate requirements.

No master merge, production deployment, source configuration or publication is part of
this candidate increment.
