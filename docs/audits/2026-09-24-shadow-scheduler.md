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

The September 24 follow-up confirmed that Vercel's supported automation bypass is available
on all plans, but each secret grants access to all deployments in its project. It is not
branch-scoped. The current scheduler has no such credential; adding it would broaden the
staging worker's access beyond the branch-isolation boundary. A separate staging project or
equivalently scoped supported execution path remains to be implemented. See
[Vercel automation access](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).

## Short-lived workflow identity rehearsal

A supported alternative was identified in Vercel Trusted Sources. An external OIDC rule
was applied through the documented project API with HTTP 200. It accepts only GitHub's
issuer, repository ID 1280492920, owner ID 266567329, this repository name, the audit branch,
the exact staging-shadow-rehearsal.yml workflow reference, push/manual events and the
custom audience https://vercel.com/cadence-staging-shadow. Its sole destination environment
is Preview; production is excluded. Existing trust configuration was null, and other
project/protection settings were not changed. This is environment-scoped destination
access, not a claim that Vercel restricts the destination to one branch alias.

The new workflow runs two sequential processes, each obtaining fresh short-lived tokens.
It tests anonymous, wrong-audience and trusted requests to the fixed staging shadow route.
No worker credential, database credential or vendor credential is supplied; the successful
trusted case must still be refused by application authentication. Three local request-boundary
tests passed. Hosted results follow. This does not enable ingestion or recurring scheduling.
See [Trusted Sources](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/trusted-sources)
and the [project API](https://vercel.com/docs/rest-api/projects/update-an-existing-project).

Hosted push run 36044229447 and manual audit-branch run 36044434119 both passed in two
fresh sequential processes. Each reported anonymous 302, wrong-audience 302 and trusted
application 401. Manual dispatch works without changing the default production branch.

The follow-up run 36045340885 at 741879c verified the full worker authentication path in
two fresh processes at 19:02:04/19:02:12 UTC. Both returned `workerAuthenticated: true`
and `sourceIngestionStarted: false`. The endpoint's explicit `?probe=auth` mode was first
deployed at 22d03b4 on dpl_FFDoq9EZsVHTvuxbfW2pftR5DeWH; it exits before source or lease
access even if ingestion is configured later. Four standalone request-boundary tests and
ten route tests passed locally, with TypeScript and focused lint.

The dedicated staging worker credential is stored in the `cadence-staging-shadow` GitHub
environment, whose custom deployment policy allows only the audit branch. Vercel's exact
OIDC rule now also requires that environment claim; its Preview destination restriction
and existing SSO protection are unchanged. GitHub holds no database or vendor credentials.
The owner-only plaintext handoff was removed. No reusable Vercel bypass secret was created.

This supplies a durable short-lived identity path for manually dispatched workflow runs.
It does not establish recurring scheduling: GitHub scheduled workflows require the default
branch, and the Railway service remains disabled. Live source ingestion, checkpoint restart
and source-account binding remain release gates. Production settings and data were not changed.

## Controlled hosted ingestion and recovery — September 24, 19:17–19:24 UTC

The account-bound worker at 0ccc9e2 deployed READY as dpl_6MwKNPjYJ17a1zYX34E37Qr7jcjc.
A separate staging observation organization/source was provisioned with zero users, employees,
metric definitions, normalized facts and publishing runs. One vendor `users/me` GET verified
the configured active API account before temporary vendor credentials and the explicit source
ID were set only for the audit Preview branch. Production environment entries were compared
before/after and remained unchanged. [Zendesk Show Self](https://developer.zendesk.com/api-reference/ticketing/users/users/#show-self)
documents the authentication check; it supplies no human-activity attribution proof.

Explicit manual runs 36047104134 and 36047408195 executed four separate processes, each
with fresh OIDC identity and an independently acquired lease. The first saved three pages
per stream; the second resumed to six pages per stream and completed Talk. The third resumed
tickets to 12 pages; the fourth finished page 13. Each invocation performed at most six fetch
steps. Both streams cover September 23 UTC. Retained in-period counts are 11,954 ticket events
and 2,532 Talk legs; raw record counts are higher because boundary pages include later records.

An explicitly expired staging lease was then inserted only after both streams completed,
without overwriting an existing lease. Run 36047700931 reclaimed it and completed; its two
fresh processes each returned zero fetch steps. This verifies hosted expired-lease takeover
and idempotent replay, not an actual platform crash. Post-run checkpoints/counts/fingerprints
were unchanged and no lease remained. The local retained September 23 observation has matching
counts and fingerprints for both streams. This is consistency across the same export model,
not independent closed-week reconciliation or human attribution certification.

At 19:24 UTC the observation source was disabled, and branch-specific vendor credentials and
source opt-in were cleared with explicit blank overrides (so shared credentials are not inherited).
Railway scheduling remains disabled. Private plaintext handoffs were removed. The cleanup
Preview deployment and post-cleanup auth checks follow. The stripped observation records remain
isolated for analysis; a durable retention policy and recurring scheduling are still open.

Aggregate evidence: `2026-09-24-hosted-shadow-provision.json`, `-progress.json`,
`-completed.json`, `-disabled.json`, and `2026-09-24-shadow-environment-comparison.json`.

Cleanup Preview 393b14c became READY as dpl_4qbGydTcE2nbz8D6H63VE22Xjqss. The follow-up
a743cb6 deployment dpl_HtDmuX5RmoCsmCX6Bq2nmTPQNsta is also READY; its auth-only workflow
run 36048271316 passed with ingestion unrequested. Both full CI runs 36048277989/36048271347
passed. Workflow actions now use verified immutable release commits for checkout v7.0.1,
github-script v9.0.0, setup-node v7.0.0 and pnpm/action-setup v6.1.0, replacing the deprecated
Node 20 action runtimes. Checkout does not persist its repository token. Application CI
still uses Node 22. Production and source ingestion remain unchanged/disabled respectively.
