# Explicit durable Talk collection canary

## Pre-execution scope

Use exact tested collector candidate `2992e8e0d145fe0810e5aeaaa3853fd662ac2597`
from an isolated detached checkout, with successful PostgreSQL 18 CI `37363666846`.
The later migration-adoption candidate is a separate gated operation. No application
deployment, metric publication or feature-policy activation accompanies collection.

Fresh encrypted recovery at 20:00 UTC is verified by
`2026-10-05-baseline-adoption-restore.json`; production configuration inspection confirms
Talk collection, outbound policy, inbound report release and legacy Talk resume opt-ins
remain absent. Destination is the known production source/account. Before collection,
read the existing account-bound checkpoints and require one unchanged bootstrap.

Expected writes: only the existing Talk lease/pacing, calls/legs source-record,
source-version/revision and checkpoint namespaces. No normalized facts, metric values,
employee assignments, targets, source success timestamps, policies or schedules are written
by this operation. Vendor access uses only bounded official GET export endpoints.

Limit each invocation to 22 pages/150 seconds with existing 6.3-second pacing, account
lease, strict same-account pagination, timeouts and immediate stop/cooldown on throttling.
At most three sequential resumptions are permitted in this canary. Stop on an unexpected
schema, hash, account or checkpoint outcome. Partial pagination remains resumable and
must not be labeled a complete/fresh joined metric snapshot. Keep all raw source and
checkpoint payloads private; record aggregate results only.

Collection rollback: stop the explicit operator and keep every feature opt-in absent.
Retain source/checkpoint/revision evidence; do not delete new source versions or restore
the entire database over newer data. No metric rollback is needed when publication was
not invoked. Previous production deployment remains `dpl_GnmLnC5NGNmMtTJ1nRpnAhqnnisj`
at `224176336c9b29c1c7e76c41213d5e52b3d74518`.

## Initial observed result and bounded recovery

Three invocations collect 31 pages, 26,346 changed source records and their revision evidence.
Both streams are exhausted; stored readback has 10,963 calls, 21,947 legs and five missing
parents. Fresh staff GETs verify the 23 active Menufy bindings. Independent replay matches
396 values, 396 source sets and 528 duration comparisons for 22 employees across two weeks;
one agent's two cases are blocked by missing parent coverage. No differences occur among
the compared cases. None of the five missing parents exists in the earlier retained capture.
This result supersedes the earlier diagnostic capture for durable-source readiness.
See `2026-10-05-menufy-inbound-durable-reconciliation.json`.

The next operation is one calls-only catch-up on the same tested candidate/account/bootstrap,
limited to eight pages/90 seconds. It retains the exact leg checkpoint/record snapshot,
uses the same lease/pacing and stops on throttling/errors. It does not widen observation
limits or infer missing parent periods. Record call/leg digests and independent replay
afterward; unrecovered gaps remain unavailable. No source policy or metric publication
is enabled. Preserve source/revision evidence and leave all opt-ins absent on failure.

Successful manual collection is not scheduled operation or metric publication evidence.

## Observed catch-up and independent result

The calls-only catch-up completes three pages in 21,947 ms and retains 61 changed records
and revisions. Stored readback contains 10,976 calls and the unchanged 21,947 legs; four
of five missing parents are recovered. The joined observation span is 889,801 ms, within
the existing limit. Fresh staff reads reverify all 23 current Menufy employee bindings.
Independent reconstruction matches 414 values, 414 exact source sets and 552 duration
comparisons across September 27–October 3 and October 4–10, with zero discrepancies and
zero Menufy blocked cases. One global parent gap remains outside this cohort; its cause
and historical period remain unknown. See the durable recovered reconciliation artifact.
Read-only lease verification at 20:37 UTC confirms zero active account leases.

The source projection does not retain whole-call hold time. That does not affect Menufy's
qualified employee-leg SUM talk / MAX hold contract. POS's report-specific whole-call hold
weighted by joined legs requires a separately versioned source projection and coverage
qualification; do not substitute leg hold averages or alter this stored projection silently.
No metric publication, policy activation, source success timestamp or scheduler evidence
is claimed by these explicit collection operations.
