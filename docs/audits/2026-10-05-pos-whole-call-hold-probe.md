# Bounded POS whole-call hold source probe

Use the unchanged, tested `fetchCoordinatedTalkWeek` and GET-only transport from
collector candidate `2992e8e` (full CI `37363666846`). This diagnostic is not a sync,
publisher, policy activation or source checkpoint write. The existing shared account
lease/pacing is the only production coordination metadata it may change.

Request at most 20 calls-export pages / 180 seconds with 6.3-second pacing, strict
account/endpoint pagination and immediate stop on throttling/errors. Start at the
existing September 26 durable bootstrap to inspect the same modified-since cohort.
Retain raw source fields privately before the legacy helper's creation-date filter;
do not mistake that filtered result for POS's leg-date parent universe. Record actual
source observation times, paging and field coverage. Retained records must validate
whole-call hold as nonnegative seconds or explicit null; omitted fields stay unavailable.

Compare parent joins and common source fields only at identical call ID/update versions.
Newer or absent versions are not silently joined to earlier leg/call observations. The
probe cannot certify report group bindings, historical employee eligibility, a complete
manager pack or scheduled execution. No report editor or Zendesk mutation is used.
On failure retain private diagnostic evidence, release the lease and keep policies absent;
do not delete source data, change metric values or restore the database. Production app
and frozen demo remain unchanged.

Zendesk documents whole-call `hold_time` as the sum of customer hold seconds in its
[official incremental calls export](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/).
The existing legacy projection already retains this field in a separate namespace,
but its period-filtered snapshot is not directly suitable for POS leg-date joins.
There are currently no production records in that separate namespace. This diagnostic
checks the underlying API field before deciding the smallest safe durable adapter change.
