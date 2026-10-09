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

Released as PR57, master `98eff5e3c94954f6dc65178e69ae67f45210d4d6`, deployment
`dpl_A7HW5tczZATxgN3V3PmvkowbmqoL`; the production alias is verified. Initial 18 focused tests passed.
The first full-suite run found the existing source-capability test needed to retain
an unsupported-source fixture now that Entra has its own review panel; fixed before
release. Additional tests cover stale/failed display, source rebinding and superseded
leases. Final local tests pass: 1,265 / 157 files, typecheck and ESLint. Two existing
database-preservation tests compared unordered reads; adding primary-key ordering
removes nondeterminism while retaining every row/field comparison. Exact candidate
CI/build `37845343990` and merged-master CI/build `37845937548` pass.

Isolated Preview `dpl_H4Yjy4BTcfaNEECDfUUk3zze7FsM` at exact candidate `fd51a6e`
passes its database/auth/source isolation build gate. Synthetic failed/retained
directory observations, missing/ambiguous identities and UTC coverage display are
verified in light/dark themes and keyboard interaction. The protected manager page
correctly shows unconfigured directory checks; admin access is denied to the synthetic
manager. SQL tests separately verify employee scope and cross-organization isolation.
No exports changed. Fresh [encrypted restore](2026-10-08-directory-restore.json)
matches all 35 tables / 389,060 rows at 21:13 UTC.

Read-only source rehearsal: all 62 active employees resolve uniquely; 61 enabled,
one disabled; zero missing/ambiguous identities; no production or directory writes.
Only aggregate evidence is committed. Raw evidence remains private.

Activation used a verified dedicated source, existing Graph credential/tenant
identity, fresh encrypted backup/restore and scoped pre/post digests covering eight
employee/assignment/metric tables. All digests match. Only the dedicated source,
latest directory health and retained directory observation were written.

One controlled directory check at 21:21 UTC returns HTTP 200 and reproduces the
read-only baseline exactly; see [aggregate receipt](2026-10-08-directory-canary.json).
Existing 23 environment metadata entries and all 17 existing cron definitions are
unchanged. The added production-only `ENTRA_ROSTER_SOURCE_ID` uses existing Graph
credentials; no permission/credential expansion. The additional directory schedule is
`40 */6 * * *`. Its first real scheduled execution remains unobserved; do not present
the controlled request as scheduler evidence.

Live administrator view-as confirms the 23-person Menufy scope and the flagged
account; POS domain-reader scope confirms 39 accounts with no conflicts. The admin
view contains 62 checks. The 1:1 picker displays the review notice. Login returns
200, anonymous directory requests return 401, and authenticated synthetic-fixture
navigation returns 404 (anonymous navigation is login-protected). This is not either
manager's own login acceptance. No employee, membership, target, metric or vendor
record changed. Reviewed team-removal overrides remain separate work.

Rollback: unset `ENTRA_ROSTER_SOURCE_ID` and redeploy or restore the preceding
production deployment `dpl_BzXwfPfMHumJzDgowuhHdMZev6Pe` (`cbd8d5d`). Retain directory
evidence; no database restore or employee rollback is required for this feature.

## October 9 scheduled-slot verification

The 00:40 slot now has project-wide production invocation and refreshed database
proof: GET 200 at 00:40:46 UTC, completed observation at 00:40:48, all 62 accounts
matching the controlled baseline (61 enabled, one disabled, no unresolved identities).
The lease is released. No manual sync was triggered. This supersedes the earlier
unobserved-slot statement. The CLI response omits scheduler user agent and platform
duration; those fields remain unverified. See the [aggregate receipt](2026-10-09-directory-scheduled-check.json).

PR58 subsequently supplies the manager-specific meeting-roster archive/restore
workflow with retained history and protection against source rediscovery. Account
state still does not establish employment or automatically archive team membership.
