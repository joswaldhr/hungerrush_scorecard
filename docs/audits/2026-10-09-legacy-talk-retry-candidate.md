# Legacy Talk retry candidate — October 9

This candidate is local code, not a recovered production run or activated collector.
The October 9 morning evidence still records current-week account contention at
06:00 and an oldest-week rate-limit failure at 06:45, both with zero metric writes.

## Proven defect and scoped correction

Legacy Talk raises `SourceRetryLaterError` for a vendor or retained source cooldown.
`runSync` previously extracted retry dates only from `SourceFetchError` diagnostics.
The dispatcher therefore received a failed result without the exact source delay and
used generic queue backoff. The Talk store still prevented early vendor requests, but
those avoidable attempts consumed dispatcher opportunities and sync bookkeeping.

The candidate preserves the typed delay in `runSync.retryAt`. Existing failed-run
handling, zero writes and last-good publication remain unchanged. It does not turn
an interrupted observation into successful publication or alter source definitions.
The ordinary structured HTTP-429 diagnostics path remains supported.

Legacy recovery additionally requires the separate `ZENDESK_LEGACY_TALK_RESUME=1`
opt-in. Missing configuration fails before enqueue, instead of repeatedly restarting
whole-week Talk scans. Both switches remain default-off; this patch sets neither.
The original direct daily path remains unchanged when recovery is disabled.

## Retained performance evidence and capacity limits

No new production or vendor reads were used for this investigation. The retained
morning run evidence contains two successful non-resumable legacy observations:

| Weekly offset | Talk pages / requests | Talk elapsed | Total fetch elapsed |
| --- | ---: | ---: | ---: |
| 1 | 16 / 16 | 105,864 ms | 184,614 ms |
| 2 | 24 / 24 | 161,436 ms | 247,323 ms |

These are successful historical timings, not resumable throughput measurements.
The oldest-week failure took 206,416 ms before failing and supplies no completed
page-count evidence. In particular, 247 seconds for fetch alone leaves limited
headroom within the hosted 300-second invocation; publication time also counts.

The retained conservative model leaves 30 daily opportunities after modeled
collisions and a six-hour outage. Existing report work plus roster is 19; adding
four legacy successes gives a lower bound of 23, leaving seven opportunities for
all additional legacy continuations/failures under those assumptions. Adding all
optional families requires at least 31, so that configuration still fails.

Direct cron delegation removes duplicate source collection, but the current model
conservatively retains those collision allowances. Do not convert that potential
saving into a claim of available throughput without invocation evidence. Nor does
one page equal one job: a resumed job must still finish ticket reads and publication.

## Verification and next controlled gate

Focused local verification uses only the isolated loopback test database. Coverage
includes a retained two-hour Talk delay through `runSync` with unchanged values and
freshness; a throttled resumed page retaining its exact weekly cursor and records;
a later attempt blocked before a source call by the stored cooldown; config/cron
rejection before enqueue when resume is absent; and existing fixed-period queued
retry, ownership, acknowledgment and long-delay regressions.
All 99 focused tests across seven files pass, along with TypeScript, scoped ESLint
and formatting. Exact candidate CI and hosted verification remain release gates.

Before activation, pass exact CI/build, independently review the candidate, and use
a fresh verified backup. Qualify one fixed reporting period with bounded collection,
retained page progress, independent source comparison, unchanged protected data and
exact readback. Record total invocation and publication duration, pages per attempt,
quota wait, persisted retry date and scheduler attempts needed to drain demand.
Recalculate capacity from those observations before adding optional families.
The two failed morning runs are not declared recovered by this code change.

No metric formulas, employee assignments, Zendesk configuration, demo data, cron
cadence, or qualified publication policies change. There is no schema migration.
Rollback is the preceding compatible code deployment with both optional legacy
flags unchanged; if activated later, disable legacy recovery separately and review
the direct-daily fallback and its capacity before removing resumable collection.
