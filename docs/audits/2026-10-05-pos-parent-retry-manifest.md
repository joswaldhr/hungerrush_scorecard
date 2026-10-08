# Delayed POS parent retry

The retained 21:29 UTC capture has one POS current-week leg with an unavailable parent.
Retry once after the elapsed source delay, from CI-passed documentation head e0d621c928c9af84291c1eb14db4d4b65b018b9e
(37376325051), whose source code remains the tested POS projection candidate.

Require a newly verified encrypted backup/restore, fresh production environment metadata,
known account/source, no running sync workers, private intent and shared account pacing.
Allow one calls-only invocation, at most eight pages / 90 seconds. Preserve exact POS
leg records/revisions/checkpoint, original participation and protected application digests.
Never reset a checkpoint, delete retained source evidence, or publish a missing join as zero.

Independently replay the resulting capture under the original source age/span limits.
The old leg observation may now be too old: a recovered parent alone cannot renew it.
Record parent availability separately from refreshed metric qualification. No metrics,
source policies, employee assignments, app deployment or Zendesk configuration changes.
On failure stop and retain evidence; never restore over newer production data.
