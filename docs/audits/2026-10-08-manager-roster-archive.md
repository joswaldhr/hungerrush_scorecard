# Manager meeting-roster archive

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
