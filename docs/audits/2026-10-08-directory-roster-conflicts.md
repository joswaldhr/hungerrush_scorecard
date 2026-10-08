# Directory roster conflict checks

## Change and source meaning

Cadence's current Zendesk group discovery cannot identify an offboarded account
that remains active in the source group. An October 5 retained directory observation
already contained one disabled account in the active Menufy cohort; the finding was
documented but never surfaced in a recurring review workflow. October 8 bounded
read-only checks confirm that conflict. The directory departure-date field is empty
for the reported case; employment termination and its effective date are unverified.

The candidate adds an independent Microsoft Graph account check for active Cadence
employees in one explicitly tenant-bound organization. Exact normalized mail/UPN
matching returns enabled, disabled, unmatched, ambiguous or missing-email states.
These are directory account observations, not employment decisions or historical
team authority. Manager/team-change detection and HR integration are not included.

The reader requests only ID, mail, UPN and accountEnabled. At most 100 employees,
15 Graph GETs, seven emails per query (14 filter clauses) and a single 60-second
deadline. Pagination, malformed results and out-of-scope accounts fail the check.
Microsoft returned a 15-clause filter limit during the initial read-only rehearsal;
the corrected batch size completes the current 62-person cohort in nine GETs.
See [Graph list-users documentation](https://learn.microsoft.com/en-us/graph/api/user-list?view=graph-rest-1.0).

## Persistence, visibility and safeguards

- A dedicated `entra` data source is bound to `entra-tenant:<tenant UUID>`; an
  explicit `ENTRA_ROSTER_SOURCE_ID` enables its worker. Credentials alone do not.
- Existing source-record storage holds latest check health and retained successful
  observations. No schema migration, employee/assignment/metric writes, directory
  mutations, Zendesk calls or source metric-freshness updates are made.
- A source lock, five-minute lease and 15-minute cooldown prevent overlapping
  publication; employee scope and source binding are rechecked before publication.
- Failures retain the last good observation. Failed, interrupted and over-36-hour-old
  states are explicit. Changed employee identity invalidates the old match.
- Administrators see organization-scoped results in Roster Review; managers see only
  assigned employees in Data Health, with a review notice in the 1:1 picker.
- No automatic archive, termination inference or employee removal is introduced.
  Reviewed dated team removal that survives rediscovery remains separate work.
- A six-hour schedule at minute 40 is independent of metrics jobs. Without the
  source opt-in it is inert. Existing 17 schedules and all metric policies stay intact.
- Preview disables the source opt-in and Graph secret. Hosted rehearsal uses only
  synthetic display fixtures. The frozen presentation demo remains separate.

## Validation and release status

Candidate only; not yet deployed or enabled. Initial 18 focused tests passed.
The first full-suite run found the existing source-capability test needed to retain
an unsupported-source fixture now that Entra has its own review panel; fixed before
release. Additional tests cover stale/failed display, source rebinding and superseded
leases. Exact final CI/build, hosted checks and fresh restore remain release gates.

Read-only source rehearsal: all 62 active employees resolve uniquely; 61 enabled,
one disabled; zero missing/ambiguous identities; no production or directory writes.
Only aggregate evidence is committed. Raw evidence remains private.

Activation requires a verified dedicated source, existing Graph credential/tenant
identity, fresh encrypted backup/restore and scoped pre/post digests covering employee
and membership rows. One controlled directory check must reproduce the read-only
baseline without changing those rows. That is not proof of a scheduled execution;
record the next genuine scheduled request separately.

Rollback: unset `ENTRA_ROSTER_SOURCE_ID` and redeploy or restore the preceding
production deployment `dpl_BzXwfPfMHumJzDgowuhHdMZev6Pe` (`cbd8d5d`). Retain directory
evidence; no database restore or employee rollback is required for this feature.
