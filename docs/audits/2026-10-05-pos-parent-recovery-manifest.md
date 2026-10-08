# POS parent-call recovery

The source projection completes both streams, with six global missing parents. Offline
POS qualification refuses an employee/period parent join; no replay output or metric is
published. This is an actual coverage failure, not a zero result.

Run one bounded calls-only catch-up from exact CI-passed b5bbbcbd621a40950bbb0edfdb84ad1f6583c485,
at most eight pages / 90 seconds. Require fresh verified recovery, absent activation flags,
shared account lease/pacing and private intent. Preserve exact POS leg record/revision and
checkpoint digests, original participation and protected application digests. Retain source
records and stop on failure/cooldown; do not restart legs or reset any checkpoint.

After recovery qualify observation age/span and all parent joins again. A remaining gap
continues to block its employee/period. No changes to Zendesk, app, source policies, metrics,
employees or frozen demo. Recovery rollback is to stop, retain evidence and release the lease.
