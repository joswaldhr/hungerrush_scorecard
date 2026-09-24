# Production backup and restore rehearsal

A consistent, read-only PostgreSQL 18.6 production snapshot was exported using the matching
pg_dump into a custom archive. Source writes were disabled in both the inventory transaction
and libpq options. The inventory and dump shared an exported repeatable-read snapshot.

The 1,472,087-byte archive was protected with Windows DPAPI CurrentUser, decrypted, and
SHA-256 checked before restoration. A fresh PostgreSQL 18.6 cluster listened only on
127.0.0.1:55440, with a random SCRAM password and owner-only recovery-directory ACL.
Restoration used one transaction and stopped on errors. All 32 tables / 28,878 rows matched
the snapshot's sorted row-content digests. Migrations through 0013 passed on this copy;
all existing application table digests remained unchanged. The migration journal changed
and the new sync_revisions table remained empty.

The cluster was stopped and removed, together with plaintext dumps and local password.
The encrypted archive, manifest and operational server log remain under the successful
`restore-*` directory in `%USERPROFILE%\.codex\private-backups\cadence`, outside Git.
Select the directory whose manifest has `restored: true` and the SHA-256 in the committed
aggregate rehearsal report. Earlier failed attempts are not validated recovery points.
The report contains no credentials or row values.

## Recovery and limits

Use the same Windows user profile to decrypt database.dump.dpapi with
`ProtectedData.Unprotect(bytes, null, DataProtectionScope.CurrentUser)`. Write plaintext
only to a private recovery directory and verify SHA-256 against manifest.json. Use a
PostgreSQL 18 client and an explicitly chosen empty recovery database. Tested restore flags:
`--exit-on-error --single-transaction --no-owner --no-privileges`. Never target production.

This verifies application-data recovery and migration compatibility. It does not restore
Railway infrastructure, global roles, original ownership/ACLs, Vercel settings or Entra
credentials. DPAPI requires this Windows profile: it is not an independently portable
disaster-recovery copy. Provider retention/PITR and off-machine recovery remain unverified.
Take a fresh validated backup immediately before an actual production rollout.

The operational script is `scripts/rehearse-production-restore.ts`. Set RESTORE_PG_BIN to
the PostgreSQL 18 binary directory and load DATABASE_URL privately. It restricts its source
to the known production endpoint and restores only into a newly initialized local cluster.
The live rehearsal and TypeScript check passed. Hosted schemas were not modified.

The binary package came from [EDB's official distribution](https://www.enterprisedb.com/download-postgresql-binaries),
linked by [PostgreSQL Windows downloads](https://www.postgresql.org/download/windows/).
Snapshot and custom-format behavior follows [pg_dump documentation](https://www.postgresql.org/docs/18/app-pgdump.html).
