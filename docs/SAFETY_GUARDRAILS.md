# Cadence safety guardrail plan

Effective September 25, 2026. Owner: the implementing agent. These are execution
requirements, not routine approval checkpoints. Continue authorized work when its
checks pass; a failed check blocks the affected operation while independent work continues.
The objective is to limit disruption, detect mistakes before publication, and recover
without losing newer data. No plan can guarantee zero failures.

## 1. Protect Zendesk and managers' work

**Zendesk is read-only for this work.** Do not create, edit, save, delete or reconfigure
reports, dashboards, tickets, users, groups, fields, triggers, automations, permissions
or account settings. Do not open Explore report/dashboard editors, including for
temporary filters, unsaved changes, inspection or export. An editor session itself
can affect another user's access; “I did not click Save” is insufficient protection.

Prefer retained downloads, previously collected evidence and documented GET APIs.
Allowlist the exact account, endpoints and query parameters required by each reader.
Set GET explicitly, reject redirects and foreign pagination, and keep authentication
server-side. Do not use UI internals, hidden report APIs or browser session credentials
to bypass an unavailable export. Record the evidence gap and continue other work.
Do not change Zendesk credentials or permissions to enforce this policy in this task.

Reads still consume resources. Reuse source snapshots, enforce request/time budgets,
space Talk requests at least 6.3 seconds apart within this collector, persist vendor
Retry-After, and avoid overlapping audit collectors. Account for existing application
jobs and other integrations: the new collector's lease alone does not coordinate all
clients in the Zendesk account. Do not activate it alongside another Talk reader until
their overlapping calls are eliminated or covered by a shared request budget.

**Incident, September 25:** A manager reported an Explore resource locked by the audit account while
audit report editors were open. Temporary filters/detail rows had been used without
saving. The audit exited the three report editors and closed all five Explore tabs;
the subsequent tab inventory contained no Explore tabs. No report saves were performed.
The manager's successful return to the report has not been independently observed. The
earlier assurance that reports were unchanged did not account for editor locks.

## 2. Separate research, testing and production

| Work | Permitted destination | Required check |
|---|---|---|
| Source investigation | Retained private data; bounded Zendesk GET APIs | Known account, minimum fields, no writes/editor sessions |
| Unit/integration tests and reset/seed commands | Isolated loopback `*_test` or CI database | Explicit test URL; never load shared `.env` |
| Hosted UI/export checks | Branch-scoped Preview, separate staging DB/auth | Exact deployment SHA and environment identity; synthetic identities/data |
| Production diagnostics | Known production database in read-only transaction; authenticated read pages | Verify destination and read-only mode before querying |
| Production change | Exact reviewed candidate and scoped release procedure | Every applicable gate below passes |

Before each hosted command, establish its destination from trusted deployment/config
metadata; never infer it from the current browser tab or an inherited environment
variable. Never point fixture, migration rehearsal or restore commands at production.
Keep the audit branch's Preview isolation intact. Treat merges to `master` as production
deployments because the host automatically deploys that branch.

## 3. Change one metric family at a time

Write a short change manifest before release: candidate SHA, defect, affected team/keys,
effective period, source contract, expected writes, untouched data, validation evidence,
backup reference, rollback deployment and previous policy configuration. Separate code
deployment, source collection and metric publication; each must have an explicit state.
New producers default to inactive until their release checks pass.

Preserve the current restrictions: unverified human Tickets Updated/Resolved remain
unavailable; ticket-action shadow ingestion, action-v2 publication and historical repair
remain disabled. Dedicated qualified CSAT/first-reply policies are separate features;
do not broadly disable or enable every feature described as version 2.

No correction may silently change employee/team assignments, earlier weeks, targets,
unrelated metric families or existing source evidence. Use an explicit prospective
cutover. Retain predecessor values and source versions. Do not credit ambiguous
activity, substitute a different measure, turn missing data into zero, or compare a new
definition with an incompatible old target.

## 4. Release gates and required evidence

