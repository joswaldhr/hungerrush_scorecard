# Delayed parent-call recovery

The controlled production refresh rejected a newly observed agent leg whose parent
call appeared in a later calls export. The previous published values were preserved.
Refreshing both streams on every retry can introduce still newer unmatched legs.

The candidate retains the failed leg observation and refreshes calls only when a
recorded parent-coverage failure owns that exact leg observation and week offset.
A later successful publication prevents reuse. The existing source account binding,
request lease, pacing, pagination, version retention and publication gates remain.
The original freshness window is not extended: four minutes are reserved for bounded
collection and Support reads; an older observation requires a new complete cycle.
Concurrent replacement of the held leg checkpoint rejects the recovery. A calls-only
worker does not claim to have inspected or exhausted the leg stream.

## Qualification

The exact failed source namespaces and run marker were copied into the isolated,
previously restored database. No production source or metric rows were written.
The automatic selector chose calls-only and completed in 13.5 seconds / nine GETs.
Both the saved leg records and checkpoint remained identical. The recovered snapshot
contains 2,425 calls, 4,693 legs and zero missing parents. All 23 Menufy cases qualified;
an independent Python reconstruction matched 391 numeric/duration fields and 690
exact source sets with zero differences.

Using the same retained snapshot with fresh bounded identity/ticket GETs then qualified
all 62 employees across Menufy and POS. Independent reconstruction matched 1,054
numeric/duration fields and 1,860 exact source sets, with zero differences. There are
36 verified zero-call cases and 26 nonzero cases. This is a current-week calculation
check, not POS production activation or full-contract certification. The all-team
report's original diagnostic `collectionMode: both` was the connector's default label;
that invocation made no Talk collection requests. The candidate now reports `retained`
when collection was not requested.

Evidence: `2026-09-28-outbound-parent-recovery-qualification.json`, its reconciliation
report, and the corresponding `outbound-all-team-recovery` qualification/reconciliation
reports. Raw records and identities remain private and ignored.

Local typecheck and lint passed. The complete isolated suite passed 802 tests / 105
files, including an actual PostgreSQL delayed-parent recovery, wrong-week/expired-window
selection, later-publication rejection, unchanged legs and concurrency protection.
Exact final CI/build and deployment evidence remain separate gates.

## Remaining release gates

Production remains on the explicit rollback deployment `e95c371` /
`dpl_GXbbnN2xNxFKeqq7uLTu7MCbHest`; both new Talk/outbound policies remain absent.
Do not claim automatic recovery is active. A new release requires exact CI, a fresh
validated encrypted backup, rollback/promotion checks and scoped hosted qualification.

The existing Hobby schedule has hourly execution precision and permits only daily
execution per cron expression. It cannot guarantee a later retry inside the one-hour
joined observation window. The user has been asked about the new paid Pro subscription;
no plan upgrade or new scheduler has been performed. A bounded retry design must still
respect account-wide cooldown/leases and be observed running on the real scheduler.
Do not widen freshness limits or treat a manual recovery as scheduled evidence.

The same candidate also makes the inactive inbound offered definition explicit:
three-component retained replays keep their old version; the inspected four-component
definition includes unreachable agent legs under a new candidate version. No inbound
publisher, target change or production activation is included. Human ticket metrics,
shadow ingestion, action-v2 publication and historical repair stay disabled.
