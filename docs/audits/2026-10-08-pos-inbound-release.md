# POS inbound release manifest

## Released state

The scoped current-week publication is now live at `bc8e26e`, deployment
`dpl_5H9MubkMyqtAbEVjZ3QUbkbyXdbR`. All 195 values for 39 employees independently
match, with protected data unchanged and representative history/CSV/PDF/PNG acceptance.
See [the production receipt](2026-10-08-pos-inbound-production.json). The manifest
below records the pre-release decision and evidence; its pending-state statements are
historical. Closed periods, declined/missed assignments and recurring operation remain
open. Compatible post-publication code rollback is `dpl_Adh9HwzB3mGcZcF14e28efydrjgv`
(same qualified code, POS policies absent), with scoped data recovery only after
checking for newer writes. The older legacy deployment is not a safe blind rollback.

## Scope and pre-release state

This release corrects the POS accepted-leg count and four inbound means to the
saved manager report's leg-created-date, Central-time, exact-group contract.
Whole-call hold is weighted once per selected leg. Zero measurements remain zero;
an absent duration sample remains unavailable with its denominator explanation.

Runtime candidate `7403b7821be4abd8779f4221e4529bb1ddff7f56` passes exact CI/build
`37730891112` and all 1,205 local tests. Runtime-identical isolated Preview `0e71f92`
is READY at `dpl_9bF2NGoCC8sy5m9J7xxwgyQ5CHsz`; its anonymous POS route returns 401. Authenticated disabled-route probing was not performed: a retained CLI env
file contains redacted placeholders, not a usable staging scheduler credential.
The six route tests cover authenticated inactive, invalid, pre-cutover and failed
publication behavior. Full publisher/collection and real export acceptance on the
preceding runtime is recorded in `2026-10-08-pos-inbound-preview.json`.

No production code, publication policy, new assignment or schedule has been changed
by this manifest. Current production is `8a88279fabd8bf8306f2b098184040553c4ad40b`
at `dpl_5LFAcRdxm6VbvAQsXobikfdMuPuK`.

## Fresh qualification

The October 8 05:11 UTC encrypted recovery copy restores all 35 tables / 355,355
rows with matching digests. It is Windows-user-bound recovery, not portable PITR.
The subsequent explicitly bounded production source collection made 11 GET requests
in 103 seconds, retained 7,548 changed call/leg versions, and exhausted both streams.
It changed no metric values, normalized facts, catalog, employees, assignments or
original Talk projection digests. See `2026-10-08-pos-refresh-collection-readback.json`.

Fresh staff census matches all 39 active POS employees uniquely. A fresh group census
matches the saved report's previously source-set-qualified 14 exact group names;
four retained rename aliases are not silently unioned into the report scope. The
first group pagination attempt stopped when the vendor continuation omitted the
explicit deleted-group filter; the corrected bounded reader preserves that filter.
No source writes occurred. These checks establish current identity and scope, not
historical employment eligibility. The documented group listing API is
https://developer.zendesk.com/api-reference/ticketing/groups/groups/.

Both September 27–October 3 and October 4–10 reconstruct all 39 employees without
blocked rows. The two account-wide missing parents affect none of these POS
employee-period cohorts. Independent Python matches 546 source sets and 390 duration
calculations. The actual qualified record wrapper independently matches 546 values,
390 source sets and 624 numerator/denominator checks, with zero differences. This is
fresh source reconstruction under the saved report definition, not a fresh same-cutoff
Explore export. September 13–19 and the retained monthly export remain separate
report parity evidence. The refreshed projection begins September 26 and cannot
establish a complete September 20–26 observation.

## Publication procedure

1. Integrate the reviewed code and fixed-period sync dependency, retaining disabled
   recovery/POS defaults. Check exact release CI, immutable production deployment,
   alias, protected reads and unchanged policy metadata before activation.
2. Refresh encrypted recovery and read-only bindings/baselines immediately before
   any metric publication. Stop if employee identities, assignments, scope, source
   freshness or protected-state digests differ unexpectedly.
3. Prepare a private, account/source/team-bound release policy and evidence hash.
   The initial proposed canary is the current October 4–10 period, all 39 POS staff,
   and the five existing assignments: `inbound_calls_accepted`,
   `avg_talk_time_inbound`, `avg_hold_time_inbound`,
   `avg_call_duration_inbound`, `avg_consultation_time_inbound`.
   No other family, closed period, target or employee assignment is in this canary.
4. Keep declined/missed publication disabled until compatible POS assignments have
   an explicit prospective effective date. They are independently verified calculations,
   not permission to backdate new scorecard rows. Track them as remaining scope.
5. Run one controlled canary through the normal atomic sync service. Retain dispatch
   intent and source/fact/value predecessors. Read back the exact published source
   evidence, independently recalculate every value and sample count, compare all
   unrelated-state digests, and inspect scorecard/history/export consistency.
6. Configure recurring operation only after compatible scheduler capacity and recovery
   are proven. A manual canary is not genuine scheduled evidence. Keep the full goal
   open for all other required measures, both teams and lifecycle/access checks.

No database migration is needed. Source collection is distinct from publication;
the source collection receipt above must not be described as deployed corrected values.

## Rollback and containment

Before publication, the existing production deployment above is the rollback target;
capture its current policy metadata privately. With the POS policy still absent,
code rollback needs no metric repair. After qualified publication, do not blindly
restore legacy code that could overwrite the corrected keys: first contain the POS
publisher and overlapping legacy writers, preserve revisions, and verify a compatible
rollback configuration. Restore only affected values from retained predecessors after
checking for newer writes. Never restore the whole database over subsequent work.

Zendesk stays read-only; the frozen demo, human-only ticket restrictions, CSAT/first-reply
policies, ingestion schedules and employee assignments remain unchanged in this release.
