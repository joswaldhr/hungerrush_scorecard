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
instead of trusting matching IDs or precomputed totals alone.

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

The retained September 27–October 3 replay matches all 62 candidate employees,
310 values, 868 contributing-set comparisons, and 372 duration sum/sample/mean
checks. Of 111 retained report cells across 54 populated employee rows, one POS
count still differs. Eight candidates lack a populated export row; this replay
does not turn those absent report rows into independent zero comparisons.

The differing POS row has 34 source outbound participating calls, of which 31
remain inside the saved 11-group filter. The three excluded calls belong to two
tickets. Retained ticket audits establish changes out of the selected groups at
13:53:59 and 14:02:01 UTC on October 8. This confirms the existing scope-change
explanation; it does not establish Explore's ticket-dimension refresh cutoff or
prove its exact contributing IDs. Preserve the filter and withheld publication
for that discrepancy. The next comparison needs the same weekly interval and
known observation context, not the dashboard's different monthly interval.

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

TypeScript and scoped ESLint pass. The 34 focused TypeScript tests pass: channel
labels/coverage (4), unchanged cursor behavior (7), worker behavior (11), and real
isolated PostgreSQL storage/rollback (12). Nine independent Python verifier tests
pass. PostgreSQL checks include old-row/hash preservation, idempotent enrichment,
channel conflicts, channel-plus-checkpoint rollback, and tampered-sidecar rejection.
The two committed JSON receipts bind the retained replay checks only. Full exact
candidate CI/build, release/backup checks and actual deployed capture remain the
integrator's gates; no hosted or production result is claimed here.
