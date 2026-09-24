# Roster line preservation rollout

Migration 0014 adds nullable `roster_candidates.suggested_line`. Existing rows remain null;
no historical line is inferred. Deploy this migration before code that reads the new field.
Old application code is compatible with the additive column, so code rollback retains it.
Do not drop the column after new observations have been saved: that would discard evidence.

The local 0011-to-0014 rehearsal preserved the legacy candidate, verified its null line,
and round-tripped a synthetic line. The separate PostgreSQL 18.6 production snapshot restore
matched all 32 tables / 28,878 rows before upgrading. Migrations through 0014 then preserved
the existing application data; comparison excludes only the newly added column where absent
from the source schema. Production itself was read-only.

`scripts/migrate-approved-staging.ts` is an explicit operator command, not a normal build
step. It requires Vercel Preview, this audit branch, and the exact approved staging database
host/port/database. It refuses future migration journals beyond reviewed 0014, uses TLS,
and compares existing public table contents before/after migration. Its logs contain only
aggregate verification. It may be run by a one-off Preview deployment build override using
the existing staging connection credential, without extracting that credential or changing
project-wide build settings. No production invocation is permitted by its guard.

The migration commit is published ahead of the application changes so the staging upgrade
can finish while the old application remains compatible. The new code preserves configured
line through discovery, automatic approval and pending review. Conflicting lines in the same
team are rejected. Manual approval preserves the suggestion only for its original team;
the review UI explains that choosing another team clears that line.

## Hosted result

Preview deployment `dpl_13jvbWaW3w5BHw5jfVdfaqSvpgGf` completed READY with the one-off
build override. The staging-only command verified migration through 0014 and unchanged
contents of all 32 public tables / 28 rows. Production access was refused by construction.
The application build also passed. Project-wide build settings were not changed; ordinary
future deployments still use the normal build command.
