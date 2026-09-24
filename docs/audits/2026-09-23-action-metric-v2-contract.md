# Action metrics version 2 — shadow contract

Work proceeds in the recommended action-based direction following the user's continuation
instruction. These readers calculate comparisons only. Existing definitions, values,
assignments, targets, and production sync remain unchanged.

## Counting policy

Ticket updates count distinct tickets with a field change or comment-presence event by an
explicitly eligible updater within half-open UTC instants. Resolutions count distinct
tickets transitioning from new/open/pending/hold to solved. Repeated resolutions by the
same actor count once per interval; two actors may each receive a count for one ticket.
Closing a solved ticket and creation already in solved status do not count. Unknown prior
status makes that actor's resolution count unavailable. Partial coverage makes all counts
unavailable rather than zero. Subjects, comment bodies, and custom fields are stripped.

The reader validates counts, watermarks, completion metadata, and event identity. Identical
boundary repeats are deduplicated; contradictory copies, stalled pagination, missing
continuation, and exhausted budgets fail. A watermark reaching the exclusive end completes
the interval; earlier end-of-stream is partial coverage.

Agent legs retain minimal identity, timestamp, status, and duration evidence. Latest-per-ID
selection and the Talk repeated-boundary guard apply. Customer/external/supervisor legs do
not enter agent measures. Completed, missed, declined, transfer-declined, and unreachable
legs remain separate. Completed-leg talk time retains sum/sample count, including zero;
no samples remains null. Leg counts are not automatically calls offered/accepted and do
not inherit current call-count targets. Current-day cohorts remain provisional.

## Verification

Primary references: [ticket events](https://developer.zendesk.com/api-reference/ticketing/ticket-management/incremental_exports/),
[call legs](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/),
and [ticket audits](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_audits/).

Read-only schema sampling confirmed both endpoints; the sample included an agent_missed
leg. The September 24 UTC shadow probe covered midnight through 00:40:00.337Z for tickets:
657 events, 177 summed agent-distinct updated-ticket counts, 120 summed agent-distinct
resolved-ticket counts, and 353 events excluded by actor scope. These sums are not
organization-distinct ticket totals. Three sampled resolutions matched the separate audit
endpoint on actor, time, and status transition. The call-leg fetch contained 69 records and
24 completed eligible-agent legs, with a different fetch-time cutoff. Eight requests
completed without rate-limit waiting. See `2026-09-24-action-shadow-probe.json`.

This is a small current-day check, not full-week reconciliation or a runtime SLA. Reports
contain aggregate counts, not identities, source IDs, phone numbers, comments, or secrets.
The probe checks current Zendesk agent/admin roles, not Cadence employee identity mappings.

A subsequent complete September 23 UTC day returned 11,954 ticket events in 13 pages and
2,530 legs in four pages. Summed agent-distinct ticket counts were 3,336 updated and 1,383
resolved; 5,435 events were outside eligible actor scope. Leg counts included 881 completed,
14 missed, one declined, and one unreachable. All three sampled resolution audits matched.
The probe made 39 requests including identity checks and audits, with one 429 response and
46 seconds of backoff. See `2026-09-23-closed-day-action-shadow-probe.json`. This demonstrates
closed-day availability but also confirms the need for persistent incremental checkpoints
before adding weekly event ingestion to a bounded hosted request. It is not a complete
independent metric reconciliation or a certification of manual employee attribution.

## Before activation

- Freeze source-specific employee mappings and historical eligibility.
- Verify automation/service-account attribution. An audit updater is stronger evidence
  than current assignee but does not prove manual human action.
- Join legs to calls for direction and define transfer, consultation, acceptance, and
  hang-up eligibility. Preserve leg versus distinct-call grain explicitly.
- Reconcile a closed week independently and implement sustainable incremental checkpoints.
- Introduce separate effective version-2 definitions, assignments, and reviewed target
  applicability before rollout or historical replay.
- Treat handling effort, elevated work, and response/CSAT denominators as separate contracts;
  elapsed resolution time is not agent handling effort.

The new readers are not imported by the active connector. The probe has no database imports
or writes and requires an explicit day and output path.
