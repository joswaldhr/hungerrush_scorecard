# POS current-week outbound publication manifest

State: controlled canary and widening completed at 18:04–18:05 UTC after PR36's
production deployment `390dae9` / `dpl_DvfxY6H3bNESQvQByoHMQvgVemJN` was verified.
The final 17:58 encrypted backup restored 33 tables / 63,132 rows with exact digests.
All 195 values match independently; all 143 predecessor revisions are present and
unrelated/history rows, legacy facts and assignments remain unchanged. Live canary
display and 10,275-byte CSV match all five values, timezone and duration labels.
This is not scheduled execution. The new production policies remain absent.

## Scope and definition

39 currently active, uniquely source-bound POS employees; September 27–October 3,
2026, America/Chicago. Five keys: `outbound_calls`, `outbound_calls_completed`,
`outbound_calls_non_answered`, `avg_talk_time_outbound`, `avg_hold_time_outbound`.
Use the already qualified `zendesk-call-created-agent-leg-outbound-v1` contract:
distinct participating calls, current linked-ticket group scope, explicit completion
classification and employee agent/supervisor leg duration numerators with separately
measured denominators. Reported zero remains zero; no measured sample remains null.
Do not inherit incompatible target or prior-version comparisons.

The retained source observation collected at 17:51 UTC independently qualifies all
62 Menufy/POS employees. Five missing parents are outside every eligible employee's
agent/supervisor legs; none are omitted from an eligible employee calculation.
Independent reconstruction matched 1,054 numeric/duration fields and 1,860 exact sets,
zero differences. Freshness must still pass at publication; do not reuse an expired
observation. Raw identities, records and reference values remain private.

The isolated restored-copy POS rehearsal wrote 195 independently matching values.
Identical replay wrote zero; unrelated and historical metric rows remain identical.
The source publisher/atomic revision path is unchanged from the qualified outbound
release; final application CI remains a deployment gate.

## Controlled steps

1. Verify the deployed production SHA/alias, compatible schema and no active conflicting
   source run. Require the fresh encrypted backup and matching isolated restore.
2. Recheck all 39 current source/employee/team/assignment bindings. Select one nonzero
   qualified employee for a five-value canary. Before writing, privately save predecessor
   values and checksum unrelated metrics, legacy facts, assignments, targets and roster.
3. Publish the canary through the normal atomic sync service using its reviewed retained
   records. Forbid vendor requests during this operation. Verify all five stored values,
   calculation version, source run and every predecessor revision against the independent
   reference; verify all unrelated checksums unchanged.
4. Only after the canary passes, publish the remaining 38 employees / 190 values and
   repeat those checks. Inspect a scoped production view/export. Record controlled
   execution honestly; this is not scheduler evidence.

No environment policy or automatic collector activation is included. Menufy, earlier
periods, inbound/ticket/CSAT/first-reply values, targets and assignments remain unchanged.
Human ticket counts, action shadow ingestion, action-v2 publication and historical repair
remain disabled. Zendesk remains GET-only.

## Recovery

Use the final validated release backup plus per-operation retained predecessors/revisions.
On unexpected writes, mismatches or failed scope checks, stop before widening. Restore
only affected values in a separately reviewed transaction after checking for newer writes;
never overwrite the entire database. Application rollback alone does not revert data.
Do not claim full-contract certification: genuine scheduling and compatible target
qualification remain unresolved even after successful current-week publication.
