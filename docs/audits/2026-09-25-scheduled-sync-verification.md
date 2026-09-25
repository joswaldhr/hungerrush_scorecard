# September 25 scheduled sync verification

Final check: 07:55 UTC September 25. All four scheduled **metric publications** are
verified with exact week intervals and zero metric errors. Offsets 1–3 returned HTTP
200; offset 0 returned HTTP 503 only after publication, during roster discovery.
PR25 corrects that roster conflict, but its corrected roster path has not yet been
observed on the scheduler. No manual sync was added to manufacture this evidence.

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
refresh, not a historical-repair activation.

Offset 2 also completed on the same pre-fix deployment: scheduler request
07:19:28.165 UTC, 207,938 ms, HTTP 200. Its database run was
07:19:28.689–07:22:55.770 UTC (207.081 seconds): 186 source records, 1,080
normalized/published values, zero skips/errors. Fetch/publication took 197,010/9,468 ms.
All intervals were September 6–12; predecessor revisions: 186 source, 1,066 fact,
1,066 metric. Offset 3 was still pending at the initial 07:24 UTC checkpoint.
No extra sync was triggered during this verification.

## Final late-window observations

The project-wide production log query at 07:55:50 UTC crossed deployment boundaries
and returned all retained matching requests without a further page. Offsets 1 and 2
still matched their earlier successful observations. The final offset 3 invocation
ran on PR25 deployment `dpl_5MWPNsFU8DRv2zzKg7TgAi1noGE1`:

| Field | Observed value |
|---|---|
| Scheduler identity / offset | vercel-cron/1.0 / 3 |
| Request start / duration | 07:27:58.093 UTC / 234,708 ms |
| Request outcome | HTTP 200, no logged errors, no function crash |
| Metric run | 07:27:59.236–07:31:52.465 UTC, completed, zero errors |
| Fetch / publish | 222,698 / 9,914 ms |
| Source / normalized / published / skipped | 186 / 1,074 / 1,074 / 0 |
| Source and value intervals | August 30–September 5 exclusively |
| Retained predecessor revisions | 186 source, 1,064 fact, 1,064 metric |

The read-only database census at 07:55:50.838 UTC showed six completed runs that day:
the two previously documented manual refreshes and the four scheduled publications.
No running or stale-running rows remained. The earlier offset 0 request was outside
the currently returned log window; its already-recorded 07:00 observation remains
the platform evidence, corroborated by its retained database run and revision rows.

PR25 was still the READY production target at this final check, with all four cron
definitions enabled. The longest observed request was 234.708 seconds, below the
configured 300-second function limit; this does not establish a worst-case runtime
guarantee. Offset 3 skips roster discovery by design and therefore does not validate
the corrected current-week roster path.

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

## Correction deployment

[PR25](https://github.com/joswaldhr/hungerrush_scorecard/pull/25) merged as
467c2fa92723b4cc3277b8a4eae53412d8bd866c. Candidate CI 36106916272 and 36106921476
passed all 581 tests / 66 files, PostgreSQL 18 migrations, TypeScript, lint and production
build. The extra regression test ensures even an empty exception message keeps roster
failure unhealthy. Production deployment dpl_5MWPNsFU8DRv2zzKg7TgAi1noGE1 is READY
and owns the production alias as observed at 07:23 UTC. The sign-in entry and provider
endpoint both returned HTTP 200. All four unchanged cron schedules are enabled on this
deployment. Merged-master CI 36107218863 also passed.

The same one-time verification was moved to 07:55 UTC (02:55 Central) for the final
late-window check, without requiring user participation or creating an ongoing monitor.
The follow-up completed the project-wide log/database comparison above. This one-time
automation was paused after the completed check; no recurring monitor is enabled.

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
