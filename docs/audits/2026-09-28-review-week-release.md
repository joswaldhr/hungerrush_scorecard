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
