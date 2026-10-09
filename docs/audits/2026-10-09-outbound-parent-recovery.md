# Recovered POS outbound parents — scoped correction

## Manifest before publication

Runtime `477018989304b7a58f785dcc887bc08c5e580c9c` is live; exact master CI/build
`37868465720` passes. The outbound calculation, observation, record, connector,
Zendesk connector and atomic sync implementation have no diff from the previously
qualified PR52 release. Its three-period isolated synthetic rehearsal remains
applicable; this correction changes retained source data only.

Scope: the two POS employees previously excluded for missing parent calls, five
existing outbound keys, September 27–October 3 only. Expected writes are two source
summaries and ten normalized facts/values, with predecessor revisions retained.
No roster, definition, assignment, target, other employee, other period, source
configuration, recurring publication or Zendesk changes are authorized by this
correction. The presentation demo remains unchanged.

A new bounded incremental read recovers all seven parents missing in the earlier
snapshot, including both agent-call parents. A fresh six-request collection and
two-request calls-only catch-up preserve the original projection and all eight
protected application-table digests. Sixteen bounded Support GETs resolve 1,558
linked tickets. All 62 scoped records now pass the existing observation gates;
independent replay matches 310 values, 868 source-set checks and 372 duration
numerator/denominator/mean checks. This is source replay, not universal report parity.

The unchanged Menufy dashboard was exported in view mode and closed. The initial
comparison against older linked-ticket observations still differed for two Menufy
rows. The subsequent fresh linked-ticket replay resolves both differences: all 76
Menufy report-cell comparisons match. One retained POS row still differs. The two
recovered POS employees match the retained POS reference
counts. Reports and filters were not edited. One globally missing parent remains
outside the participating employee evidence; global endpoint completeness alone
is not treated as joined coverage.

The 01:21 UTC [encrypted restore](2026-10-09-outbound-recovery-restore.json) matches
all 36 tables / 395,027 rows. Require backup and source evidence under one hour old
at dispatch. Use one controlled transaction through the existing sync service,
rechecking current bindings, independent expected values and source sets, retained
predecessors and 12 protected unrelated-data digest groups before commit. No vendor
requests during publication. A failed check rolls back the complete operation.

Rollback: retain compatible runtime `4770189` and restore only these ten affected
predecessors from retained revisions after checking for newer writes. Preserve
source/revision evidence; never restore the whole production database for this
correction. Private manifests contain exact identifiers and prior rows. Only
aggregate receipts are committed. Verify persisted values independently after
commit and inspect a representative live scorecard/export.

## Outcome

The two POS records commit atomically: ten values, ten facts and two sources.
Independent read-only verification at 01:29 UTC confirms ten values, 60 persisted
source-set checks, ten retained numeric predecessors and all 12 protected digest
groups. No recurrence is activated.

## Separate Menufy widening manifest — before publication

The newly resolved two Menufy employees are a separate ten-value correction for
the same five keys and September 27–October 3. Fresh ticket evidence shows one
contributing call removed per employee because its linked ticket's current group
changed. Call fields are unchanged; linked-ticket changes are limited to group and
updated timestamp. Talk sums decrease by 36 and seven seconds. This uses the
existing report contract, not a new formula or assumed report refresh delay.

All four report columns for both selected employees must match before dispatch.
Use the same exact runtime/CI, independent replay and fresh 01:21 backup. Recheck
identity bindings, ten predecessor revisions, 60 source-set checks and 12 protected
digest groups within the transaction, then independently read back after commit.
The prior two POS corrections and all other employees/weeks are now protected
unrelated rows. One unresolved POS report row remains excluded. Rollback is limited
to this separate correction's ten predecessor values, subject to newer-write checks.
No recurring policy or publication is enabled.

The separate Menufy transaction commits ten values, ten facts and two sources.
Independent read-only verification at 01:30 UTC matches all ten values, 60 persisted
source-set checks, ten retained numeric predecessors and all 12 protected digest
groups. In total, four of the five previously excluded employees now have this
week's outbound correction: 20 new values, with 61 employees refreshed across the
October 8 and October 9 operations. This is one week, not ongoing qualification.

Administrator view-as confirms the representative Menufy scorecard's selected week,
outbound rows, 01:21 UTC source observation, America/Chicago timezone and withheld
historical targets. The actual downloaded CSV is 9,934 bytes, 15 metric rows and
20 columns; all three manager-visible outbound rows agree. PDF/PNG bytes and native
print were not rechecked; export code is unchanged. This is not manager-own-login
acceptance. See the [aggregate publication/readback receipt](2026-10-09-outbound-recovery-publication.json).

The POS dashboard was opened in view mode to seek a fresh comparison. Its saved
visible range is September 8–October 8 (Last 30 days), not the selected review week.
No date/filter or report changes were made; the viewer was closed. It cannot settle
the remaining weekly difference or independently renew the older weekly reference.
One POS employee remains excluded pending matching-period evidence. No hypothetical
zero, guessed exclusion or stale report-refresh assumption was used to qualify it.
