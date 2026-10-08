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
