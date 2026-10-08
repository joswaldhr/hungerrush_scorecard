# POS inbound report calculation candidate

The production POS scorecard still uses legacy whole-call inbound calculations. The
saved employee report uses leg-created dates, agent/supervisor participation, excludes
unreachable legs and weights whole-call hold once per selected leg. A whole-call mean
or an employee-leg hold mean would produce different results.

`zendesk-pos-inbound-report.ts` implements that separate contract without importing the
offline reconciliation reference. It calculates accepted, declined and missed agent
legs and the four means: leg talk, whole-call hold weighted by leg, leg duration and
leg consultation. Every duration retains its numerator, sample/cohort counts and
measured/missing/zero leg sets. No samples yields null; an observed zero stays numeric.
A completed agent leg with unknown talk time makes acceptance unavailable rather than
silently treating unknown acceptance as zero. Parent joins, duplicate IDs, schema,
chronology, group/line filters and explicit leg-date/timezone scope are checked.

The parsed source capture is indexed once and reused for the team's employees. The
source parser copies inputs; mutating an external input or one returned result does
not change another employee's calculation. This avoids repeatedly validating the full
75,000-leg capture for every employee. The final retained weekly/monthly replay took
177/234 ms respectively on this local run, excluding file reads. These are diagnostic
timings, not hosted latency or quota guarantees.

## Independent checks

- September 13–19: all 55 saved report rows match seven measures, 385 comparisons.
  Counts match exactly; the report's whole-second displayed means are compared using
  its existing floor convention. Previously retained report leg identities remain
  separate evidence; this replay did not repeat that file-level join.
- September 6–October 5: all 71 saved report rows match seven measures, 497 comparisons,
  using exact counts and an absolute 1e-9-second tolerance for raw means. All 71 selected
  leg sets match the retained independent Python reconstruction exactly.
- The separate October 6 retained source capture matches all 39 current POS employees
  for September 27–October 3 and October 4–10: 78 employee-periods, 546 values, 390 exact
  source sets and 624 duration numerator/denominator comparisons. The exact group-ID
  selection equals the corrected current-name scope. This is replay of that observation,
  not a fresh October 8 capture or historical employment-membership proof.
- All comparisons have zero differences. No new source request or production write
  was needed. Raw source data, report rows, employee identities and replay scripts stay
  private outside tracked paths.

Eight focused tests cover sample semantics, repeated-call weighting, supervisor versus
agent counting, Central/DST boundaries, exclusions, duplicate/malformed evidence,
unknown acceptance, independent reference parity and reusable-capture isolation.
The full suite and exact-candidate CI results are recorded in the implementation ledger.

## Remaining integration and release work

This is an unconnected calculation candidate in PR44. There is no route, producer,
catalog change, policy activation or deployment in this increment. Publication must
bind a fresh `pos-call-hold-v1` source snapshot, exact employee/team/period and prospective
release policy; retain replay evidence and compatible target rules; and pass isolated
publication, recovery, source reconciliation and actual scheduling gates.

Offered calls remain a separate saved formula/date cohort. The saved abandonment report
counts IVR/queue/voicemail outcomes, so it is deliberately not published as on-hold
abandonment. Actual agent on-hold attribution and the two transfer measures remain open.
This seven-measure implementation does not remove those requirements from the full goal.
Zendesk and the frozen demo remain untouched.
