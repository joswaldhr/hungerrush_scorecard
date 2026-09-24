# Action metrics version 2 â€” shadow contract

Work proceeds in the recommended action-based direction following the user's continuation
instruction. These readers calculate comparisons only. Existing definitions, values,
assignments, targets, and production sync remain unchanged.

## Counting policy

The user selected **verified human activity only** on September 24. Uncertain attribution
must be unavailable, never credited to an employee or substituted with zero. This supersedes
the actor-only exploratory totals below, which are retained as historical diagnostics.

The active publisher still lacks human attribution evidence. The September 24 manager
read policy therefore withholds both ticket metrics from current/comparison values, status,
exports, stored-period views and retained revision displays. `unverified_attribution`
explains the unavailable state. No metric values, raw observations, targets, calculation
versions or revisions are rewritten. This is containment, not version-2 activation; even
a higher calculation version cannot bypass it. Other source strategies and metric keys
are unaffected. Removing this guard requires a validated source-bound human-only publisher.

Ticket updates count distinct tickets with a verified human field change or comment-presence
event by an explicitly eligible updater within half-open UTC instants. Resolutions count distinct
tickets transitioning from new/open/pending/hold to solved. Repeated resolutions by the
same actor count once per interval; two actors may each receive a count for one ticket.
Closing a solved ticket and creation already in solved status do not count. Unknown prior
status makes that actor's resolution count unavailable. Partial coverage makes all counts
unavailable rather than zero. Subjects, comment bodies, and custom fields are stripped.

The summary contract is now `zendesk-ticket-actions-v2-human-only-shadow`. Attribution is
reviewed per child event, because manual activity and automation can share an audit.
Verified nonhuman changes are excluded. A relevant child without reviewed evidence makes
the actor's updated count unavailable; an unresolved solved transition also makes their
resolved count unavailable. An unrelated uncertain comment does not invalidate an otherwise
verified resolution. Partial counts are never presented as complete totals.

The optional trusted offline review input binds review UUID, audit/event ID, child ID, ticket
ID and actor ID. Mismatches and duplicate decisions fail closed. Callers must additionally
bind the review to the same source and immutable observation before supplying it. No live
review producer or approval endpoint exists yet; the probe supplies no reviews and cannot
certify employee totals. Agent/admin role, matching email, updater/author ID and `web` channel
alone are not accepted as proof of human activity. The retained export/checkpoint schema is
unchanged; old observations are not silently upgraded to reviewed evidence.

