# Fresh call-family qualification — October 5

The fresh Menufy inbound calculation now matches an independent Python implementation for
all 23 current employees in the last reporting week and current progress week. POS still has
two unresolved parent calls affecting three employees. No metric publication was performed.

## Checked surface

| Reporting period (America/Chicago) | Employee cases | Value comparisons | Exact source-set comparisons | Duration-evidence comparisons | Differences | Parent blocks |
|---|---:|---:|---:|---:|---:|---:|
| September 27–October 3 | 23 | 207 | 207 | 276 | 0 | 0 |
| October 4–10, observed October 5 | 23 | 207 | 207 | 276 | 0 | 0 |

The nine keys are offered, accepted, declined, missed, unreachable, answer rate,
abandoned-on-hold participation, total talk and maximum hold. Four-component offers and
call-created Central dates retain the inspected Menufy contract. SUM/MAX never replace
existing average keys. The reference uses Python with no application imports and compares
selected/outcome/participating call sets, uncertain acceptance, duration samples and nulls.

Last week contains 195 numbers, including 89 zeros, and twelve unavailable values. Eight
durations have no samples; four answer rates have no offers. The current week contains
174 numbers, including 121 zeros, and 33 unavailable values: 22 no-sample durations and
eleven zero-denominator rates. No uncertain acceptance or missing measured-duration fields
occurred in these employee cases. These counts describe availability, not accuracy scores.
They do not establish historical employee eligibility or guarantee full-week completeness
for the in-progress period.

## Source controls and remaining POS gap

The diagnostic made 25 Talk export GETs and four staff GETs. Talk used the existing shared
account lease and persistent pacing, strict account/endpoint validation, redirect rejection,
request timeouts, bounded request/time budgets and stop-on-rate-limit behavior. Latest-version
merging rejects conflicting equal versions. Raw records and identities remain private.
Only ordinary lease/pacing metadata changed in production; source checkpoints, metric values,
definitions, assignments and policy settings did not change. No Zendesk editor or write was used.

The merged observation contains 12,007 calls and 24,050 legs, initially with nine missing
parents. None affect the Menufy calculations. Current October 5 roster evidence identifies
two gaps affecting three POS employees. A separate, bounded two-GET calls-only catch-up
returned 59 records and recovered two other parents while keeping the exact leg observation
unchanged. Seven global parents remain absent, including the same two POS gaps. Neither a
permanent deletion nor delayed availability is established for those two. Their call-created
period and business scope remain unknown; leg creation dates cannot substitute for them.
The account lease was verified inactive after the diagnostic.

## Release sequence

1. Complete hosted roster approval and post-transition visibility checks when browser control
   is available. The user's basic Preview success does not cover those controls.
2. Finish the Menufy prospective definition/assignment manifest for its separate report keys,
   then revalidate exact-candidate CI, hosted evidence, fresh recovery and compatible rollback.
3. Collect fresh durable source observations under the account fence and publish one labeled,
   scoped Menufy canary. Compare persisted values/provenance and unrelated-row digests before
   widening; obtain actual scheduled execution evidence afterward.
4. Resolve the two POS parent gaps with bounded source evidence, then independently qualify
   its ticket-linked outbound scope and separate inbound report semantics. Menufy definitions
   do not supply POS business meaning.

Human ticket attribution, immutable historical targets/eligibility, source-authority exceptions
and unattended roster archival remain separate open requirements. Publication/repair opt-ins
remain disabled, and production and Adam's frozen demonstration were not deployed by this work.

Aggregate evidence: `2026-10-05-menufy-inbound-refresh-reconciliation.json`,
`2026-10-05-call-parent-gap-scope.json` and `2026-10-05-call-parent-recovery.json`.
