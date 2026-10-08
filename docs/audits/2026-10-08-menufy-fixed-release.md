# Menufy fixed-period publication correction

## Scope

PR49 fixes a rollover race in the dedicated inbound publisher: the selected reporting
period is fixed before asynchronous work, and source freshness and closed-week coverage
are checked again inside the publication transaction after configuration locks. Exact
identity membership is also checked. The approved formulas and nine-key source contract
are unchanged. No migration, assignment, schedule or feature-policy change is included.
The Menufy release policy remains absent; this is a code-only release, not activation.

Runtime candidate `bd1784bec691cb80f210d1f523226674c56a18a8` passes exact CI
`37790952102`, including build; all 1,209 local tests / 151 files and static checks pass.
The automatic PR Preview fails because that branch lacks Entra credentials. It is not
a passed deployment. The designated isolated Preview has identical runtime and scripts
at `ad24cdc0939838747087e7cde25e15bd71962030`, READY deployment
`dpl_9m8co4p89wB8UPmhn2jxxE9pGxPY`. No credentials were copied to the new PR branch.

## Hosted and recovery evidence

The guarded synthetic build uses the real sync transaction and fixed-period publisher.
Both September 27–October 3 and October 4–10 produce the expected nine values: eight
reported and one absent-duration result. Unrelated values are unchanged. The rehearsal
blocks network requests and records zero vendor requests and production writes.
Hosted scorecards and stored history match all 18 values, show measured-sample context,
preserve zero versus missing, and restore the selected current week when returning from
closed-week history. Exports are hidden during period loading. Current statuses remain
neutral; unqualified targets remain withheld. Actual CSV files match all nine values
for each week, their status, quality, source contract and dates. See the
[Preview receipt](2026-10-08-menufy-fixed-preview.json). Visual export code is unchanged;
earlier actual PDF/PNG checks remain separate evidence, and native print is unverified.

The fresh 14:31 UTC encrypted production recovery copy restores all 35 tables /
374,350 rows with matching digests and migration compatibility through 0017. See the
[restore receipt](2026-10-08-menufy-fixed-restore.json). It is Windows-profile-bound
recovery, not portable disaster recovery or provider PITR.

## Rollout and rollback

Before merging, recheck exact candidate CI and production policy metadata. Verify the
resulting master SHA, READY deployment and production alias, authenticated reads and
the disabled Menufy endpoint. Do not invoke the active POS publisher just to smoke-test
deployment. Compare environment metadata and the 16 existing cron definitions afterward.

The prior production deployment `dpl_5H9MubkMyqtAbEVjZ3QUbkbyXdbR` at `bc8e26e`
is the code-only rollback reference with the existing qualified POS policies. It retains
the protection against legacy overwrites. No data repair is needed for this inactive
Menufy code change; any later publication requires its own source/canary/rollback gates.

Fresh Menufy source reconciliation, its prospective policy/assignment cutovers and live
publication remain separate work. Genuine scheduled execution, unresolved ticket updates,
remaining measures on both teams and roster/access verification still block full completion.
Zendesk and the presentation demo remain untouched.
