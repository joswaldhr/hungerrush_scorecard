# Current-week CSAT recovery manifest

Prepared September 28 before the controlled refresh. The user requires the manager
workflow usable before 3:00 p.m. Central today. Existing execution authorization applies;
the operation does not wait for another routine approval.

- Defect: the 08:34 UTC current-week CSAT refresh failed with HTTP 429 and wrote no
  values. A similar failure occurred September 26; September 27 succeeded. The affected
  endpoint/quota and Retry-After were not retained by that production error record.
- Operation: exactly one controlled refresh of the **already active** qualified CSAT
  policy for September 27–October 3, America/Chicago. This is recovery, not proof of a
  scheduled execution. Stop on failure; do not automatically repeat it.
- Application: exact deployed `8a0c4bd8b26ac660b0cfd1a7e5dddd41a687debc`, isolated in a
  managed worktree with no tracked application changes. CI 36195377392 passed on that
  SHA. Production deployment/rollback reference: `dpl_69LgEzQCG6k9LCfdBWsnhKbb4AuQ`.
  No code deployment, schema migration or environment change is included.
- Policy: existing source/account, team scopes, assignee attribution, solved date and
  prospective cutover remain unchanged. Its canonical fingerprint matches the latest
  successful production qualified CSAT run. Sensitive hosted settings cannot be read back;
  the runtime's retained fingerprint is the check. New Talk/outbound policies are absent.
- Expected writes: 62 employee source summaries and 85 CSAT score/response-rate values,
  their normalized facts, retained predecessor revisions and normal sync bookkeeping.
  Earlier periods, other metric families, employee/team assignments and targets are outside
  the operation. Human ticket attribution/shadow/action-v2/historical repair remain disabled.
- Correctness: today's separate bounded GET-only diagnosis completed 38 requests in
  50.252 seconds; all 85 candidate calculations matched independent source-set/value
  calculations. The existing previous-week publication independently matches all 85 values.
  See `2026-09-28-csat-read-only-diagnosis.json` and
  `2026-09-28-csat-retained-publication-check.json`. Neither diagnosis published anything.
- Recovery: the 13:49:11 UTC encrypted snapshot restored successfully: 33 tables,
  48,545 rows, all row digests matched, migration compatibility through 0015. Backup SHA256:
  `f7682ce9d8b380cc29094f80415bbc539ffa829e90d9c4682ae4d270ea835c61`.
  Details: `2026-09-28-csat-recovery-backup.json`. Recovery artifacts remain in restricted
  private storage outside Git; plaintext cleanup was not attempted.
- Preflight: explicitly read-only transaction verified source/team/key/identity ownership,
  no active sync, 62 bindings, 85 expected values and a digest over all 13,813 protected
  metric rows. The helper rejects a backup older than 20 minutes, another application SHA,
  tracked application modifications, another date/database, or an existing execution marker.
- Postconditions: independently compare every published value and cohort, confirm the
  exact period/contract, verify retained revisions and match the protected-row digest.
  On mismatch stop and preserve the run and predecessor evidence. Restore only affected
  revisions after checking for later writes; never blindly restore the full production DB.

The new outbound path remains separately gated by staging credential recovery and its
hosted/runtime/recovery/canary evidence. This recovery does not certify other metric families
or promise full metric coverage by the deadline. Boss-specific sign-in/assignment verification
awaits the requested work email.
