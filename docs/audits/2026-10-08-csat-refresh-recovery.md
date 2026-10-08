# CSAT fixed reporting periods and retry recovery

## Observed problem

The October 8 current-week CSAT run stopped at 08:35 UTC after `search/export`
returned HTTP 429 a second time. It had made 62 requests and the source reported
zero remaining account quota. The bounded retry allowance was exhausted; no values
were written. Current-week CSAT still has an October 6 observation. Increasing the
request rate or substituting zeros would not fix the reporting requirement.

The existing recovery dispatcher covers solved-ticket publication and ticket-event
collection only. It does not retry CSAT, first reply or Talk metric families. Its
presence must not be described as complete automatic recovery.

## Candidate correction

The CSAT route now pins the chosen Sunday–Saturday interval before cooldown/lease
work. The connector opts into the existing fixed-period sync contract and passes
those same dates through binding checks and source collection. Relative offsets
remain supported for existing internal callers. Fixed backlog periods can remain
valid after they leave the four-week planning window, subject to the unchanged
prospective policy. Malformed and future intervals are rejected. The route rejects
duplicate/extra week parameters rather than ambiguously choosing one.

The regression checks cross Sunday during asynchronous cooldown work and exercise
the real PostgreSQL source/employee bindings for an older fixed interval. Invalid
intervals never reach the source collector. Source transport is mocked in that binding
test; it is not a live-source reconciliation or hosted publication test.

No CSAT formula, attribution, metric assignment, source rate, retry allowance or
activation policy is changed. The new development branch has automatic Vercel builds
disabled, matching other isolated audit branches; use the existing separately
authenticated synthetic Preview for hosted acceptance. Production crons are unchanged.

## Remaining work to close automatic recovery

### October 8, 15:05 UTC implementation checkpoint

CSAT can now participate in the existing recovery dispatcher only when both
`ZENDESK_REPORT_RECOVERY=1` and the new `ZENDESK_CSAT_RECOVERY=1` switch are supplied,
along with the existing qualified CSAT policy. Neither switch has been activated.
Jobs bind to the exact policy and reporting dates. Failed syncs return an allowlisted
429 retry timestamp; persisted retry deadlines never shorten a valid vendor delay to
the queue's own backoff. Inactive policy payloads are not decoded by the current
worker, but their active account leases still prevent concurrent ownership.

All 1,216 local tests / 151 files, typecheck and scoped lint pass. Real PostgreSQL
checks cover prior-value preservation, durable CSAT dates, delays longer than one day,
and unknown inactive job kinds with active leases. Route tests enforce both switches.
Worker tests cover removed policies and saved dates outside the planning horizon.
Source transport in these tests is synthetic; no live recovery is implied.

Before activation, install this compatible worker as the rollback baseline. Older
workers do not understand CSAT jobs: reverting below this baseline requires keeping
both recovery switches off, without deleting queued evidence. No schedule, credential,
employee assignment, formula, source request budget or production setting changed.
Hosted rehearsal, exact CI/build, capacity, activation and real recovery remain open.

1. Validate exact candidate CI/build and a synthetic hosted fixed-period publication.
2. Extend durable work to CSAT with policy-bound jobs, persistent retry-after/backoff,
   unchanged source pacing, exact period retention, and last-good-value preservation.
   Preserve compatibility when an older dispatcher encounters new job kinds; do not
   make rollback depend on deleting queued work.
3. Verify deferred requests, account contention, interrupted owners, late completion,
   policy removal and post-Sunday resumption against real PostgreSQL and hosted behavior.
4. Include all metric families and current source volume in scheduler capacity; the
   existing solved-only model is not a full-application capacity proof. The hosting
   plan/scheduler decision remains separate from code implementation.
5. After release gates and a fresh restore rehearsal, recover the actual failed period
   through one labeled controlled run, reconcile values and denominators independently,
   then observe genuine unattended recovery. A manual success alone does not close it.

Zendesk stays read-only and the demo remains frozen. The complete two-team metric,
roster/access and export goal remains unchanged.
