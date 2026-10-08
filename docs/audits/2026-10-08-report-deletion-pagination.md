# Report parent refresh continuation

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

Release requires exact CI/build, synthetic isolated Preview continuation rehearsal,
fresh verified backup and production read/authentication checks. The synthetic
rehearsal performs no database writes or vendor requests. Existing deployed source
policies, assignments, schedules, recovery switches and human-only guards remain
unchanged. This transport correction does not certify the full scorecards.
