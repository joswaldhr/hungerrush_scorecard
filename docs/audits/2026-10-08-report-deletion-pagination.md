# Report parent refresh continuation

## Later qualification — October 8, 22:04 UTC

Fresh unchanged dashboard export and a second bounded parent observation now match
all 21 populated current-cohort update rows exactly, with no formula adjustment.
The residual described below is superseded for that observation only. All 23 source
counts/event sets independently match; fresh events and multi-period qualification
remain required. See the [current contract checkpoint](2026-10-06-report-ticket-credit-contract.md)
and [aggregate receipt](2026-10-08-menufy-update-late-parity.json).

## Production result

PR54 is live as `bf7ea0de2d92c757cb41f3ee0b24493b81ab5251`, deployment
`dpl_9tJxGRF9S45ad4nsGFKXhzUANDqd`, verified READY on the production alias.
Final candidate `f95e545` passes exact CI/build `37821453954`. Login, authenticated
review selection, anonymous cron rejection and authenticated disabled outbound route
pass. All 22 environment metadata entries and 16 crons are unchanged. No extra sync
or metric publication was triggered. The fixed transport was already exercised
against real read-only source continuations in qualification; scheduled execution
of that corrected path has not been observed. Rollback is `bb3328f` /
`dpl_4xsKsCFjbxTebpG2VXUtm8KpCSwY`.

## Defect and qualification

A real read-only Menufy parent refresh stopped on the deletion census after 50
successful parent batches. Zendesk's returned next-page URL retains the page number
and descending deletion sort but omits `per_page`. The existing account-bound reader
required that parameter and rejected the legitimate continuation before a request.
No metric or database writes occurred; prior published values were preserved.

The reader now restores its explicit 100-row page size only for a valid continuation
page (2–100) with the original deletion sort and no supplied page size. Wrong accounts,
foreign paths, duplicate/unknown parameters, altered explicit size, initial missing
size and invalid page bounds remain rejected. Request/time budgets, quota pacing,
GET-only access, redirect rejection, deletion coverage and fail-closed publication
behavior are unchanged. No Zendesk configuration or metric formula changed.

Local typecheck/ESLint and all 1,224 tests in 151 files pass. Exact candidate
`b336d85` CI/build `37820640163` passes. Runtime-identical isolated Preview
`9fe44d6` / `dpl_48nZFZ4QTB5V5o4mT5z9qM14dwxm` is READY; its mock transport
follows the real omitted-size continuation, retains explicit deletion evidence and
matches four synthetic values with no vendor requests or database writes. The
18:00 UTC encrypted backup restores all 35 tables / 378,002 rows with matching
digests. See the aggregate Preview, restore and parent-reconciliation receipts.

With the corrected reader, 52 bounded GETs resolve 4,911 current parents and 40
explicit deletion tombstones for 14,129 retained closed-week account events across
23 Menufy staff. The source period is September 27–October 3 in America/Chicago.
The retained events were captured October 6; fresh parent attributes alone do not
make that event capture freshly observed for publication. This is qualification,
not a metric publication or fresh full-stream claim.

Independent reconstruction matches all 23 counts and contributing event sets.
The unchanged October 8 dashboard export contains 21 employee rows: 20 match,
one differs by one update. Nineteen parent tickets changed group/brand since the
earlier capture. Two employees have no report row; missing export rows are not
invented zeros. Exact residual investigation and fresh event/identity qualification
remain required for a separate Agent update events release. POS update semantics
remain separate and cannot inherit Menufy's group/brand contract.

Four additional bounded GET-only audits inspect the remaining employee's four
updates with no incremental child events. Three are knowledge-link events; one
contains a follower change and a webhook event. Excluding the latter would close
the one-count difference, but that is a hypothesis, not independently proven report
membership. It must not become a formula change solely to fit this row. Dropping
all empty-child updates would remove 3,508 events across the current cohort and
break matching rows. The read-only dashboard viewer exposes copy, not contributing
event details, for the inspected value; it was closed without changing filters or
opening an editor. All source details remain private.

Release requires exact CI/build, synthetic isolated Preview continuation rehearsal,
fresh verified backup and production read/authentication checks. The synthetic
rehearsal performs no database writes or vendor requests. Existing deployed source
policies, assignments, schedules, recovery switches and human-only guards remain
unchanged. This transport correction does not certify the full scorecards.
