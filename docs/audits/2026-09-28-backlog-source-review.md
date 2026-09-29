# Backlog source review

Bounded read-only review on September 28, 19:07:51–19:08:36 UTC. No production or
Zendesk writes, report editors, scheduler changes or historical repair were performed.

The deployed producer counts currently assigned unsolved tickets across all groups,
only while the reporting period is current. Its preserved historical values are snapshots,
not a reconstructed week-end backlog. This matches the existing contract audit's S5.
The read-only production census found 39 active POS employees with backlog assignments.
Nullable assignment effective dates were handled using the application's existing semantics.

Fresh active staff identities matched all 39 retained bindings. Fifty allowlisted GETs
completed in 45.5 seconds, retrieving 620 distinct unsolved tickets through cursor search
and checking those same IDs independently through ticket details. An independent Python
comparison performed 1,978 set/membership/arithmetic checks with zero differences. Both
methods agreed on assignee, status, group and source update timestamp for every ticket.
The observation spans a bounded window; it is not an atomic account-wide snapshot.

All 39 production backlog counts match their retained source-ID sets exactly. Fifteen
employee sets still match this later observation, while 24 have changed since the stored
observation. These later changes are not evidence of an incorrect earlier calculation.
Stored freshness ranges from September 27 06:11 to September 28 06:11 UTC; unchanged
payload replay can preserve an older accepted observation. A later check timestamp is
not interchangeable with the retained metric's observation timestamp.

There are 109 tickets outside the retained POS Talk group filter. That filter belongs
to call participation and is not a backlog filter. Applying it here without establishing
a different backlog definition would change the current measure. The current population
contains open, pending and hold tickets; statuses and aggregate evidence are in the
adjacent JSON report. Employee identifiers and ticket IDs remain in private ignored storage.

This investigation establishes a fresh source/reference population and separates elapsed
source changes from arithmetic defects. It does not publish the 620-ticket observation,
certify every historical snapshot, accept new targets, or establish a new refresh SLA.
Production arithmetic coverage stays 14/40 and full-contract certification stays 0/40.
Any dedicated backlog refresh must retain its exact source sets and observation window,
pass scoped persistence/hosted/recovery gates, preserve other families and earlier periods,
and verify scheduled freshness independently. No full sync was triggered to manufacture
scheduler evidence or to refresh unrelated metric families.
