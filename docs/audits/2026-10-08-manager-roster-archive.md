# Manager meeting-roster archive

## Verified release

PR58 merged as `ea7138b14506e5a825fa1b8fc0acd96e546bd14f`. Production
`dpl_5BDnKrAqA8LpZfZDDzuaze4iWqWj` is READY and owns the live alias.
Candidate `b17594a30dd100b143c15ae91c71c61a9710d58c` and master CI/build
`37849269164` / `37849675687` pass. Local validation passes 1,275 tests across
158 files, typecheck, ESLint and formatting. An initial test-cleanup foreign-key
error and missing Data Health mock were corrected before the successful full run.

Exact isolated Preview `dpl_5xjZcTfztyuZYLwxJDoUVi7etRuw` passed its environment
gate and explicit additive migration. Actual synthetic archive and keyboard restore
both succeeded. The empty picker retains the archive-management link; an archived
employee's scorecard still renders with its archive notice. Light/dark layouts pass.
The synthetic employee was restored to its original active-list state; its audit
history is intentionally retained. No production fixtures or vendor requests.

At 21:50 UTC, the encrypted restore matched 35 original tables / 389,063 rows and
rehearsed `0018` with original application data unchanged. Production applied only
the additive migration at 21:51 UTC. At 21:53 UTC the administrator, viewing as the
affected manager, recorded the user-confirmed removal through the shipped form.
One archive is retained; active counts are 22 and 39, with one and zero archives.
Eight protected table digests match exactly. Production picker omits the archived
person, offers the archive link, and Data Health checks the 22 active entries.
No employment, source assignment, metric or vendor changes occurred.

The earlier manifest below describes the reviewed candidate. Its pending wording
is superseded by this release. Company roster authority, separate access revocation,
independent group discovery and actual manager-own-login acceptance remain distinct.

## Contract

Manager-confirmed removals are separate from employment termination and source team
membership. Each manager can archive an employee currently assigned to them from their
active 1:1 list. An administrator can act through the existing, server-validated
view-as context. No other manager's list changes. The recorded effective date is the
UTC date the decision is applied, not an inferred departure date.

The decision records employee, manager, organization, actor, reason and timestamp in
`manager_roster_archives`. A partial unique index and transactional locks enforce one
open archive per manager/employee. Restore requires the displayed archive ID and a
reason; a stale tab cannot restore a newer decision. Restored decisions remain stored.

Source discovery cannot erase this decision or re-add the employee to that manager's
meeting list. Employee, team membership, identity, metric, target and source records
are untouched. Existing assigned scorecard/history access remains; archive is not
an access revocation or an employment determination. It never grants access beyond
the current server-authorized employee scope. If assignments are revoked separately,
the archived record does not restore access. Organization-level directory review
continues to show outstanding source conflicts.

## Manager process

1. Open **1:1s → Manage roster**, including from Data Health's directory review.
2. Confirm the person is no longer on your meeting roster; record a short reason and
   select **Archive from my roster**. A disabled account is evidence for review, not
   automatic confirmation of departure.
3. The person moves to **Archived**, remains accessible for scorecard/history review
   under existing permissions, and stays out of the active picker after rediscovery.
4. If the person returns, record the confirmation and use **Restore to my roster**.
5. HR employment termination, actual team transfer and access revocation remain
   separate reviewed actions. Resolve underlying HR/directory/Zendesk discrepancies
   through their owners; this workflow never writes to those systems.

## Release manifest

- Candidate: pending local validation; not yet released.
- Scope: manager roster UI and a single additive table (`0018`); no metric changes.
- Live correction: one previously confirmed former team member, one manager only,
  effective on the day applied. Personnel identifiers stay in private evidence.
- Gates: PostgreSQL authorization/concurrency/restore/rediscovery tests; type/lint/full
  suite and exact CI/build; isolated synthetic Preview with real archive/restore;
  fresh encrypted restore including additive migration rehearsal; explicit staging
  and production migration; production alias/core-read/canary verification.
- Rollback reference: `98eff5e` / `dpl_A7HW5tczZATxgN3V3PmvkowbmqoL`. Leave the additive
  table and decisions intact. Rolling code back will stop honoring the active-list
  exclusion, so document that visible reappearance; it does not delete history.
- Scheduled discovery, metric calculation/certification, vendor access, demo and
  disabled shadow/publication/repair policies remain unchanged.

## Remaining authority work

This delivers a durable manager-controlled meeting roster. It does not prove the
company's employment roster or automatically close source team memberships. Entra
conflict checks continue; independent Zendesk discovery scheduling and a confirmed
HR source of record remain separate work.
