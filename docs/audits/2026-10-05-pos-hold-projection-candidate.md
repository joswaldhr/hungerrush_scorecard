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

Validation: 31 focused cursor/store/join tests pass, including real PostgreSQL namespace
isolation, unchanged participation rows, shared account lease and rollback on missing hold.
All 999 local tests in 125 files pass on isolated PostgreSQL 18. Typecheck, scoped ESLint
and formatting pass. Full exact-candidate CI/build and the production recovery gate remain
required before any collection from this candidate.

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