Zendesk documents that individual events can override the audit's `via` and that business
rules generate events: [audit event reference](https://developer.zendesk.com/documentation/ticketing/reference-guides/ticket-audit-events-reference/).
This supports child-level review; it does not establish a universal automatic human classifier.

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
  than current assignee but does not prove manual human action. Implement source/observation-bound
  review provenance before providing verified-human decisions to the summary function.
- Join legs to calls for direction and define transfer, consultation, acceptance, and
  hang-up eligibility. Preserve leg versus distinct-call grain explicitly.
- Reconcile a closed week independently and implement sustainable incremental checkpoints.
- Introduce separate effective version-2 definitions, assignments, and reviewed target
  applicability before rollout or historical replay.
- Treat handling effort, elevated work, and response/CSAT denominators as separate contracts;
  elapsed resolution time is not agent handling effort.

The new readers are not imported by the active connector. The probe has no database imports
or writes and requires an explicit day and output path.

## Durable ticket-event checkpoint implementation

`ticket-action-checkpoint.ts` adds a separate database-backed shadow workflow, not used by
the read-only probe above. One invocation fetches one page. Existing `source_records` stores
the cursor and minimal events under separate versioned shadow namespaces; no schema change
is required. Each fixed UTC interval has its own checkpoint. Events are namespaced by that
checkpoint, so distinct observation runs/intervals do not overwrite one another's evidence.

Events and continuation commit in one transaction. An optimistic state comparison under a
checkpoint row lock discards stale competing responses. Conflicting immutable events fail
without moving the cursor. Readers expose no cohort until the end watermark covers the
requested interval; incomplete source boundaries remain waiting. Reads do not create rows.
The implementation detects pagination cycles across invocations and strips private content
before persistence. Source ownership is checked before fetch and inside write transactions.

Use `zendeskGet(path, undefined, { deferRateLimit: true })` as the page callback for a bounded
worker. A 429 then returns a typed retry delay immediately; the checkpoint persists the
retry time and refuses early requests without sleeping. Other failures leave progress
untouched and propagate to the caller. The existing connector's retry mode is unchanged.

This is checkpoint storage and a one-page worker primitive, not an activated scheduler.
Concurrent fetches may still spend two API requests even though only one response commits.
The hosted worker route now claims a source-level six-minute lease before selecting work.
Concurrent route triggers return `busy` and a retry time without fetching vendor pages.
Expiry uses database time, and cleanup is token-conditional so an old owner cannot remove
its successor's lease. Direct checkpoint primitives still require caller coordination.
Scheduler/retry ownership, retention/cleanup, immutable employee
mapping and automation attribution, and hosted restart tests remain before activation.
No production checkpoint/event writes or metric publication were performed during testing.

## Call-leg checkpoints and bounded worker

Call legs now have a separate durable checkpoint. Each observed revision is retained;
older arrivals cannot replace the newest revision and contradictory equal timestamps fail
without advancing. Only closed intervals older than two minutes are accepted. A completed
checkpoint is a fixed observation, not a promise that the vendor will never correct a leg.

`/api/cron/action-shadow` authenticates with a dedicated `ACTION_SHADOW_SECRET` when set,
otherwise `CRON_SECRET`, before reading configuration or data. A dedicated shadow credential
does not grant access to the existing publication cron route. `ACTION_SHADOW_SOURCE_ID`
explicitly selects one Zendesk source belonging to the
configured Zendesk account. Leaving it unset disables the worker. The route derives the
organization from that source and never publishes metrics or advances production freshness.
Each request allows six page attempts within a 200-second budget, reserving 35 seconds for
the next request/commit. Retries persist their earliest next request time. Completed streams
are skipped; an unfinished daily pair resumes even if one stream has not initialized yet.
After downtime, closed days catch up sequentially. First activation starts the latest closed
UTC day; historical backfill needs an explicitly selected earlier checkpoint.

This account uses Vercel Hobby, whose cron jobs run at most daily. No unsupported frequent
cron schedule was added. Activation needs a supported scheduler, a real authenticated hosted
trigger/restart rehearsal, source-account binding verification, retention policy, and
monitoring of incomplete days. No plan upgrade or hosted activation has occurred.

## Current identity evidence

The September 24 read-only census found 97 source-scoped Cadence mappings, all email-based,
with no verification timestamps, stored numeric IDs, cross-organization rows, or duplicate
employee/source pairs. Exact-email searches at Zendesk matched 73 accounts and found no
match for 24. All 62 currently active Cadence employees matched active, unsuspended Zendesk
agent/admin accounts. No ambiguous or duplicate numeric-ID matches were observed. Across
all matches, one account was suspended and one was an end user. These counts can overlap.

`zendesk-action-identity.ts` verifies all search pages before accepting one exact match,
rejects contradictory versions and incomplete pagination, and strips unrelated personal
fields. The read-only census script retains only aggregate counts in its report. It does
not update identity verification timestamps or persist numeric IDs. Source `verified`
describes email verification; it does not establish human ownership or manual activity.
See the [Zendesk users contract](https://developer.zendesk.com/api-reference/ticketing/users/users/).

The retained September 23 daily export was checked again on September 24 without
refetching tickets or calls: all 1,729 distinct positive actors resolved exactly across
18 GET requests, with zero missing, duplicate or unexpected results and no rate limits.
This does not establish the cause of the separate September 13â€“19 weekly lookup failure.
The shared batch verifier now reports those three failure categories as aggregate counts
and withholds eligible IDs on any incomplete/inconsistent batch. The weekly failure report
retains those counts rather than only a generic error. No unresolved actor is treated as
an end user or automation.

`probe-retained-action-actors.ts` uses an explicit read-only loopback connection and the
existing completed export. On a missing-only response it may compare the documented
`include_deleted=true` option, which includes inactive/deleted accounts; it does not infer
which condition applies or certify historical roles. That fallback was not needed in this
daily census. The aggregate report is `2026-09-24-retained-action-actors.json`.

Historical eligibility and automation attribution remain unresolved. A frozen observation
of today's matching accounts must not be presented as a historical employee-role snapshot.

### Bounded attribution census â€” September 24

The read-only `probe-action-attribution.ts` sampled the first 100 incremental events from
16:29:56 UTC and at most 12 audits belonging to current agent/admin actors. All 43 requested
accounts were returned in this sample; this does not resolve the separate full-week lookup
failure. All 41 candidate child changes matched the independent audit endpoint by child ID
and type, with parent audit/ticket/actor/time also matching. Of these, 25 carried `rule`,
seven `api`, seven `web`, one `system` and one other channel. Twenty-six children had explicit
via overrides. Four parent audits were `web`, seven `api` and one other.

These are channel-evidence counts, not verified human counts, employee totals or a
representative sample. The probe made 14 GET requests and no database writes; its report
retains aggregate counts only. See `2026-09-24-action-attribution-sample.json`.
[Zendesk's via reference](https://developer.zendesk.com/documentation/ticketing/reference-guides/via-object-reference/)
documents the rule channel and trigger/automation relations. The live presence of child
overrides confirms that parent-level attribution alone cannot implement the chosen policy.

## Explicit re-observation policy

Completed exports stay immutable. To inspect late arrivals or corrections, callers supply
a fresh UUID `observationId` on the same source and UTC interval. This creates separate
checkpoints, records, and revisions. Retrying that UUID resumes its existing work; using a
new UUID starts a new observation. The routine daily selector excludes re-observations, so
an unfinished correction cannot interfere with normal catch-up. There is no public trigger
parameter or automatic publication for these observations.

`compareActionObservation` compares a completed re-observation against the initial export.
It returns unavailable comparison data until both ticket and leg exports are complete.
Added, removed, and changed source IDs are internal evidence; public rehearsal reports
retain counts only. Even an empty difference remains review-required. A missing record is
not automatically a deletion correction, and original metric values are never rewritten by
this path. The eventual publication policy must bind reviewed observation and definition
versions explicitly. Retention must keep observations referenced by published evidence.

A September 24 live re-observation of September 23 resumed across four local processes,
including one persisted 429 delay. It matched all 11,954 ticket events and 2,532 call legs
from the earlier local observation with zero additions, removals, or changes. No normalized
facts were written. See `2026-09-24-action-reobservation-batch-4.json`.

## Immutable identity observations

`captureActionIdentitySnapshot` is an offline capture primitive, separate from the hosted
worker. An explicit observation UUID retains exact source-account matches, current roster
status, and per-match observation times. Raw emails, names, and phone numbers are omitted;
the snapshot retains an email hash plus the internal employee/identity and numeric account
IDs needed for provenance. Missing and ambiguous accounts remain explicit members.

The capture saves nothing on vendor failure, duplicate account mappings, or roster changes
during collection. Source and employee ownership are checked, the final inventory is
rechecked under locks, and concurrent captures return one immutable winner. Reusing the
UUID reads the saved observation without re-fetching; a new UUID creates a new observation.
Capture is capped at 250 mappings, reserves source-request time, and is not a resumable
hosted job. Historical eligibility and human activity attribution remain explicitly unknown.

A live three-account rehearsal used read-only production mapping lookup and vendor GETs,
with all writes confined to synthetic loopback fixtures. All three matched; the saved
observation retained active status after the fixture roster was changed to inactive, and
retry performed no vendor requests. Sampled email fixture rows were removed afterward.
The retained report is `2026-09-24-identity-snapshot-rehearsal.json`.

### Hosted account and lease continuity

Before a hosted shadow request acquires a lease, the source must be configured, owned by
the selected organization, and have `configuration_reference = zendesk-account:<subdomain>`
matching the credential's validated API subdomain. This is non-secret account routing metadata,
not a credential or proof of human authorship. No metadata is inferred from display names.
Each checkpoint persists that reference. A missing/legacy or different reference prevents
resumption, including already completed checkpoints; account changes require a separate source.

Checkpoint creation, page commits and retry deferrals lock the source and verify its status,
account reference and current unexpired lease token. A source disabled/rebound during network
work, or a worker whose lease expires or is replaced, cannot advance the checkpoint. Offline
observation tools are explicitly separate and remain organization-scoped; existing production
metadata and publishing behavior are unchanged by these shadow-only guards.


### Retained full-week account census — September 24

The September 13–19 cohort is now retained in a separate loopback-only observation, with
85,066 ticket events and 17,172 call legs. Across six bounded account processes, all 10,607
positive IDs were checked in 107 batches. One default lookup omitted an account; the
`include_deleted=true` diagnostic restored exact coverage for that batch. No duplicate or
unexpected IDs were returned. The original failed response was not retained, so exact
identity with that earlier omission is unproven.

This establishes current account coverage after the inclusive diagnostic, not historical
employee-role eligibility or human authorship. No eligible employee totals were published
and no human-only availability guard was relaxed. The detailed report and aggregate evidence
are `2026-09-24-weekly-retained-diagnostic.md` and `2026-09-24-weekly-retained-summary.json`.
