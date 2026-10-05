# Present-schema migration baseline adoption

## Scope and acceptance

Production has the 0009 fact-identity schema but no corresponding migration-journal
entry. The legacy explicit application script did not insert that entry. This is a
plausible explanation, not independent proof that the historical cleanup was executed
exactly as written. Replaying 0009 would delete/backfill facts and attempt to add
existing columns; it is prohibited here.

The candidate in `scripts/migration-baseline.ts` adopts the present schema. It adds only
the canonical LF SHA-256/timestamp for `0009_fact_identity` to the migration journal.
It preserves every existing journal row/hash and all application data. Known LF/CRLF
hashes are recognized without rewriting them. Other missing entries, duplicate or
unknown timestamps/hashes, incompatible column types/nullability, index shape or
aggregation defaults cause refusal. Journal and application tables are locked with
five-second acquisition/30-second statement limits inside one transaction. Concurrent
attempts serialize and become idempotent.

No route, build, scheduler or production command invokes this operation. The restore
rehearsal invokes it only on the separate loopback restored copy after exact source/
restore digest comparison, before applying pending migrations. The release census
retains the strict byte-hash result and separately reports a known-line-ending prefix;
the additional field does not conceal a missing or unknown migration.

## Verification

- Six planner tests reject unknown/ambiguous baselines and distinguish pending entries.
- Six PostgreSQL tests use independently created loopback synthetic test databases.
  They verify exact one-row adoption, application preservation, repeat/concurrent
  attempts and refusal for wrong observation types, included-index columns,
  incompatible defaults and unknown hashes.
- Fresh PostgreSQL 18.6 encrypted backup/restore matches all 33 tables / 85,721 rows.
  Adoption adds exactly one journal row on the restored copy. Migrations through
  0017 preserve all existing application data. See
  `2026-10-05-baseline-adoption-restore.json`.
- Recovery binaries came from the official EDB Windows archive over HTTPS; local
  archive SHA-256 is `e2246ba91d22345bc3d017586c09ede52d9df180b1eeb480f050445f1cad84e2`.
  This is a locally measured digest, not a published vendor checksum. The executables
  report 18.6 and are not Authenticode-signed. No machine service or global installation
  was added. [Official binary archive page](https://www.enterprisedb.com/download-postgresql-binaries).

## Production execution gates and rollback

Before invoking the candidate: exact-candidate full CI, fresh recovery evidence,
destination/read-only configuration census, unchanged known journal/schema preflight,
and the private rollback/configuration inventory must pass. The candidate SHA and
actual adoption receipt are recorded only after verification. Pending migrations
0016/0017 are a separate operation. Do not enable sources or alter metric policies as
part of adoption.

Rollback is scoped to the single newly inserted journal row with its exact known hash,
timestamp and returned execution evidence, only if no dependent migration operation
has started. An unexpected row/state stops rollback; never reset the journal or restore
the whole database over newer data. The encrypted backup is an emergency recovery
reference, not an automatic rollback action. No historical fact cleanup or metric
repair is asserted by this adoption.

## Observed production adoption

Candidate `952f3d37495b3ae932a003aa9b2c8db841d738e1` passes PostgreSQL 18 CI
`37367161929`, all 991 local tests and supplemental local Webpack build. GitHub's
runner-assignment incident delayed CI; no gate was waived. A fresh post-collection
restore matches all 33 tables / 137,967 rows and rehearses adoption/migrations without
changing existing application digests. See `2026-10-05-post-collection-baseline-restore.json`.

The guarded production operator subsequently adds exactly one known 0009 journal row.
Read-only production readback at 20:25 UTC confirms 16 entries, no missing journal rows
and a valid known-line-ending prefix. Strict byte hashes still differ where Windows
line endings differ; no existing hash was rewritten. Policies/metrics remain unchanged.
See `2026-10-05-baseline-adoption-production-readback.json`.

## Next separate additive migration operation

Scope is exactly pending `0016_roster_discovery_runs` and `0017_roster_observations`
from the same tested candidate. Reuse the fresh verified recovery point and unchanged
source configuration; check the exact known journal prefix and no running workers again.
Execute the trusted migration statements and their two journal inserts atomically with
bounded locks/timeouts. Compare existing application-table digests within that transaction,
omitting only the newly added nullable roster-candidate columns as in the successful restore
rehearsal. Refuse unknown/pending outcomes. Preserve existing employees, assignments,
metric values/targets and source policies. There is no automatic deployment/activation.

On failure, the transaction rolls back. After success, retain additive schema/journal
evidence on application rollback; do not drop tables or restore over newer data.
Record private execution intent/receipt and aggregate readback. This is a pre-execution
manifest for these two migrations, not a statement that they have run.

### Observed additive migration result

The separate guarded operation subsequently commits both migrations and their journal
entries atomically. All 32 pre-existing application table digests / 137,952 existing rows
match within the transaction. Two new tables remain empty; the three new nullable roster
candidate fields do not modify prior field values. Read-only production verification at
20:29 UTC confirms all 18 known journal entries and no pending candidate entries.
See `2026-10-05-roster-migrations-production-readback.json`. No application deployment,
employee/metric change or source activation accompanies the migration. A fresh restore
at 20:35 UTC matches all 35 tables / 138,044 rows and requires no baseline adoption.

Zendesk and frozen demo remain unchanged. Backups are Windows-profile-bound; portable
disaster recovery/PITR remains unverified.
