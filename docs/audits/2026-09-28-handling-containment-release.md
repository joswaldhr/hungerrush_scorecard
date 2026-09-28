# Handling-time read containment

Candidate: pending exact commit/CI/hosted verification. Local typecheck, lint and all
804 tests / 105 files pass. Fresh 18:18 encrypted backup restored 33 tables / 63,563
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
synthetic current/history/revision/CSV/PDF checks and exact CI/build remain release gates.

Rollback: production `390dae9154a2bff75da374580a21330462baf964`, deployment
`dpl_DvfxY6H3bNESQvQByoHMQvgVemJN`. An application rollback needs no database restore.
Postcheck the actual production alias, runtime/core reads, explicit unavailable reason,
unchanged protected data/environment and absence of source activation.

This corrects a misleading judgment; it does not supply a verified handling-effort
measurement. Production arithmetic coverage remains 14/40 assignments and full-contract
certification 0/40. Automatic recovery schedule and remaining source/target contracts
are separate unresolved gates.
