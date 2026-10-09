# Retained metric verification and channel evidence

This increment uses retained private source evidence only. It makes no vendor
requests, production writes, report changes or metric publication. The current
implementation ledger remains the authority for deployed state.

## Outbound independent replay

`scripts/verify_retained_outbound.py` provides a reusable independent Python
reconstruction without importing the application calculator. It verifies distinct
calls, local call-created dates, current linked-ticket group scope, classification,
leg sample sets, zero/null semantics, duration sums and denominators. It also
compares minimized publication-record contents against the full retained source,
instead of trusting matching IDs or precomputed totals alone. Every minimized
record must contain exactly the required source fields, and its own evidence is
independently recalculated; omitted nullable fields cannot masquerade as null.

Run it against a private manifest whose `candidates`, `snapshot`, `tickets`, and
optional `reportChecks` paths identify retained JSON files. Relative paths resolve
against that manifest, not the working directory. The candidate JSON has `cases`;
the snapshot contains `calls`/`legs` (optionally under `snapshot`); tickets are under
`tickets`; report checks are an array of `{employeeId, column, expected}`. Keep these
inputs outside Git. Python 3.9+ and an available IANA timezone database are required.

```text
python scripts/verify_retained_outbound.py --manifest <private-manifest.json>
python -m unittest discover -s scripts -p test_verify_retained_outbound.py -v
```

The initial retained September 27–October 3 replay matches all 62 candidate employees,
310 values, 868 contributing-set comparisons, and 372 duration sum/sample/mean
checks. Of 111 retained report cells across 54 populated employee rows, one POS
count still differs in that original reference (superseded by the fresh export below).
Eight candidates lack a populated export row; this replay
does not turn those absent report rows into independent zero comparisons.

The differing POS row has 34 source outbound participating calls, of which 31
remain inside the saved 11-group filter. The three excluded calls belong to two
tickets. Retained ticket audits establish changes out of the selected groups at
13:53:59 and 14:02:01 UTC on October 8. This confirms the existing scope-change
explanation; it does not establish Explore's ticket-dimension refresh cutoff or
prove its exact contributing IDs. Preserve the filter and withheld publication
for that discrepancy. The next comparison needs the same weekly interval and
known observation context, not the dashboard's different monthly interval.

### Retained export cutoff check

The POS export used in this comparison was received locally on October 8 at
16:08:22.540 UTC and last written at 16:08:24.975 UTC, after both ticket-group
transfers. Its archive members carry an unzoned 16:08:12 timestamp; the filename
and retained review-pack description identify 11:08 a.m. Central. These are
export/retrieval observations, not proof of the underlying dataset cutoff.

The CSV contains only agent names and outbound counts, with no contributing IDs
or dataset refresh metadata. A later report-definition inspection at
17:01:18.523 UTC recorded "18 minutes ago" for the dataset update label. That
rounded label refers approximately to 16:43 UTC, after the retained export, and
cannot establish which ticket-group versions the earlier export used. Thus the
34-versus-31 difference remains unresolved; dataset lag is plausible but unproven.

The smallest next check is a fresh export of the existing POS outbound report
for September 27–October 3, preserving the saved 11-group filter and recording
the contemporaneous refresh label and retrieval time. First verify the viewer
already shows that interval: retained files do not establish its current state
or provide an exact POS outbound viewer URL. If the report still differs,
read-only contributing call/ticket IDs and their report group dimensions are
needed before attributing the difference to snapshot or historical semantics.
No filter change, source request, report edit or publication was performed for
this retained-metadata check.

The subsequent October 9 viewer-only check found the existing POS Support Audit
dashboard set to Last 30 days, September 9–October 9, 2026, Central Time, with
the POS outbound report visible. This differs from the required weekly interval
and cannot serve as its replacement reference. No filters or reports were changed;
the viewer tab was closed immediately. The next weekly reference requires an
existing manager-provided export or explicit authorization for viewer-only filter
use under the guardrails; the monthly view does not close the discrepancy.

### Fresh weekly reference — October 9, 17:18 UTC

The user subsequently approved a one-time viewer-only date selection. The root
agent observed September 27–October 3, 2026 in Central Time immediately before
exporting, then restored Last 30 days and closed the viewer. No report editor was
opened and no report was saved. The downloaded CSV files contain no period or
dataset-refresh metadata, so their period binding relies on that observed viewer
state in the tool history, not on the filenames or CSV contents.

The fresh POS outbound export changes exactly one of its 42 count cells, from
34 to 31. All 35 rows matching the retained 39-employee POS cohort now agree with
the independent source calculation. Four cohort employees have no report row;
seven export rows are outside that cohort. Missing rows remain unverified, not
zero. This resolves the reported count discrepancy for the observed weekly
reference without changing the saved 11-group filter or calculator. It does not
prove the original Explore refresh cutoff or cause of the earlier disagreement.

Replaying all retained source evidence with the fresh POS references and the
unchanged prior Menufy references verifies 310 candidate values, 868 source-set
checks and 372 duration checks, with zero source replay differences. All 111
available report cells across 54 matched employees now agree. Only outbound
counts are present in the fresh POS CSV; the other four calculated outbound
measures do not gain new independent report comparisons from this export.

