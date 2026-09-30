# Menufy workbook comparison baseline

**Later September 30 source follow-up:** All 314 compared named call-report values
now match underlying records. The outbound residual is an abandoned-on-hold call;
all named call-report identities resolve uniquely in the fresh census. See
[source reconciliation](2026-09-30-menufy-source-reconciliation.md). The initial findings
below remain the record of what the workbook alone established.

The user supplied the dashboard's Excel export on September 30. The private original
is 15,906 bytes; SHA256 is recorded in the accompanying aggregate JSON. It is excluded
from Git locally and was read without modification. The eight sheets contain static
values, no formulas or Excel error cells. No reporting date cells were detected.

The existing dashboard viewer independently displays **Last Week, September 20–26,
2026, Central Time**. Visible CSAT, outbound and state-time samples agree with the
workbook. This corroborates the intended interval; the export itself has no embedded
period manifest. The filename is an export timestamp, not a reporting date contract.
No dashboard/report editor or filter change was used in this pass.

## What the export establishes

| Check | Rows checked | Result |
|---|---:|---|
| Offered = accepted + declined + missed + unreachable | 27 | All agree |
| Answer ratio = accepted / offered | 27 | All agree, including three blank no-offer ratios |
| CSAT = good / (good + bad) | 24 | All agree, including nine blank no-rating ratios |
| Return ratio = (good + bad) / sent | 24 | All agree, including five blank no-sent ratios |
| Solved / agent updates | 43 | All agree |
| State sum = Away + Online + Transfers only | 18 | All fully numeric rows agree; five other rows have missing components |
| Hypothesis: outbound Total = Complete + NA | 20 | One row has Total larger by one; cause unresolved |

These are **183 internal consistency checks**, with 182 agreeing and one unresolved
partition hypothesis. They are not an accuracy percentage, independent reconciliation,
or evidence that the report populations are complete. In particular, the outbound
identity is not yet an established invariant: the existing calculator separately retains
abandoned-on-hold and unclassified calls. A positive residual is compatible with another
outcome bucket; matched records must establish the actual cause. Do not force Total
to equal Complete plus NA or change the live calculator from this arithmetic alone.

The workbook resolves the earlier inability to obtain report bytes. It confirms the
complete exported inbound column inventory: offered, accepted, declined, missed,
unreachable, answer percentage, abandoned on hold, transferred to, Talk time and Max
Hold time. Retained inspected definitions establish SUM talk and MAX hold. Numeric
duration cells contain raw seconds; visible state and outbound duration samples agree
after formatting. Neither total talk nor maximum hold certifies an average field.

The state Sum includes Online. The template's Away plus Transfers Only must instead
use its two separately qualified components. Five rows have missing state components;
do not silently convert those cells to zero. The inbound sheet also includes an unnamed
row with duration/activity values. It must not be assigned to an employee by position.
The ticket-updates sheet is grouped by ticket type, not employee, and cannot fill
employee Tickets Updated. The employee update report still measures events and does
not establish verified human distinct-ticket activity.

## Identity and coverage limits

Exact retained name-to-ID mapping finds 19 of the 23 pilot IDs in the CSAT, state and
employee-update reports, 17 in inbound and 18 in outbound. These are different source
populations, not interchangeable rosters. The mapping is incomplete and not an effective-
dated census; unmapped names and absent rows remain unresolved, not zero or proof of
missing employee activity. No fuzzy name matching was used. No duplicate nonblank name
was found within a sheet. Diagnostic sheets have their own narrower populations and
must not be treated as attendance or employee-intent evidence.

## Next qualification gates

1. Bind the retained export, observed interval and saved family-specific filters to an
   explicit reference contract. Verify effective employee identities and exclude unnamed
   source activity from employee attribution.
2. Reconcile September 20–26 calls, related legs and ticket groups against every named
   inbound/outbound row, preserving complete source coverage and exact source sets.
   Explain the outbound residual before declaring family parity. Older-week comparisons
   and current-week source snapshots do not substitute for this closed-week evidence.
3. Reconcile CSAT rating cohort and denominators separately. Keep approved human-ticket
   restrictions intact; matching update-report values cannot certify human activity.
4. Qualify state-time grouping/deduplication and missing-cell semantics. A usable workbook
   is now present, but a supported historical automation feed remains unresolved. A manual
   file cannot fulfill the final no-preparation manager workflow by itself.
5. Add the qualified missing template measures and release one family through documented
   isolation, source, recovery, hosted and scheduling gates. No source policy, assignment,
   metric value, production deployment or demo changed in this audit.

See [aggregate workbook evidence](2026-09-30-menufy-workbook-audit.json),
[saved viewer contract](2026-09-29-menufy-viewer-contract.md) and
[reporting requirements](2026-09-29-reporting-requirements.md).
