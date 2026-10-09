# Agent update publication candidate

**Superseded release status, October 9:** PR59 is live and a controlled Menufy-only
September 27–October 3 publication is verified. No recurring activation or wider-period
qualification is implied. See [scoped release](2026-10-09-agent-update-scoped-release.md).
The candidate-stage statements below record the preceding qualification state.

## Fresh source qualification

The September 27–October 3 Menufy comparison now uses fresh durable events,
identities and parent attributes. A controlled six-request event refresh retained
5,364 new events and exhausted its stream in 115 seconds. It used the existing
account lease and pacing. Ten protected employee/assignment/metric table digests
match; no metric or vendor writes occurred. This was a controlled source refresh,
not scheduler evidence. The preceding encrypted backup restored all 36 tables /
389,065 rows, matching digests and preserving application data after migration checks.

The read-only qualification then resolved all 23 source identities, joined current
parents, and built candidate update records. Independent Python reconstruction
matches all 23 counts and contributing update-ID sets. All 21 populated report rows
match exactly. Two employees absent from the report have zero events in the complete
source capture; their zeros are independently source-proven, not assumed from absent
export rows. Oldest dependency: 23:48 UTC; join completed 23:53 UTC. These times remain
part of the evidence and do not become fresh again on replay. The existing source
cohort is retained even though one employee is archived from a manager's meeting list.

See [refresh receipt](2026-10-08-agent-update-source-refresh.json),
[independent comparison](2026-10-08-agent-update-fresh-parity.json), and
[restore receipt](2026-10-08-update-qualification-restore.json).

## Candidate behavior and isolation

The new explicit connector publishes only `zendesk_agent_update_events`, with unit
`updates` and the display label **Agent update events**. It recomputes distinct update
IDs from minimized source evidence, including account-attributed integration activity.
It neither counts distinct tickets nor establishes manual human authorship. Current
ticket group/brand scope and update-date reporting timezone remain unchanged.

Release policy, source/account/team ownership, active identity bindings, team-wide
assignment, unit and aggregation are checked before fetching and again within the
publication transaction. Missing role/parent/coverage evidence fails without replacing
earlier values. Freshness is rechecked at commit using the oldest dependency and any
current-week cutoff. Changed fetched records, identities or assignments stop publication.
Verified zero corrections retain predecessor revisions. Complete snapshots cannot be
summed twice. Current-week cutoff, source meaning and account-attribution caveats are
carried into the existing shared presentation/export context.

The parent-join helper now checks the evidence required for the selected measure:
updates require updater role; solved counts still require solved-transition evidence.
The existing solved entry point keeps its original default behavior. Tests cover both.

No route, environment parser, scheduler, catalog or production assignment enables
this connector. Existing solved configuration rejects the new policy kind. The branch
blocks automatic Preview deployments; the frozen demo is unchanged. Production's old
human-only key stays guarded. A read-only production preflight found only the legacy
`tickets_updated` definition, so release still needs an explicit new definition and
dated Menufy assignment cutover; no existing definition is silently relabeled.

## Validation and remaining release work

Local typecheck and ESLint pass. All 1,293 tests across 161 files pass, including
PostgreSQL rollback, zero correction, idempotency, sibling preservation, post-fetch
employee/unit changes, queued staleness and independent current-cutoff handling.
Formatting and exact remote CI/build are recorded in the implementation ledger.

No production update values were published. Ongoing activation still needs the
remaining reliable historical/current-week reference qualification, exact CI/build,
isolated synthetic hosted publication/display/export checks, a fresh backup and
reviewed catalog/assignment manifest, and a controlled canary with independent
persisted-value/source-set comparisons. Recurring scheduling/recovery needs its own
observed execution. A one-week comparison does not certify ongoing operation or POS.
The two Menufy outbound discrepancies remain separate and untouched.

Any production release must name the exact then-live rollback deployment. If a
scoped canary fails, preserve its evidence and restore only its own predecessors
after checking for newer writes. Do not restore the whole database or enable legacy
human-only, action-shadow/v2 or general historical repair.
