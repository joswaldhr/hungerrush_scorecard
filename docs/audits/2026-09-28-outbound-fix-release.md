# Outbound replacement activation blocker

The hosted synthetic rehearsal found that the replacement selector expected legacy
`agent_stats` although the connector emits outbound facts in `call_stats`. A read-only
production query found 2,018 outbound facts since September 6 using `call_stats`.
The old guard rejected a legitimate replacement and rolled its transaction back.

Candidate application: `d3f57ec9023521801f750b73204faa0b73bce960`, PR33.
The guard now accepts the actual legacy call type while rejecting unrelated types and
explicit conflicting source contracts. No source definitions, targets, assignments,
schema, active policies or schedules change. This code release does not activate the
collector or publish production metrics; activation retains its separate source/canary gates.

The PostgreSQL regression first failed using the actual call-record shape and passed
after the correction. It covers fractional seconds, null correction, retained original
facts/revisions, inbound siblings, earlier periods and later legacy overwrites.
Full local validation exposed one additional old unit-test fixture using the same wrong
record type; that fixture was corrected. Final CI runs 36446226518 and 36446232635 pass
on the exact candidate, including 788 tests / 104 files, migrations, typecheck, lint and build.

Hosted synthetic publication on the same application code passed five values, exact
fractional storage, replay without writes, null correction and preserved unrelated values.
The Preview browser used `dpl_4EePMZJELQypFF5gFY13KXNCV1sN` on the exact candidate.
Actual CSV, PDF and PNG downloads match the five results and source/sample context;
all six tables have identical measured column positions. See the hosted publication report.
No vendor credentials were extracted or vendor requests made during the rehearsal. Its
one-deployment build override left the shared project build command unchanged.

Fresh recovery evidence: `2026-09-28-outbound-fix-backup.json`, 15:51 UTC. The encrypted
backup restored 33 tables / 48,778 rows with every digest matching through migration 0015.
Private recovery files remain outside Git. The restore cluster stopped after validation.

Rollback application: `670fe2275ee257da687e8b8b414bf4b438c291b2`, production deployment
`dpl_EFzonruTEMUEzGazCkJFbU7YvVo1`. No schema or policy rollback is needed. Select that
compatible deployment if a regression appears; do not restore the entire database over
newer data. Read-only environment/data comparisons and exact production alias verification
follow deployment. Genuine scheduled execution remains separately unverified.
