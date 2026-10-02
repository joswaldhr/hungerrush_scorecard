# Company-managed hosting proposal

September 29, 2026. Planning only: no Azure resources, billing, DNS, credentials,
vendor configuration or deployment destinations have been changed by this proposal.
The user wants an eventual move away from Vercel and Railway. IT must confirm whether
the destination is the company's Azure subscription or physical company servers.

## Recommendation and ownership

If IT already operates Azure, use the company's subscription and standard network,
identity, billing and support practices. Prefer a portable container for Cadence's web
application and separate scheduled executions of the same application's sync services.
This remains one codebase and one set of metric rules; it does not require a rewrite
or a new microservice architecture.

| Responsibility | Proposed Azure destination | Physical-server equivalent |
|---|---|---|
| Next.js web application | Azure Container Apps, with a warm production instance | IT-managed Linux container host behind its HTTPS reverse proxy |
| Scheduled ingestion | Container Apps Jobs calling the existing sync services | IT's job scheduler running the same container command |
| PostgreSQL | Azure Database for PostgreSQL Flexible Server, major version 18 | Managed PostgreSQL 18 cluster operated by IT |
| Microsoft login | Existing Entra tenant and environment-specific app registrations | Same Entra sign-in, with company-hosted callback URLs |
| Secrets | Key Vault references and managed identities where supported | IT's approved secrets manager |
| Build images and deployment | Company registry and GitHub Actions or Azure DevOps | Company registry and deployment pipeline |
| Diagnostics and recovery | IT-owned monitoring, alerts, backups and restore exercises | IT-owned monitoring, encrypted backups, WAL retention and recovery exercises |

If IT standardizes on App Service, it can host the web container; keep lengthy sync
execution separate. Use an existing supported Kubernetes platform only if IT already
operates it. Do not introduce a cluster solely for this small application.

