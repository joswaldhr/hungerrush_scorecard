# Direct Explore report intake

## Decision and delivered boundary

The user authorized the export bridge with an 11 a.m. Central deadline, then asked
whether it was the best long-term source strategy. Retain verified API collectors
as the primary automatic path. Use existing manager reports for acceptance and a
supported file feed only where a required metric cannot be reproduced reliably.
Browser export automation is not the permanent scheduler. Changing the transport
does not establish a missing rating, historical roster, or human authorship.

The new offline TypeScript intake consumes a private manifest normalized from the
supported dashboard CSV export. It retains archive/file/scope/viewer evidence hashes,
explicit Sunday–Saturday dates, Central timezone, raw cells, source rows and exact
employee bindings. It rejects changed headers, ambiguous identities, duplicate rows,
invalid intervals, future observations, invalid counts/ratios and oversized tables.
It never maps totals or maximum durations to averages and never turns blanks or
absent employee rows into zero. The parser does not itself authenticate the manifest's
claimed evidence; an operator must bind it to the actual export and viewer evidence.

Output is explicitly a candidate. The common publication guard rejects its contract
and record type even when its eligibility marker is forged. No API, database writer,
assignment, metric definition, target, cron or production activation is added.

## Fresh reference obtained

On October 8, read-only navigation opened the existing Menufy dashboard's 1x1 view.
The viewer showed September 27–October 3 in Central Time. Ticket-report tooltips
confirmed the six groups, Menufy brand and exact date restriction. The ordinary
CSV export saved an eight-file ZIP locally, although the browser download-event
wait timed out. Actual bytes were verified on disk. No editor, Save, report change
or Zendesk configuration change was used.

Five report tables map to the 23 current eligible Menufy employee bindings. Independent
Python comparison against the original ZIP checks all 459 prepared values and units
with zero differences, including 103 zeros and 12 blank cells. Coverage differs by
report: updates 21 employees, CSAT 22, inbound/outbound 19 each, state time 20.
Missing rows remain absent. This is report transcription parity, not independent
verification of the underlying calculations. Aggregate evidence is
`2026-10-08-export-intake.json`; raw identities and employee values remain private.

A private local HTML report pack gives the user a selectable, printable view for all
23 current employees. It explicitly states that it is a reference and is not published
into live Cadence. The source report remains authoritative for these displayed results.
The local pack is not hosted publicly or sent to any manager.

The fresh export also matches every comparable stored Menufy solved/CSAT value:
21 solved credits, 22 CSAT scores and 22 response rates, including nulls. Counts
match exactly; percentage comparisons allow 0.00001 percentage points for stored
floating precision. These 65 comparisons support retaining the verified API path;
they do not verify absent report rows or the other metric families.

Validation: 1,229 tests / 152 files passed before a final outbound key correction;
the final focused 17 tests pass, including the added outbound key/partition regression.
Typecheck and scoped lint pass. Browser inspection confirms the local pack loads its
23 employee options, values, date/unit labels and limitations. Native printing is
available through the browser but has not been byte-verified in this pass.

## Next implementation gate

1. Finish saved-scope and date evidence for each imported report, verify representative
   cells against the viewer, and bind exact file hashes to that evidence.
2. Decide the smallest family whose direct report observations add useful information;
   retain a separate reported-value contract and no unverified legacy targets.
3. Add an atomic, idempotent publisher with organization/employee/effective-assignment
   revalidation, predecessor retention, stale-observation rejection and scoped rollback.
4. Pass PostgreSQL failure/retry tests, exact CI, isolated hosted acceptance and fresh
   backup/restore before a labeled production canary. No shortcut through direct SQL.
5. Establish supported scheduled file delivery only under explicit Zendesk configuration
   authorization; monitor receipt, reporting interval and failures. Manager prep must
   not become the permanent ingestion mechanism.

POS imports, group duplication for state time, absent-row interpretation, all-metric
certification and unattended operation are not completed by this intake.
