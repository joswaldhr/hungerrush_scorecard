# Menufy outbound prospective publication

Application: `e95c3710353209f79b73201d6bd2a4d70e5b40b8` / PR33, production
`dpl_GXbbnN2xNxFKeqq7uLTu7MCbHest`. The deployment is READY and owns the production
alias; PR and master checks pass (788 tests / 104 files, migrations, typecheck, lint,
build). The existing-session Menufy view lists 23 employees; administrator view was restored.

Scope: the five outbound call participation metrics for 23 active Menufy employees,
September 27–October 3 only, America/Chicago call-created date, explicit current
linked-ticket group scope. Source contract: `zendesk-call-created-agent-leg-outbound-v1`.
Attempted/completed/non-answered count distinct employee-participated calls. Durations
are agent/supervisor leg seconds, include measured zero, and retain per-field sample
counts. No samples produces a verified null, not zero. Earlier periods, other teams,
inbound/ticket/CSAT/first-reply metrics, employee assignments and targets are outside scope.
Incompatible historical targets remain unavailable; this does not certify target comparisons.

Real GET-only qualification retained 2,209 calls and 4,478 legs. Both streams exhausted;
six missing parent calls affect two POS employees, so POS is excluded from this release.
All 23 Menufy bindings pass the joined observation and source/assignment checks.
An independent Python reconstruction of the full populations matched all 60 qualifying
employee cases: 1,020 numeric/duration comparisons and 1,800 exact source-set comparisons,
zero unexplained differences. Two blocked POS cases independently reproduced the missing
parent condition. Earlier retained Menufy qualification covered two closed weeks (44
employee-period cases, 220 reported fields). Those historical weeks will not be rewritten.

The exact retained current Menufy observation passed the real publisher against an isolated
restored production copy: 115 values match the independent reference, identical replay
writes zero, and unrelated/historical values are unchanged. Hosted synthetic persistence,
current/history/revisions, alignment and actual CSV/PDF/PNG bytes passed on this application.

Recovery: `2026-09-28-outbound-fix-backup.json`, 15:51 UTC encrypted backup and verified
33-table / 48,778-row restore. At 16:06 UTC the seven protected production tables still
matched their pre-release checksums; all 18 production environment entries were unchanged.
An initial postcheck used a different checksum serialization; rerunning the original UTC,
order-independent algorithm matched every protected table. That diagnostic mismatch was
not a data mutation. The restored copy was subsequently restarted for isolated qualification.

Controlled publication procedure: revalidate the exact deployed SHA, current source and
employee bindings, retained evidence hashes and observation age. Publish one employee's
five values with the existing atomic sync engine and a labeled controlled-run diagnostic;
compare stored values and provenance against the independent reference and verify unrelated
row digests/revisions. Then widen to the remaining 22 Menufy employees (110 additional
values) only if those checks pass. No Zendesk calls or changes occur during retained replay.
Do not call this a scheduled execution. Preserve source observation timestamps.

Rollback: stop the affected outbound publisher/schedule; retain original facts and
`sync_revisions`. Restore only affected values from the immediately preceding revision,
checking for newer writes and the exact recorded controlled run first. Do not restore the
whole database or change employee assignments. The previous application `670fe22` remains
compatible, but reverting code alone is not metric rollback. Source collection, private
policy activation and genuine scheduled operation require separate evidence below.

Status: controlled production publication pending. Human ticket metrics, shadow ingestion,
action-v2 publication and historical repair remain disabled. Zendesk remains GET-only.