| Gate | Pass condition | If it fails |
|---|---|---|
| Source meaning | Written unit, date basis/timezone, scope, attribution, numerator and denominator; source missing/zero distinguished | Keep candidate unpublished; investigate the precise mismatch |
| Independent correctness | Rebuild exact source sets independently; zero unexplained missing/extra IDs and count differences; compare sums/denominators before rounding | Retain discrepancy evidence; totals alone cannot certify employees |
| Coverage | Pagination/count/duplicate checks, retained versions, identity mapping, parent joins and observation freshness verified | Mark affected results unavailable or explicitly stale; never certify endpoint exhaustion as joined completeness |
| Code and persistence | Typecheck, lint, appropriate regression tests, full CI/build on exact candidate; PostgreSQL rollback/concurrency tests for writes | Fix locally; no merge to production |
| Hosted behavior | Synthetic current/history/revision views, authorization, column alignment, duration/sample labels and actual export bytes checked when affected | Keep the previous behavior; record any unverified file formats |
| Recovery | Fresh encrypted backup, successful restore to a separate database, matching row digests; tested schema compatibility and exact rollback/config references | No production change |
| Scoped publication | One labeled controlled canary; exact team/period/key scope; atomic publication and retained revisions; independent post-publication comparison | Disable the new publisher and preserve evidence; recover only its affected values |
| Live operation | Exact production SHA/alias, sign-in/core reads, errors/runtime/freshness and genuine scheduled executions observed | Keep status incomplete; investigate without manufacturing scheduler evidence |

Use at least two closed weeks for an ongoing metric contract where reliable source
history exists, plus current-week checks; include transfers, nulls, zeros, late updates,
deleted groups and period boundaries. A missing historical snapshot is a documented
limit, not permission to invent a reference. Display rounding may differ; raw count,
source-set and denominator differences must be zero and numeric tolerances explicit.

Before widening a canary, hash/check unrelated rows and earlier periods against the
baseline and verify revisions. A successful manual request does not certify cron.
Observe the next real slot separately; do not add unrequested recurring monitors or
run extra syncs to make the evidence look complete. Do not make a Friday release depend
on the user doing weekend validation.

## 5. Stop, contain and recover

Stop the affected source operation on a manager lock/disruption, foreign account or
destination, credential exposure, rejected pagination, repeated rate limiting or unknown
source completeness. Close any offending UI session immediately. Retain minimal aggregate
incident evidence and notify the user of the impact and containment. Continue safe local
work; do not retry through another mechanism that defeats a safety rejection.

Stop new publication on an unexplained mismatch, ownership/team change, unexpected write,
expired lease, failed backup/restore, migration incompatibility or deployment regression.
Preserve the last good publication with its real observation time; do not label old values
fresh or silently hide a known correctness defect. For a deployed defect, disable only
the affected new policy/schedule, select the recorded compatible application rollback,
and verify core reads again. Restore affected values transactionally from their retained
revisions only after checking for newer writes. A full production database restore is
not the default rollback: it could erase legitimate newer work.

Do not repeat an action requiring user interaction after an actual access block. Explain
the concrete dependency only when it truly cannot be resolved from existing authorization
and evidence. Routine checkpoints need no new approval.

## 6. Keep secrets and private evidence out of Git

The GitHub repository is public. Commit only synthetic fixtures, code and aggregate
evidence; no employee identifiers, raw vendor records, credentials, report exports or
plaintext backups. Before staging, inspect the explicit path list and diff; avoid broad
staging while private diagnostics exist. Private source snapshots stay in ignored storage;
backups/recovery files stay in the restricted directory outside the repository. Verify
absolute backup paths before creation. Never print environment values to diagnose a failure.

## Implementation status and next steps

- **Existing controls:** isolated test-database validation; separate Preview DB/auth;
  production read-only census; scoped publication/revisions; tested backup/restore
  procedure; CI type/lint/test/migration/build checks. Their presence is not proof that
  a particular release has passed them.
- **Effective operating rules now:** no Zendesk mutations or report editors; reuse
  retained evidence; require explicit release evidence; stop/contain failures; protect
  manager access and private data. `AGENTS.md`, engineering rules and handoff link here.
- **Local candidate, not activated:** outbound calculator, durable Talk page/revision
  storage, account-bound lease/CAS checks, persistent pacing and GET-only bounded worker.
  Candidate `fedf71c` passed full CI with 713 tests / 92 files and Preview. The newer
  linked-ticket reader and joined observation gates have 18 affected passing tests
  (50 focused checks total, including eleven real PostgreSQL tests); their full CI and source-wide coordination
  remain required. No new Talk route, scheduler, production policy or metric publisher is active.
- **Outbound publication candidate:** strict prospective team/key policy, minimized replay
  evidence and explicit legacy-contribution replacement are implemented on the branch.
  All 20 database publication tests and 23 targeted unit checks pass; source connection,
  full CI and hosted/recovery release evidence remain. No live policy consumes this path.
- **Next:** finish those candidate checks; qualify missing POS employee-level export
  evidence without opening report editors; implement explicit joined-coverage/publication
  gates; rehearse in staging; then perform a scoped release only when this plan's gates pass.

The [implementation ledger](audits/2026-09-23-implementation-progress.md) owns current
results and open gates; the [runbook](RUNBOOK.md) owns command/recovery procedures. Keep
each result tied to a source observation, environment, exact candidate and timestamp.
