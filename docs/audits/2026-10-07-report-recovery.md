# Durable report refresh recovery

Status: candidate `29208067ce83b19be0c73da0bdc6c0852cc4b66f` in draft PR48; exact
Linux CI/build `37689610074` passes. No production scheduler or recovery switch is
enabled. The previous coordination release remains the verified live runtime.

## Failure being corrected

An hourly hosting window can collide with an existing source sync or cooldown. The
host does not guarantee a retry; a failed request otherwise loses the day's work.
Resuming a stored relative `week=1` after Sunday could also select a different week.
The observed peak day contains 14,219 report events, more than one observed ten-page
collection invocation. A timetable alone is therefore insufficient.

## Candidate behavior

- The solved route pins its exact UTC Sunday–Saturday dates before asynchronous work.
  The common sync service carries those dates through its lease, connector and run
  metadata. Only opted-in connectors accept fixed periods. Vendor report timezones,
  cutovers, source semantics, freshness checks and transaction/revision rules remain.
- Absolute period leases conflict with the same period. During deployment overlap,
  an absolute lease conservatively conflicts with any legacy relative-week lease for
  that source, in both acquisition orders. Different absolute periods remain separate.
- Operational jobs live in the existing `source_records` namespace
  `zendesk_report_job_v1`; they are never normalized into employee metrics. Each job
  binds its source/account, exact period and qualified policy digest. No schema
  migration is required. A changed or removed policy cannot claim old-policy work.
- Repeated deliveries coalesce into the newest requested observation. Acknowledgment
  completes only the generation actually claimed; a newer request remains pending.
  A ten-minute database-time lease fences late workers and permits recovery after a
  terminated invocation. Ownership is serialized per Zendesk account across sources.
  Attempt records link to the ordinary publication sync run or aggregate page count.
- Cooldowns and partial collections persist a retry time. Failures back off from five
  minutes up to six hours. Incomplete jobs retain their original period even after it
  falls outside the new four-week planning window. Successful prior metrics remain
  intact; recovery never substitutes zero or silently changes a source definition.
- One authenticated `/api/cron/report-recovery?slot=0..23` tick attempts at most one
  bounded job. Its independent `ZENDESK_REPORT_RECOVERY=1` opt-in is absent by default.
  It requests collection on six-hour UTC boundaries and daily publication of current
  and three prior weeks, subject to each policy's effective date. Missed deliveries
  are recovered from persisted demand at a later tick, not recursive/background HTTP.
  Collection continuation is prioritized; equal publication demand favors last week's
  review. The existing full-week date keys and source timezones are unchanged.

The current candidate requires its solved policies and collection to share one source
and account, matching this release's verified production configuration. It does not
claim to coordinate unrelated vendor clients or enable all integration families.
The slot parameter selects a planned daily wake-up identity, not an employee or period.

## Validation and release gates

The initial focused run passes 63 tests across six files, including real PostgreSQL
duplicate-delivery races, cross-source ownership, expired/late acknowledgments, newer
demand arriving during a run, deferred/failing work, policy removal and source changes.
Actual solved publication tests cover pinned dates, explicit-period run metadata,
calendar changes during fetching and unchanged values on failed publication. The local
full run passes **1,162 tests / 144 files**. Typecheck and targeted lint pass. A subsequent
small attempt-diagnostics addition passes typecheck and the 20 focused worker/store tests;
exact Linux CI/build `37689610074` subsequently passed on `2920806`, including full
tests, migrations, source guards and production build. The PR is unmerged. Hosted
dispatcher/recovery and activation gates below remain open.

Fresh read-only measurement over eleven fully retained UTC days raises the peak
rolling-day demand to **15,273** events, versus the calendar-day maximum 14,219.
Peak six-hour, twelve-hour and five-minute windows contain **8,213 / 13,620 / 377**
events. A missed six-hour collection window needs continuation beyond one observed
ten-page invocation. Use these bursts, overlap and late-arrival allowance for capacity
testing; daily averages alone would understate the requirement. The timestamp density
does not prove delivery-time demand or a future quota guarantee. See
`2026-10-07-report-recovery-capacity.json`.

Before any activation:

1. Finish review, full CI/build and a runtime-identical isolated synthetic hosted
   rehearsal. Verify the independent opt-in is absent in ordinary Preview builds.
2. Exercise the complete persisted dispatcher/collection/publication path, crash and
   resumed acknowledgment, and fixed-week behavior across rollover. Distinguish mocked
   transport tests, real PostgreSQL tests, hosted rehearsal and production evidence.
3. Qualify capacity against measured daily volume plus overlap, late arrivals and a
   missed collection window. Model the existing 16 jobs and hourly jitter/cooldown
   collisions. The proposed 24 daily wake-ups are a candidate, not an installed or
   proven freshness SLA. Do not loosen source throttles to make the model pass.
4. Take a fresh encrypted backup and verify isolated restoration/digests. Record exact
   production, policy and rollback identities. Run a labeled scoped canary, then
   independently reconcile values, predecessor revisions and unaffected rows.
5. Only then install the reviewed timetable and opt-in. Observe actual scheduler user
   agents, invocation outcomes/durations, queue backlog/age and source observations.
   Successful manual recovery does not establish scheduled operation.

Existing solved/collection policies stay separately controlled. CSAT/first-reply,
human-action shadow/v2, historical repair, assignments, targets, Zendesk and the demo
remain unchanged. The full metric acceptance matrix remains open.

## Containment and rollback

Clear only `ZENDESK_REPORT_RECOVERY` and redeploy to stop new dispatcher work. Preserve
jobs, cursor history, source evidence and last good metric values. In-flight work may
continue until its bounded invocation ends; verify active leases and sync runs.
An application rollback to the recorded coordination deployment remains schema-compatible.
Older code ignores the new operational record namespace. Verify the selected deployment's
cron definitions and active policies after rollback; do not reset the source cursor or
restore the whole database to undo a scheduling change.
