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

## Hosted authentication rehearsal — September 24, 12:47 CDT

Deployment `422ae54c-8768-487f-b80d-6abde7770454` completed a manual Railway execution
in approximately three seconds. Platform logs report `status: authenticated_disabled`.
The Vercel Preview was `dpl_4LXymfkWZT7NYL8uZtLCYF7BPkkY` at commit `4fd71db`.
The source ID remains unset: no vendor fetch, checkpoint write or metric publication occurred.

Independent hosted boundary checks returned 401 for missing/invalid worker tokens, 200
with ingestion disabled for the dedicated shadow token, and 401 when that token was sent
to the separate metric-publishing route. Vercel Preview protection remains enabled.
An expiring share grant for this exact branch alias supplied a temporary session solely
for the rehearsal. The scheduler accepts that session only in explicit probe mode and
rejects redirects, other origins and multiple-cookie headers. Twelve focused scheduler
and route tests, TypeScript and focused lint passed.

After verification, the alias grant was revoked through Vercel's API (200, zero grants
remaining); the same cookie then received a 302 to Vercel protection instead of reaching
the application. Railway cleanup deployment `9e5cb7d3-4ca3-4443-8838-4d5524361971`
sets enablement and probe mode to false and removes `ACTION_SHADOW_PREVIEW_COOKIE`.
Its manual execution at 12:49 CDT completed and logged `status: disabled`.
The dedicated worker token remains only in the authorized staging settings and encrypted
local recovery storage; plaintext handoff files were removed.

This completes hosted worker authentication and manual execution verification. Recurring
protected-Preview authentication still needs a durable configuration before ingestion is
enabled; the temporary share session is not that configuration. Live vendor ingestion,
checkpoint restart, source completeness and reviewed human attribution remain separate gates.
