# Menufy September 20–26 source reconciliation

The exported call and CSAT tables now agree with the reconstructed source population for
**September 20–26, 2026, America/Chicago**. This supersedes the unresolved outbound
residual and call-report identity gaps in the initial workbook audit. It does not
activate a publisher or certify the entire meeting pack.

## Verified call results

| Comparison | Population | Result |
|---|---:|---|
| Outbound Complete, NA, Total and total Talk | 20 named report rows, 80 values | Zero differences |
| Inbound offered, accepted, declined, missed, unreachable, answer ratio, abandoned-on-hold participation, total Talk and maximum Hold | 26 named report rows, 234 values | Zero differences |
| Candidate versus independent inbound reference source sets | Six sets per named row, 156 comparisons | Zero differences |
| CSAT score, good, bad, surveys sent and response ratio | 24 named report rows, 120 values | Zero differences |
| Independent Python versus CSAT candidate ticket sets | Four sets per named row, 96 comparisons | Zero differences |

The combined report comparison is **434 values with zero differences**. This is the
checked surface for this particular period, not a product-wide accuracy percentage.

Counts and seconds match exactly. Ratios use an absolute tolerance of 1e-10 on the
0–1 scale. Empty exported ratio cells normalize to missing, never to zero. All named
call rows now have a unique exact-name match in the fresh staff census; outbound IDs
also agree with the retained mapping. No fuzzy matching was used.

The one outbound residual is explained by **one abandoned-on-hold call**. It belongs
in Total while remaining outside Complete and NA. The existing calculator already
handles this correctly. A new synthetic regression checks all three outcome sets,
distinct call counts despite repeat legs, and employee-scoped talk sums. No live
formula correction is needed for this finding.

## Evidence and collection controls

The earlier calls/legs capture ended before the reporting week closed. A delta beginning
September 25 overlaps both retained streams and covers their gap through the new
observation. Merge selects the latest source version and checks equal-version conflicts;
none were found. The resulting period contains 8,233 calls. Current linked-ticket
metadata was obtained completely for the outbound cohort: 1,575 requested and returned.
There are no unresolved outbound ticket joins. Exact raw values, source IDs, employees,
ticket records and scripts remain private; only aggregate results and digests are public.

The GET-only Talk reads used the existing production account lease and persistent
6.3-second pacing, bounded time/page budgets, same-account endpoint checks, redirect
rejection and stop-on-rate-limit behavior. Calls required eight pages and legs fifteen.
The account lease was verified released afterward in a read-only database connection.
The only database writes were ordinary coordination lease/pacing metadata; no source
records/checkpoints, metric values, employee assignments or settings were written.
Ticket metadata required sixteen bounded Support GETs; the staff census required four.
CSAT required 110 bounded Support GETs for 5,491 solved-ticket candidates and matching
metric sets. This includes padded UTC boundary candidates; the final cohort uses Central
solved dates, current assignee and the five confirmed CSAT groups. There are 153 source
requests in total. The CSAT collector retained all satisfaction states; a rated-only
subset could not establish the surveys-sent and response-rate denominators.
No Zendesk report, dashboard, ticket, setting or permission was changed. No editor opened.

Outbound was rebuilt independently in Python and compared both with the workbook and
the existing TypeScript calculator. Inbound used the independent report reference,
then compared exact offered, accepted, missed, declined, unreachable and abandoned
source sets with the candidate calculator. The workbook contains aggregate rows,
not source IDs, so exact candidate/reference set agreement must not be described as
report-export source-ID parity.

For CSAT, the existing candidate and an independent Python reduction agree on good,
bad, surveyed and solved-cohort ticket IDs for every report row. All 120 values agree
with the workbook, including nine blank no-rating scores and five blank no-survey
response rates. No ticket-history event attribution is inferred from this current-
assignee satisfaction contract. The existing qualified CSAT policy is unchanged.

## Remaining scope boundaries

- The inbound report's unnamed activity row is not attributed to an employee.
- Inbound includes 17 of the retained 23 pilot identities; outbound includes 18.
  The remaining six/five absent rows are not automatic zeros. Current staff identity
  does not establish effective historical membership or eligibility.
- The **transferred-to** column was not reconciled. Its retained inspected measure is
  Multi-assist calls, whose official definition uses non-null leg consultation type.
  The captures used here omit that field. Do not replace it with a guessed count of
  agents or treat it as proof of who initiated a transfer. See Zendesk's
  [Voice metric definitions](https://support.zendesk.com/hc/en-us/articles/4409156145434-Metrics-and-attributes-for-Zendesk-Voice).
- SUM talk and MAX hold do not qualify average-duration fields. The template's total
  talk and answer-percentage measures still need correctly named product keys.
- Current linked-ticket group metadata matches this report observation; immutable
  historical group/target context remains unverified. No historical values are repaired.
- The inbound candidate can select four-component offered calls, but the current
  production policy does not enable this candidate. Matching data is not a deployment.
- Verified-human ticket activity and automated historical state durations remain
  separate unresolved requirements. Source roles or report totals do not resolve them.

## Validation and next release work

Twenty targeted tests pass, including the new synthetic outbound case and the existing
independent inbound reference suite. Typecheck, scoped lint and formatting pass. No
production code behavior changed. Full release CI, isolated hosted proof, fresh recovery
evidence and scoped publication/scheduled verification remain required for a publisher.

The next implementation should release the Menufy call family with an explicit offered
definition and separately named total/average measures. Preserve missing-data behavior,
historical target safeguards, source versioning and prospective cutover. Reuse these
private records for synthetic derivation and offline checks; do not re-fetch them merely
to repeat an already passing comparison. The frozen demo, POS and Assembled remain
outside this change. See the [aggregate evidence](2026-09-30-menufy-source-reconciliation.json).
