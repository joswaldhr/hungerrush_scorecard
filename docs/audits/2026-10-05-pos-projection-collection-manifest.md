# Guarded POS projection collection manifest

After exact candidate `b5bbbcbd621a40950bbb0edfdb84ad1f6583c485` passes full CI
`37374409381`, collect the explicit `pos-call-hold-v1` projection only. This is a source
collection canary, not an app deployment, metric publisher, historical repair or scheduler
execution. The original participation projection stays unchanged and remains readable.

Require the known production account/source, absent publication/source activation flags,
no running sync workers, zero existing new-projection rows, a fresh encrypted verified
restore and private execution intent before the first request. Use the verified 20:59
post-catalog recovery only while less than one hour old; otherwise refresh it. Keep exact
original participation checkpoint/record/revision count and digest inventories before/after.

Expected writes are limited to the new `*_pos_hold_v1` calls/legs/checkpoint/revision
namespaces and the existing shared account lease/pacing. No normalized facts, metric
values, source success timestamp, employee/manager assignments, catalog, targets or source
policies may change through this collector. All vendor operations are official GETs.

Use the same September 26 bootstrap as the original durable projection. Permit at most
three sequential 22-page/150-second invocations, with 6.3-second pacing, strict same-account
pagination, request timeouts, and stop/cooldown on 429. A pending stream resumes; it is not
complete coverage. If a final calls-only recovery is needed, write its separate bounded
manifest first, preserve the exact legs/checkpoint and retain the original freshness limits.

After collection, inspect stored counts, mandatory whole-call hold coverage, parent joins,
observation intervals and released lease. Reverify active staff identities and independently
compare exact POS source sets, duration sums/denominators and values under an explicitly
labeled known-group diagnostic scope. The four original historical labels are still unbound;
collection cannot certify complete report scope or historical employee eligibility. Metric
publication stays disabled even if the source comparison passes.

On error stop this explicit operator, release the lease and retain checkpoints/revisions;
do not delete either projection or restore over newer data. Disable no unrelated qualified
CSAT/first-reply policy. Previous production app deployment remains
`dpl_GnmLnC5NGNmMtTJ1nRpnAhqnnisj` / `224176336c9b29c1c7e76c41213d5e52b3d74518`.
The frozen demo and Zendesk configuration remain untouched.
