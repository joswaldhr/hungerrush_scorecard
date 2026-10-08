# POS September 27–October 3 review publication

The user requests usable employee review data for both managers today. This scoped
publication supplies the last completed week, September 27–October 3, for the five
already assigned POS inbound keys and all 39 currently eligible POS employees.
It does not assert immutable historical team membership or verified historical targets.

Use released master `2a62d53337765c553b2cdaffa0415cf764fd103e` and the normal atomic
sync service with the existing qualified POS publisher. The one-run policy has an
explicit September 27 cutover and exactly one fixed reporting interval. The deployed
current-week policy, environment settings and schedules remain unchanged. No new
assignment, target, catalog key, migration, human attribution policy or repair flag.

The retained October 8 05:18 UTC closed-week source capture covers every eligible
POS employee under the previously qualified exact 14-group / leg-created / Central
contract. Its independent reconstruction, publication-wrapper replay and source sets
were already verified for this period. Reuse it within the existing 26-hour observation
limit; preserve the actual source observation rather than relabeling it as a fresh
Zendesk fetch. This run makes no Zendesk request or modification.

Before publication, revalidate current database bindings and effective assignments,
compare all 195 candidate values with the independent reconstruction, obtain a fresh
encrypted backup/restore receipt and capture protected-data/predecessor baselines.
Execute only after those checks pass, with a durable dispatch marker and no blind retry.
The released service rechecks configuration/ownership and locks bindings in the write
transaction, retains prior evidence, and excludes incompatible legacy contributors.

Afterward independently recalculate the exact written counts, duration numerators,
denominators and source sets; compare all unrelated row digests, including current-week
POS and all Menufy metrics, and verify retained predecessor values. Check production
scorecard/history and actual CSV output for the fixed review period.

Rollback keeps the qualified production code and existing current-week policy. The
one-run publisher has no ongoing activation to disable. If data recovery is necessary,
restore only this run's affected value/fact/source predecessors after checking for newer
writes; do not restore the whole database. This does not activate general historical
repair or the independently gated recovery queue.

Fresh recovery receipt: `2026-10-08-weekly-review-restore.json`. Existing exact CI,
synthetic two-closed-week/current publisher checks and hosted output verification are
recorded in `2026-10-08-pos-inbound-release.md` and `2026-10-08-pos-inbound-preview.json`.
Other POS and Menufy families remain separate work; do not claim full-scorecard completion.
