# Roster diagnostic query validation — October 9, 2026

A diagnostic helper sent `?health=1` instead of `?probe=health`. The authenticated
roster endpoint treated the unknown parameter as an ordinary cron request and invoked
durable enqueue handling. Retained read-only evidence showed the completed daily demand
coalesced unchanged, with no new collection or observation; the helper was corrected.

This focused fix returns HTTP 400 for unknown query keys, duplicate `probe` values,
empty probes and unsupported probe values, before health reads, configuration inspection,
enqueueing or collection. Authentication still runs first. The no-query daily cron and
exact `?probe=auth` / `?probe=health` requests retain their existing behavior. Vercel's
configured daily request is `/api/cron/roster` with no query at 16:10 UTC; no schedule
or source policy changes are needed.

Fifteen focused route tests pass, including the original `?health=1` mistake and mixed
or duplicate probe requests with the queued source enabled. Typecheck and focused ESLint
are required before push. Automatic Preview deployment for this branch is disabled until
explicit isolation. Production merge, deployment and source execution remain separate.
