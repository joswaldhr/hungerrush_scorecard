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

Production execution has not occurred. Exact-candidate CI remains required. Zendesk,
production application data, existing metric definitions/targets and frozen demo remain
unchanged. Backups are Windows-profile-bound; portable disaster recovery/PITR remains
unverified.
