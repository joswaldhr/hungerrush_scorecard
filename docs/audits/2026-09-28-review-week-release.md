# Last-week review release

Presentation-only change based on production `ed6b2df`; the inactive inbound candidate
in PR38 is excluded. No migrations, data publication, vendor requests, target changes,
employee assignment changes or scheduler changes are included.

Fresh scorecards select last week; current-week values have neutral progress statuses.
Shared presentation supplies loaded dates, availability counts and export statuses.
Historical target restrictions and null/zero/source-quality semantics remain unchanged.
Exports use interval filenames and explicit-week links; history retains returnWeek.

Local typecheck and 820 tests / 106 files pass. The first unrestricted full test run
passed all tests but hit a database cleanup hook timeout; four-worker rerun passes
without changing timeout or test expectations. Lint/CI/hosted/recovery/release evidence
is recorded below as verified; this document does not itself claim deployment.

Automatic Vercel deployment is disabled only for `codex/last-week-review`, which lacks
isolated environment overrides. Hosted verification must reuse the existing synthetic
Preview environment and exact candidate SHA. Production and audit branch deployment
behavior are unchanged. Rollback reference: `dpl_DBWaKeHfuutr8i3qeyAawQUCSUJ6` / `ed6b2df`.

## Verified candidate and remaining release gate

Candidate `db599ed6f0dda6e0eac6299d0b4fdc42a1a4c1d7` is pushed in PR39. Exact GitHub
CI run 36474330989 passes typecheck, lint, migrations, 820 tests and production build.
Vercel Preview `dpl_BfBrmQrvkEfL82ZWibVGkLXaoFgF` is READY on that SHA. It was created
from the existing isolated Preview deployment with its environment inherited and the
candidate Git SHA explicitly supplied; the audit branch ref itself was not changed.
The existing branch alias now serves that candidate. Authenticated hosted reads still
show the isolated synthetic organization/employee rather than production employees.

Hosted default review shows September 20–26 against September 13–19, with 15/22
reported values and seven unavailable. All eight tables have identical column widths.
Explicit current week shows September 27–October 3, an empty progress state and no
performance judgments. History's back link preserves `week=2026-09-20`. Light/dark
views and a 390px viewport have no document horizontal overflow; all eight tables
scroll within their containers. Local tests additionally cover numeric current-week
neutral statuses, Sunday/year boundaries, null/zero, retry/races and fixed-week links.

Fresh recovery at 19:46 UTC restored 33 tables / 63,633 rows with exact table digests
and DPAPI round-trip verification; see `2026-09-28-review-week-restore.json`.

**Production release remains held:** hosted export actions report success, but download
events time out and no new interval-named CSV/PDF files are found in local Downloads
or the task browser's artifact locations. The current browser integration also does
not provide the copied content despite a success notification. These are unverified
hosted outputs, not proof of an application export defect or passing export gates.
Generator/filename/link/frozen-capture unit tests pass. User was asked whether a native
Save As dialog requires completion. Inspect actual hosted CSV/PDF/PNG bytes before
merge; refresh recovery if necessary. Production remains PR37 / `ed6b2df`.

Adam's separate synthetic demo workspace was requested during implementation. Its
provisioning is not part of this UI release; exact Microsoft work email is pending.
No new demo access or production permissions have been granted.
