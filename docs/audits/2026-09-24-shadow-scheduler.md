# Staging scheduler deployment

Railway service `cadence-shadow-scheduler` was created in the existing `cadence-staging`
environment. Service ID: `2307daa3-5146-4ca2-8852-caf114c139e4`. The service uses Railway's
official function image `ghcr.io/railwayapp/function-bun:1.4.0`, runs hourly, has no public
domain, and uses the cron-enforced Never restart policy. CPU ceiling is one vCPU. The default
memory ceiling is unchanged; this is a usage ceiling, not a reserved allocation.

Source of truth: `scripts/action-shadow-scheduler.ts`. No npm dependencies or database/vendor
credentials are required. The function sends one bounded request to the exact staging Preview
origin, rejects redirects, and logs only a validated status/date/count response. It stays
disabled unless `ACTION_SHADOW_SCHEDULER_ENABLED=true`. HTTP failures, disabled ingestion,
and malformed results fail the run; an active source lease returns busy rather than failure.

Initial deployment `823c0763-b7ab-4eb2-8fd2-1519617d9421` completed. Railway's **Run now**
control was used on September 24 at 09:15 CDT. Platform logs show execution of index.tsx,
`status: disabled`, and Completed status. No external worker request or data ingestion occurred.
The platform schedule and manual execution path are verified; worker authentication is not.

The subsequent authentication-only probe code is staged in Railway. In explicit probe mode
(`ACTION_SHADOW_SCHEDULER_PROBE=true`), an authenticated response with ingestion disabled
reports `authenticated_disabled`. A 401 remains failure. This allows credential wiring to
be checked without enabling source ingestion. Turn probe mode and scheduling enablement off
after this test until the source/attribution activation gates are met.

Credential setup requires a fresh staging-only `ACTION_SHADOW_SECRET` saved in this service
and in the audit branch's Vercel Preview environment. When set, the shadow route accepts
only this dedicated credential; it does not accept the general CRON_SECRET. The old sync
route remains independently authenticated. The user authorized the pending access setup on
September 24. A fresh credential is now saved as a sensitive variable only for the audit
branch's Vercel Preview and staged in the Railway scheduler service. An owner-only local
recovery copy uses Windows DPAPI; the temporary plaintext handoff was removed. The scheduler
has no database or vendor credentials. Authentication-only probe variables are staged;
deployment and runtime outcomes are recorded below when verified.

Relevant vendor documentation: [functions](https://docs.railway.com/functions) and
[cron jobs](https://docs.railway.com/cron-jobs). No paid plan upgrade or production changes
were made. The service uses the previously authorized staging hosting budget; actual ongoing
usage still needs measurement after ingestion is enabled.