Azure Container Apps distinguishes persistent web applications from finite scheduled
jobs, with UTC cron schedules and configurable execution bounds. This fits Cadence's
web/sync split. Platform retries must not bypass existing application leases, source
pacing, request budgets or atomic publication. Start with no whole-job retry until
restart and idempotency behavior is qualified. [Microsoft job documentation](https://learn.microsoft.com/en-us/azure/container-apps/jobs)

## What is already portable, and what needs work

Repository inspection confirms Next.js 16.3.5, Auth.js with Microsoft Entra, Drizzle,
PostgreSQL and GitHub Actions. Production PostgreSQL is 18.6. Microsoft currently lists
18.6 for Azure PostgreSQL; recheck the selected region and provisioning options before
purchase. No engine downgrade should be assumed. [Supported versions](https://learn.microsoft.com/en-us/azure/postgresql/configure-maintain/concepts-supported-versions)

The main application has no dependency on Vercel-hosted data storage. However, it is not
deployment-ready for the proposed destination yet:

- Add a reviewed container build using Next.js standalone output, copying public and
  static assets. The installed Next.js guide documents this mode. Keep secrets, private
  evidence, local backups and development credentials out of build contexts and images.
- Provide a worker entry point for existing sync services, preserving the validation,
  cooldown, lease, period selection and policy checks currently in HTTP cron handlers.
  Migrate all 16 configured schedules exactly before considering any frequency change.
  Current 300-second route declarations are host settings, not a portable scheduler.
- Define explicit environment and deployment identities instead of relying on Vercel
  metadata. Use separately owned staging and production DB/auth/secrets; production
  fixtures and development login remain prohibited.
- Set the canonical HTTPS origin and Auth.js proxy/host configuration explicitly.
  Trust forwarded headers only from IT's controlled proxy. Test callback, cookies,
  sign-out, manager scoping and administrator access on the new domain.
- Add the exact new callback to the intended Entra app at cutover; keep a separate
  staging registration. Existing Microsoft login is identity infrastructure, not proof
  of an Azure compute subscription or permission to provision one. [Redirect URI rules](https://learn.microsoft.com/en-us/entra/identity-platform/reply-url)
- Define database connection limits per web replica and worker, verified TLS, orderly
  shutdown and restart behavior. Existing PostgreSQL-backed cooldowns and leases must
  remain shared across all instances.
- Separate process liveness from database readiness. The current `/api/health` checks
  database reachability; a DB outage should not cause an endless web restart loop.
- Build once, publish a versioned image, rehearse explicit migrations, then promote the
  same image. Do not run migrations or fixture seeds on web startup.
- Audit worker packaging separately: standalone web tracing need not include CLI-only
  worker modules. Exercise both entry points from the final image in CI.

## Network, security and operations

IT chooses internal/VPN access or an externally reachable HTTPS entry point with Entra
and approved access policies. Private hosting requires working corporate DNS and client
network connectivity, including remote staff. Keep the database private. Document
outbound HTTPS access to Microsoft identity, Graph and Zendesk separately from inbound
access. Zendesk remains GET-only; no changes to its reports or permissions are needed.
Container Apps supports private endpoints; choose a network design with IT rather than
exposing the database to make connectivity easier. [Private endpoint documentation](https://learn.microsoft.com/en-us/azure/container-apps/how-to-use-private-endpoint)

Use Key Vault references through managed identity for supported Azure resources. This
does not automatically remove the existing Auth.js client secret or Zendesk API token;
those still need scoped storage, ownership and rotation. Do not add new Graph rights
as a side effect of moving the website. [Secret references](https://learn.microsoft.com/en-us/azure/container-apps/manage-secrets)

Agree recovery objectives, retention and outage ownership with IT. Azure PostgreSQL
offers automated backups and point-in-time restore; verify an actual restore and
application reconnect. Preserve a separately tested portable export where IT requires
it. Current Windows-user-bound DPAPI backups alone are not the target recovery model.
[Azure backup and restore](https://learn.microsoft.com/en-us/azure/postgresql/backup-restore/concepts-backup-restore)

Alert on missed expected publication, failed jobs, excessive duration, stale leases,
database connectivity and failed backups. A successful job with no eligible cohort is
different from a failed collection or unpublished results. Keep logs free of employee
payloads and credentials. Preserve existing timezone and metric eligibility rules.

## Migration sequence and acceptance

1. IT supplies the hosting destination, subscription/region, network pattern, domain,
   technical owner, approved budget and recovery objectives. Confirm PostgreSQL capacity,
   backup/HA requirements, data residency and registry/CI standards. Produce a priced
   design only after these choices; no cost or completion-date promise yet.
2. Add portable packaging, environment checks, worker commands and deployment templates
   on a separate branch. Reuse application code and regression checks. The frozen demo
   deployment and access remain unchanged.
3. Provision a separate synthetic staging environment. Verify login/roles, last-week and
   current-week views, history, actual PDF/PNG/CSV files, failures, restart/lease behavior,
   network boundaries and recovery. Keep live ingestion disabled there.
4. Rehearse a private production-data restore in an access-controlled migration environment
   distinct from synthetic testing. Reconcile schema, row counts/digests, identities,
   assignments, history and metric values. Rehearse the exact final cutover and rollback.
5. During an agreed cutover window, freeze all old application writes and stop old scheduled
   and manual publishers; drain active workers. Take a final consistent backup and restore
   it to Azure. Validate it before enabling the new writer. A short maintenance-window
   migration is the initial proposal; use replication only if measured downtime requires it.
6. Switch the canonical domain and login callback, verify real manager access, then enable
   exactly one production scheduler. Old and new sites must not independently write to
   separate databases. Observe actual scheduled runs, intervals, durations and outcomes.
7. Keep the old installation isolated/read-only for the agreed rollback window. Before
   new writes, rollback can return to the frozen old state. After new writes, reverting
   DNS to an older database loses data: preserve/synchronize new writes or roll back the
   application against the current compatible database under a rehearsed procedure.
8. Retire old hosting only after acceptance and recovery checks, verified data retention
   and separate consideration of the still-frozen presenter demo. Remove obsolete secrets
   and callbacks through IT's controlled retirement procedure.

Hosting migration and metric certification remain separate work. More control over
execution and observability can improve reliability, but moving to Azure cannot establish
the meaning or accuracy of an unqualified metric. Human attribution restrictions and all
disabled publication/repair features must survive unchanged.
