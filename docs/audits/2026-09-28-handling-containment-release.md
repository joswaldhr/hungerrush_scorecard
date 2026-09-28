# Handling-time read containment

Released: PR37 merged to `ed6b2df5e6127b606af99c99aa3d8726dc1d342d` from candidate
`73b44c899e7002ec07c19b1b15f14854db6adf3e`. Exact CI 36465036664 and 36465027903
passed typecheck, lint, 804 tests / 105 files, migrations and build. Fresh 18:18 encrypted backup restored 33 tables / 63,563
rows with identical digests; see `2026-09-28-handling-containment-backup.json`.

Defect: legacy Zendesk `avg_handle_time` uses full-resolution business time yet could
display zero and On Track against an active-handling target. A caption was insufficient.
The read policy withholds current/prior numeric values and target judgments, explains
the mismatch in current/history/revision/export views, and prevents reconciliation
from claiming a verified match for this incompatible definition. Original stored
observations, target configuration and revisions remain unchanged. Other source
strategies and the qualified CSAT/first-reply policies retain their behavior.

Scope: all manager reads of this Zendesk metric, including existing periods. No metric
publication, source calls, database migration, stored-data repair, assignment or
configuration changes. Human attribution containment stays in force. The new outbound
and Talk collection policies remain absent; shadow/action-v2/historical repair stay off.

Regression evidence covers zero/nonzero observations, high calculation versions,
current/comparison/target/history/revision/export/API reads, unchanged stored evidence,
organization/employee scope and unrelated manual-source contracts. Final hosted
synthetic current/history/revision/CSV/PDF checks passed. The 5,364-byte CSV and rendered
783,885-byte PDF preserve the unavailable values and explanation. The initial fixture
attempt stopped at a guard; the scoped retry uses only the existing named synthetic
organization and passed. No production access occurred in fixture execution.

Production `dpl_DBWaKeHfuutr8i3qeyAawQUCSUJ6` is READY and owns the canonical alias.
The production and reviewed candidate trees are identical. Administrator/POS manager
reads pass with all 39 employees visible. The live canary handling row is unavailable
for current/comparison/target with No Data status and the explicit reason. Actual
10,394-byte production CSV agrees; all 18 other metric rows are byte-field identical
to the pre-release CSV. Seven protected table digests and all 18 production environment
entries are unchanged. Both new collector/publication policies remain absent. The
manager view was exited and validation tabs closed. Master CI status is tracked in
the implementation ledger; do not infer scheduled metric execution from this release.

Rollback: production `390dae9154a2bff75da374580a21330462baf964`, deployment
`dpl_DvfxY6H3bNESQvQByoHMQvgVemJN`. An application rollback needs no database restore.
Postcheck the actual production alias, runtime/core reads, explicit unavailable reason,
unchanged protected data/environment and absence of source activation.

This corrects a misleading judgment; it does not supply a verified handling-effort
measurement. Production arithmetic coverage remains 14/40 assignments and full-contract
certification 0/40. Automatic recovery schedule and remaining source/target contracts
are separate unresolved gates.
