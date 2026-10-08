# Outbound completion and fixed reporting dates

## Released scope

PR52 merged as `e05014d`, with candidate CI `37816569630` and master CI
`37817465729` passing. Production `dpl_7H7P3nGE9kLCr9FhdgrowrtCwBE1` is READY
and owns the live alias. The runtime-identical isolated Preview passes its synthetic
three-period publication rehearsal. A separate controlled refresh published 285 values
for 57 employees for September 27–October 3; five employees remain excluded and
recurring outbound publication remains inactive. See the scoped-refresh record and
aggregate production/publication receipts. The candidate requirements below record
the pre-release investigation; they are not the current deployment state.

## Fixed-period behavior

The outbound route now resolves the Sunday–Saturday selection before asynchronous
cooldown checks and passes exact dates to the sync engine. The connector accepts
validated fixed periods, including a delayed completed week. Parent-call recovery
matches both stored period boundaries instead of a relative week offset. Older
offset-only failures safely refresh both streams. A successful publication of a
different week cannot suppress recovery for the selected week.

This is a code-only prerequisite. Formulas, source pacing, freshness limits,
assignments, policies, schedules and the frozen presentation demo are unchanged.
The candidate branch is excluded from automatic Vercel deployment; any hosted
rehearsal must use the existing isolated main Preview. No new publisher is enabled.

## Report evidence

For September 27–October 3, the saved POS outbound report selects 11 ticket groups;
the previous outbound policy selected six. Essential read-only inspection captured
the existing definition and selections, with no changes; the editor was promptly
closed and its closure verified. The report uses distinct outbound calls by leg
agent and Call-Date. All 11 selected names resolve uniquely in the retained source
group inventory. Private group IDs, employee rows and downloaded reports are not
committed.

Replaying the exact scope reduces POS discrepancies from 17 of 35 populated report
rows to one. Its three calls belong to two tickets that moved out of the selected
groups on October 8. Two Menufy employee discrepancies are exactly one completed
call each (seven and 36 talk seconds), both linked to a ticket that moved into scope
that morning. Bounded read-only ticket audits establish those changes. This is
evidence consistent with different source observation times; the report's exact
ticket-dimension refresh time is not established. Do not rewrite live ticket state
or claim an identical report snapshot to force agreement.

Eight employees have no row in these exports. Absence is not a verified zero.
An older Talk capture joined to newer ticket metadata is diagnostic only and
exceeds the one-hour publication window. A new bounded collection and independent
source-set replay are required before publishing corrected values. Source
collection, code deployment and metric publication remain separate operations.

## Validation and release gates

Local typecheck and ESLint pass. All 1,222 tests in 151 files pass, including real
PostgreSQL recovery tests, Sunday rollover during cooldown, delayed fixed periods,
invalid/future intervals and source rejection before requests. The Windows checkout
has pre-existing CRLF formatting differences in 277 untouched files; changed source
files are formatted. Exact Linux CI/build remains a required release gate.

Before merge: inspect the exact diff, pass exact CI/build, verify the isolated
Preview as applicable and recheck the validated backup is under one hour old.
Code rollback is production deployment `dpl_ESQbmcCHbZVdN6m5znLqf15SK1HQ`,
master `b833e68c9f1d10526b9b081342fda04bd9f2368e`. Keep outbound policy inactive.
Verify the resulting production SHA/alias, core reads and disabled/authenticated
route behavior without triggering a source sync just for smoke evidence.

Corrected data needs its own manifest, exact team/key/period scope, fresh joined
source evidence, independently reconstructed sets and denominators, atomic normal
publication, retained predecessors and unchanged unrelated-data digests. Recurring
activation additionally requires multi-period qualification and actual scheduler
evidence. Full scorecards, ticket-update credits and unattended recovery remain open.
