# POS whole-call hold projection candidate

The current participation store intentionally omits whole-call hold seconds, while
Alex's inspected inbound report weights that call field once for each selected leg.
Substituting a leg hold mean would produce a different metric. This candidate adds
an explicit `pos-call-hold-v1` projection to the existing bounded Talk store/worker;
no route, source policy, schedule or publisher selects it.

Its calls require `hold_time` as nonnegative seconds or explicit null. Omitted or
invalid fields stop the page before any record/checkpoint commit. The cursor retains
that field under its own projection contract. Calls, legs, revisions and checkpoints
use separate `*_pos_hold_v1` namespaces, while the original account lease and request
pacing remain shared. Default readers and old payload hashes/checkpoints stay unchanged;
unknown projection names are refused. No database migration is required.

An offline exact-version join also compares all common projected call fields. Missing,
older or newer versions remain blocked; conflicting equal versions fail. It preserves
zero/null, strips unnecessary raw fields and never enriches an old stored source version.
The fresh source probe supplies 11,025 measured hold values. Only 10,882 of the earlier
10,976 retained call versions match; 94 changed versions affect 12 current POS identities.
This is a reason to collect a coherent new projection, not to fill old measurements.
The retained leg snapshot's freshness gate is not asserted passed by that join.

## Actual collection and independent comparison

### Delayed retry and fresh joined observation, October 6 02:48 UTC

A separately manifested two-page calls-only retry recovers all four previously missing
parents, preserving exact POS leg and protected digests. Its older leg observation is
not claimed fresh. A separately manifested five-page overlap refresh then exhausts both
streams: 11,390 calls, each retaining whole-call hold, 22,805 legs, zero missing parents.
Original participation and protected application digests remain unchanged. No metric writes
or source activation occur. The account lease is released and original age/span gates pass.

Independent comparison now matches all 78 employee-periods: all 39 last-week and all 39
current-week rows, with 546 exact source-set and 390 duration comparisons, zero differences.
This supersedes the one blocked current-week case below, for this newer capture only.
The 14-group diagnostic scope remains unchanged; the four original report labels still
need authoritative binding. No historical eligibility, new manager-export parity,
publication or scheduler result is inferred. A fresh encrypted restore matches 35 tables /
204,725 rows before the operations. Recovery remains Windows-profile-bound.

Fresh Explore access still fails before opening any report with AADSTS90015; the temporary
tab is closed. Zendesk's official troubleshooting recommends clearing browser cookies:
https://support.zendesk.com/hc/en-us/articles/11270498158490-Error-AADSTS90015-Requested-Query-string-is-too-long
No report, account configuration or permission is changed to bypass this issue.

Exact b5bbbcbd621a40950bbb0edfdb84ad1f6583c485 passes full CI/build 37374409381.
The guarded initial collection completes 35 pages / 27,060 changes with both streams
still pending; a separately manifested continuation completes 18 pages / 6,255 changes
and exhausts both streams. A two-page calls-only recovery adds 15 changes while preserving
the exact POS leg record/revision/checkpoint digest. Original participation and every
protected application-table digest match before/after all operations; no metric is written.

The final capture contains 11,085 calls, all with mandatory whole-call hold fields, and
22,186 legs. Four global parents remain missing. One affects one POS employee's current
week through a newly created leg; that employee/period is blocked, never assigned zero.
The account lease is released. Source observation age/span checks pass for this capture.

Independent Python comparison matches the offline TypeScript reference for 77 employee
periods: all 39 last-week rows and 38 current-week rows, with 539 exact source-set and
385 duration numerator/denominator/mean comparisons and zero differences. This covers
the 14 known report groups only. It does not bind the four missing original labels,
establish historical eligibility, compare a new manager export, or publish any values.
See the collection, continuation, parent recovery and independent reconciliation artifacts.
Source operations are controlled manual reads, not scheduled evidence.

Validation: 31 focused cursor/store/join tests pass, including real PostgreSQL namespace
isolation, unchanged participation rows, shared account lease and rollback on missing hold.
All 999 local tests in 125 files pass on isolated PostgreSQL 18. Typecheck, scoped ESLint
and formatting pass. Full exact-candidate CI/build and fresh encrypted restore gates passed
before the manifested collection operations; future operations require fresh gates again.

The official API confirms [whole-call hold seconds](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/).
A separate official account-audit probe returns 205 group history events in three bounded
GETs, with pagination exhausted. Those events cover 149 historical group IDs, all present in the retained inclusive group
census, with create/update/destroy actions. No newly recovered group ID is inferred.
The four original unresolved selected labels are not in
the retained reference input, so this does not bind them. A brief attempt to reach Explore
fails in Microsoft sign-in with `AADSTS90015` (query too long); its temporary tab is closed
without opening an editor or changing Zendesk. See the group-history aggregate artifact.

Next gates: collect and independently reconcile the new projection on fresh calls/legs;
resolve original report group labels against authoritative history; validate two closed
weeks/current week and all employee source sets; define correct abandonment labels,
effective date and target compatibility; then separately gate publication and actual
scheduling. Source/identity matches do not establish historical employee eligibility.
This candidate does not activate legacy publication, human action ingestion, repair,
new employee assignments or any production metric. The frozen demo stays untouched.