The source evidence remains the October 9 collection qualified around 01:24 UTC,
not a simultaneous fresh API snapshot. Report contributing IDs, absent-row zeros,
multi-period qualification and recurring publication/recovery still require their
own evidence. The remaining employee's source observation began at 01:21:43 UTC,
outside the existing one-hour controlled-publication freshness gate. That gate
remains unchanged: a bounded fresh joined-source collection and independent replay
are required before publishing the employee's five scoped outbound values. No
metric publication or database writes were performed here.
The other three exported reports were compared only for changes: updates changed
14 cells, agent state time changed one, and inbound counts changed none. Those
observations do not qualify their metric definitions or explain their changes.

The [aggregate receipt](2026-10-09-pos-fresh-outbound-reference.json) binds both
archives and the replay inputs by SHA-256. Raw exports, employee mappings and the
reproducible comparison script remain private outside tracked files.

An exit code of zero means the source replay checks passed; report differences
remain explicit in the aggregate output. It is not authorization to publish or a
freshness/completeness certification. Inputs are SHA-256 bound in the receipt;
stdout and the committed receipt contain aggregates only.

## POS update channel prerequisite

A previously retained October 6 incremental event page contains the missing
metadata: all 1,000 records have scalar `via` labels, including 120 `Phone call
inbound` and five `Phone call outbound` events. Those exact labels match the two
excluded channels in the inspected POS update report. No new vendor probe was
needed. The later diagnostic sanitizer had discarded capitalized/spaced labels.

The application candidate retains recognized labels in a separate immutable
`zendesk_report_event_channel_v1` source namespace. Each sidecar binds its event ID
to the original minimized event digest. Existing `zendesk_report_event_v1`
payloads, hashes and checkpoint schema remain unchanged. Re-observing a legacy
event can add a sidecar without rewriting its base record. A changed known channel
rejects the entire page, including new base records and checkpoint advancement.
Identical overlaps are idempotent. The thirteen labels are exact observed values;
unknown strings, numeric codes, objects and missing fields stay unavailable.

Retention is default-off behind the independently validated
`ZENDESK_REPORT_EVENT_CHANNEL_RETENTION=1` opt-in. Unset/empty retains the old
worker, request and persistence behavior; invalid nonempty values fail startup.
The main Preview source-work blocker includes this flag, and the candidate branch
cannot automatically deploy. A code release does not enable source retention.
Activation requires a scoped storage/duration canary: each recognized event adds
one small immutable sidecar and each enabled page has a batched overlap lookup.

Snapshot readers must explicitly request `includeChannels: true` to receive
validated channel evidence and missing-event IDs. Existing solved readers incur
no additional channel query. A complete base stream does not imply complete
channel coverage. The retained-page replay recognizes all 1,000 labels while
preserving all 1,000 original event hashes; this is one page, not a complete week.

No POS filter, calculator, assignment, source policy, target or publisher is changed.
The next steps are an explicitly scoped bounded source capture for the needed
periods under the shared account lease, fresh parent/identity joins, and independent
POS report comparisons using its ten groups, updater rows and update-date basis.
Do not reset or rewind the live solved collector to obtain missing historical
channel metadata. Old records without sidecars remain uncovered. A reviewed
source-evidence backfill, if required, is separate from publication and disabled
historical metric repair.

## Remaining coverage, in acceptance order

| Family                          | Remaining qualification                                                                                                                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menufy update events            | Only September 27–October 3 is released. Current source replay has no matching report export; the first retained week still has a residual. Resolve observation-specific references and add a guarded recurring adapter with fixed dates, fresh dependencies and replay before widening. |
| POS update events               | Preserve exact source channel labels, establish complete channel coverage and report parity, then qualify a separate publisher. Do not copy Menufy's six-group/brand scope or treat account credit as manual-human attribution.                                                          |
| Solved credits                  | Continue actual scheduled collection/publication and bounded failure/recovery evidence. Existing source replay is not a fresh same-cutoff Explore comparison.                                                                                                                            |
| Qualified inbound/outbound      | Complete multi-period comparisons and scheduled publication/recovery. Outbound's sole POS discrepancy remains withheld; new inbound catalog assignments have their recorded prospective dates.                                                                                           |
| CSAT / first reply              | Verify recurring refresh, durable recovery and every numerator/denominator. No ratings or reply samples legitimately produce null, not zero. POS first-response meaning/assignment must be independently established if requested.                                                       |
| Other displayed legacy measures | Offered/abandonment/consultation/duration semantics, elevated-work attribution, active handling time and snapshot backlog need their own contracts. Numeric legacy output is not automatically qualified. Historical away/transfer-only measures require a historical source.            |
| Access and exports              | Manager-own-login workflows, remaining actual PDF/PNG bytes and native print are distinct from administrator preview and CSV checks.                                                                                                                                                     |

This work does not enable human-action shadow/v2 publication, historical repair,
Assembled, recurring outbound, or recurring update-event publication.

## Candidate validation

TypeScript and scoped ESLint pass. All 41 focused TypeScript checks pass: channel
labels/coverage (4), unchanged cursor behavior (7), worker behavior (11), environment
validation (6), and real isolated PostgreSQL storage/rollback (13). Eleven independent Python verifier tests
pass. PostgreSQL checks include old-row/hash preservation, idempotent enrichment,
channel conflicts, channel-plus-checkpoint rollback, and tampered-sidecar rejection.
The two committed JSON receipts bind the retained replay checks only. Full exact
candidate CI/build, release/backup checks and actual deployed capture remain the
integrator's gates; no hosted or production result is claimed here.
