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

## Replayable employee records

`zendesk-pos-inbound-record.ts` now binds the calculation to an explicit organization,
source/account, team, employee, external agent, Sunday–Saturday week and prospective
policy. It retains only that employee's contributing calls/legs, including whole-call
hold, and recomputes all values and sample counts after serialization. The scope
fingerprint distinguishes report definitions, agents, groups, lines and timezones.
Candidate records and their contract are blocked by the central publication guard,
even if an eligible marker is forged. No source totals are trusted as facts.

Each stream's collection start/end, cycle and event watermark are retained separately.
A terminal response is not a coverage date: its event watermark may refer to the last
changed record. For a closed week, both collections must have started after the local
period end; completing pages after that boundary is insufficient. Current-week records
remain explicitly in progress, and non-atomic observation windows are never represented
as an exact point-in-time snapshot or independently certified completeness.

Seven record regressions cover minimized evidence, unknown versus zero samples, closed
coverage, current/future/stale periods, policy/identity mismatches, incomplete streams,
missing parents/whole-call hold and the autumn DST boundary. Seventeen focused tests
pass including the calculator and central publication guard. Typecheck and scoped lint
pass. Prior calculator candidate `fededf0` passes exact CI/build `37726475078`.

The new serialized-record replay matches all 78 retained employee-periods: 546 values,
390 source sets and 624 numerator/denominator comparisons, with zero differences.
There are 39 closed-week observations and 39 in-progress observations. This uses saved
collection time and synthetic Cadence bindings, not fresh October 8 source coverage or
historical roster proof. No source requests or production writes occurred. See
`2026-10-08-pos-inbound-record-replay.json`.

## Remaining integration and release work

The dedicated POS publisher now uses the existing atomic sync service. It selects an
explicit release policy, verifies current source/team/employee identities and compatible
effective metric assignments, and rechecks them under table locks before publication.
Its fetched-record digest prevents substitution. Fixed reporting dates survive retries;
freshness and closed-week coverage are checked after lock acquisition, including a
Sunday rollover after fetch. The live adapter explicitly selects `pos-call-hold-v1`,
shares existing source pacing/leases and uses bounded GET-only collection and identity
lookups. No environment setting or route invokes this adapter yet.

The qualified POS contract is distinct from both its candidate and the existing Menufy
inbound contract. It replaces only exact legacy `call_stats` contributors for its seven
keys. Unknown or competing qualified definitions fail instead of blending, and later
legacy refreshes cannot overwrite the selected POS observation. Duration sample counts
and exact means are preserved. Source descriptions distinguish employee-leg durations
from whole-call hold weighted per leg, with missing-measurement explanations. Existing
source-context checks continue to withhold incompatible comparisons and targets.

Seven PostgreSQL acceptance cases exercise publication, unrelated keys, legacy overwrite
resistance, null correction/revisions, changed identity/assignment/departure, expiry at
commit and fetched-record substitution. Three pure cases check source/sample semantics,
contributor selection and the Sunday rollover. The serialized publication wrapper also
matches all 78 retained employee-periods, 546 values, 390 source sets and 624 duration
checks with zero differences. This replay uses synthetic release/binding metadata and
does not qualify a real release. See `2026-10-08-pos-inbound-publisher-replay.json`.

Remaining: exact candidate full tests/CI, isolated hosted scorecard/history/export and
publication rehearsal, fresh source reconciliation and roster eligibility, prospective
catalog/release manifest, backup/restore, scoped production canary and genuine ongoing
scheduling. No policy, catalog, source request, production write or demo change occurred
while building/testing this publisher. Remaining call measures are not implicitly enabled.

Offered calls remain a separate saved formula/date cohort. The saved abandonment report
counts IVR/queue/voicemail outcomes, so it is deliberately not published as on-hold
abandonment. Actual agent on-hold attribution and the two transfer measures remain open.
This seven-measure implementation does not remove those requirements from the full goal.
Zendesk and the frozen demo remain untouched.
