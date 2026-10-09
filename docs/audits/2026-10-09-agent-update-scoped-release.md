# Menufy agent updates: one-week controlled release

## Pre-release manifest

Scope: September 27–October 3, 2026, Menufy's 23 source identities only (22 active
meeting-list entries and one archived entry with retained history). The separate
`zendesk_agent_update_events` definition measures distinct update IDs, unit `updates`,
updater-account attribution, update-created date in America/Chicago, and observed
current ticket group/brand. It does not establish manual human work.

This is a fixed-week controlled publication, not ongoing activation. All 21 populated
reference rows match and the other two values have independently verified complete-source
zero evidence. Independent reconstruction matches all 23 source sets/counts. The
closed-week capture's oldest dependency is October 8 23:48 UTC and must remain under
one hour old at commit. If it expires, stop; do not change its timestamp. Current-week
source reconstruction also matches 23 sets/counts, but has no matching report export
and is excluded from this release. Older periods and POS updates remain excluded.

Candidate runtime: `afb2c93dfd8dc8f771073031d833c9d0f8f2aa1b`, PR59. Exact CI/build
`37863133425` passes, with 1,293 tests in 161 files. Isolated Preview
`dpl_N63DxRVsbMtSWEw7KZwGAXKs1bSu` passes three synthetic periods and idempotency;
unrelated values match. Hosted closed-week CSV, PDF and PNG bytes show 7 versus 4;
PDF/PNG rendering is inspected. Current-week UI/CSV/copied text show zero versus 7
with neutral In Progress. Current-week image bytes and native print remain unverified
and are outside the fixed-week release. No export implementation changes.

The first hosted rehearsal failed without a detailed failure reason. A second build,
with diagnostic checkpoints and unchanged publication behavior, passed. The initial
cause is not claimed resolved; synthetic successful repeat publications are retained.

Expected writes: one new definition, one Menufy-only assignment bounded to
`[2026-09-27, 2026-10-04)`, 23 source summaries, 23 normalized facts and 23 metric
values, plus normal run/checkpoint/revision evidence. Split only Menufy's existing
legacy update assignment around that interval, preserving its exact other properties
and both outside intervals. No old value is relabeled, deleted, or backfilled.
Do not copy targets. Perform catalog, scoped normal publication, verification and
assignment switch in one transaction; a failed check rolls the operation back.

Before dispatch: exact final candidate/master CI, a fresh encrypted restore receipt,
verified live SHA/alias, and private predecessor/digest manifest. Verify every new
value and retained source set against independent results, and all unrelated employee,
manager archive, assignment, target, definition, metric-value and fact rows against
baseline. Only aggregate receipts enter Git. No vendor requests during publication.

Runtime rollback reference: PR58 master `ea7138b14506e5a825fa1b8fc0acd96e546bd14f`,
deployment `dpl_5BDnKrAqA8LpZfZDDzuaze4iWqWj`, rechecked before release. No new
environment opt-in or schedule is added. If post-publication verification fails,
hide only the new week's assignment, restore the old assignment interval after
checking newer changes, and retain the new evidence for investigation. Do not restore
the whole database or overwrite newer writes. Human-only publication, action-shadow/v2,
general historical repair, other metrics, employee memberships and the demo stay unchanged.

## Outcome

Released in PR59 as `87c75f4bd047a57270c88248e701cd22ff53c3aa`, production
`dpl_HhewZvRChTKNotoj2CXjvf3F9r5t`; alias and login verified. Final candidate CI
`37864638984` and master CI `37864915692` pass, including 1,295 tests / 161 files.
Runtime matches the hosted candidate; later changes add two PostgreSQL release tests
and documentation only. The [fresh restore](2026-10-09-agent-update-release-restore.json)
at 00:20 UTC matches 36 tables / 394,647 rows.

First dispatch stops at the table-lock check before catalog creation. A separate
read-only check confirms zero new definitions and the untouched original assignment.
No blocking worker remains at that inspection. The retry succeeds at 00:32 UTC:
23 source summaries/facts/values publish atomically with the bounded assignment switch.
All 23 source sets and counts match before commit. Read-only post-commit verification
at 00:33 UTC again matches all 23 values and all 11 protected digests; two values are
verified zero. No vendor requests, target copies, policy or scheduler changes occurred.
See [publication receipt](2026-10-09-agent-update-publication.json).

Live administrator view-as shows the new labeled count and removes the old update
placeholder only for the selected week. The downloaded production CSV's 20-column
contract, value, unit, America/Chicago timezone, source contract and No Target status
agree with the screen. This is not the manager's own authenticated acceptance. The
synthetic stored-history interval form also shows 7 for the closed week, 0 for the
current week with its source cutoff, and preserves the scorecard return week.

This closes the selected-week publication gap only. The initial synthetic rehearsal
failure's cause remains unknown; its repeat passes are recorded above. Ongoing update
activation, other-period report comparisons, POS definition qualification, current-week
image bytes, native print and the separate outbound discrepancies are not claimed done.
