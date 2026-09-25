# September 25 scheduled sync verification

## Observed scheduler failure

Read-only production database and Vercel request-log checks began at 07:00 UTC.
The current-week request was an actual scheduler invocation (`vercel-cron/1.0`),
not either of the controlled manual refreshes at 02:14 and 02:57 UTC.

| Field | Observed value |
|---|---|
| Deployment | dpl_6ge4wS2wdDF3PSqWiyTgyXjjZ4vd / 86a0b10 |
| Request start / duration | 06:09:57.096 UTC / 195,310 ms |
| Request outcome | HTTP 503, roster discovery failed after metric publication |
| Metric run | 06:09:59.196–06:13:10.054 UTC, completed, zero metric errors |
| Fetch / publish | 181,250 / 8,958 ms |
| Source / normalized / published / skipped | 24 / 192 / 192 / 162 |
| Source and value intervals | September 20–26 exclusively |
| Retained predecessor revisions | 24 source, 192 fact, 192 metric |

The successful `sync_runs` row alone did **not** demonstrate a healthy cron request.
The subsequent roster lookup rejected one account found in conflicting line mappings.
Five vendor rate-limit warnings were retried; the function did not crash.

All four cron definitions were enabled on this deployment. The hosting plan provides
[hourly scheduling precision](https://vercel.com/docs/cron-jobs/usage-and-pricing),
so absence at an exact configured minute is not proof of failure. At 07:13 UTC a
second run was in progress. It subsequently completed successfully: week offset 1,
request start 07:11:49.115 UTC, 209,752 ms, HTTP 200, `vercel-cron/1.0`.
Its database run was 07:11:51.277–07:15:18.534 UTC (207.256 seconds), with zero
errors, 186 source records and 1,067 normalized/published values. Fetch/publication
took 196,821/9,828 ms. All source/value intervals were September 13–19; predecessor
revisions: 186 source, 1,057 fact, 1,057 metric. This is the normal scheduled rolling
refresh, not a historical-repair activation. Offsets 2–3 remain unverified.
No extra sync was triggered during this verification.

## Bounded correction

A complete read-only roster census made eight vendor GET requests across four
configured mappings: 78 active identities, exactly one line conflict, zero account
or cross-team conflicts. The conflict belongs to an existing employee whose saved
team and line match one observed group. No identities or vendor payloads are retained
in this report.

Discovery now retains that existing line only for the same source account within
the same team and only when the line is actually observed. Missing, duplicate or
unmatched saved assignments, different accounts and different teams still fail closed.
The reconciliation transaction rechecks the saved assignments and locks current rows
before creating candidates; a concurrent change requires a retry. Existing employee
assignments are not rewritten. A read-only execution of the updated connector returned
all 78 identities, including all 62 mapped active employees. Two other existing saved
scopes differ from discovery's proposed scopes; discovery does not overwrite either.

The cron response now preserves a successful metric result when later roster work
fails, separately reports `rosterError`, and still returns HTTP 503 without a healthy
heartbeat. This avoids disguising either the successful publication or roster failure.

Validation: 580 tests across 66 files passed locally, plus TypeScript and lint.
Coverage includes both saved lines, ambiguous assignments, duplicate accounts,
concurrent assignment changes, and post-publication roster failure reporting.
The recovery rehearsal was corrected to preserve already-populated revision history;
the original empty-revision assertion applied only before the first release sync.
The fresh 07:15 UTC read-only backup restored all 33 tables / 32,796 rows with exact
digests and preserved existing revision history through the restored-copy migration
check. See `2026-09-25-production-restore-roster-fix.json`. No production migration
is required. Roll back application code to 86a0b10 / dpl_6ge4wS2wdDF3PSqWiyTgyXjjZ4vd
if necessary, retaining current data and schema; that version still has the roster
conflict. Do not restore the snapshot over newer scheduled publications.
CI/rollout evidence will be appended after completion.

## Remaining limits

This correction is not yet evidence of a successful scheduled roster reconciliation.
Human ticket attribution remains unverified and withheld. Shadow ingestion, version-2
publication and historical repair remain disabled. Hosted export-file bytes remain
uninspected; automated export-content tests pass. External heartbeat delivery, portable
recovery/provider PITR and independent transferred-call attribution remain open.

The preceding metric display correction is already in production through
[PR24](https://github.com/joswaldhr/hungerrush_scorecard/pull/24), merge 86a0b10:
reported business-time zeros are included; duration display uses H:MM:SS; columns share
fixed widths; source definitions and unsupported-metric explanations are shown.
That release passed 570 tests and master CI 36088295911. Its controlled refresh at
02:57:31–03:00:06 UTC published 511 values with zero errors for September 20–26.
It does not establish scheduled execution or verified human ticket activity.
