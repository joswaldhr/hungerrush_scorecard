# Friday release handoff

The user needs the site/app usable Monday, September 28 and is unavailable Saturday and
Sunday. Friday, September 25 is the handoff target. Execution is authorized; routine
checkpoint approval is not required. This is a delivery target, not a claim that unresolved
metric semantics are verified or that deployment has occurred.

## Release scope and acceptance

- Microsoft sign-in succeeds; unknown/inactive users and out-of-scope records remain denied.
- Manager and employee views load with the correct week and employee. History, navigation,
  correction evidence and exports preserve that context.
- Verified stored values remain usable. Tickets Updated/Resolved remain unavailable under
  the user's human-only policy until source-bound human evidence is validated. Historical
  target judgments remain withheld where historical configuration is unknown.
- Core administration saves are authorized, atomic where required and report failures.
- Publication remains atomic; failures preserve prior values and do not claim freshness.
- Production migrations are compatible, a recent backup restores successfully, and the
  previous production deployment is recorded before rollout.
- Verify the deployed candidate with actual production sign-in/read workflows and source
  status. Do not describe CI or Preview evidence as production acceptance.

## Ordered remaining work

1. Resolve the read-only production preflight findings and verify current environment
   isolation/flags. Refresh backup and restore evidence close to deployment.
2. Verify the exact candidate's CI and Preview, review migration compatibility, and establish
   a brief controlled cutover that drains older workers before the new publisher runs.
3. Apply compatible migrations explicitly, deploy, and exercise the production acceptance
   checks. Preserve a rollback path and report any remaining limitation before handoff.
4. Verify scheduled sync behavior as time permits before Friday handoff. Clearly distinguish
   controlled execution from observed scheduled execution; neither certifies metric semantics.

## Deferred from this release

Optional styling and new features, historical data repair, version-2 metric publication,
unreviewed human attribution, historical membership/target reconstruction and recurring
shadow ingestion are deferred. Keep the shadow source/scheduler ingestion disabled. Retention
and external alert delivery are prerequisites for enabling ongoing shadow operation.
Portable off-machine recovery/provider PITR remains unproven and must not be implied by a
successful local restore.

## Current production preflight

Read-only observation: `2026-09-24-production-release-schema-census.json`. Production remains
at `ab062c33f70e2152b8786f6a8ade5a7e0ab96697`, deployment
`dpl_n5978weiS8aDUPYswkWAMkmbw7JL` (READY). Recheck this before rollout.

- PostgreSQL 18.6; zero duplicate visibility scopes.
- All 11 recorded migration hashes match candidate files exactly. Migration 0009 is absent
  from the journal, while its required NOT NULL columns, unique identity index and aggregation
  column are present. The repository's legacy `phase1-apply-migration.ts` performs those
  changes without recording a journal entry. This is consistent with a manual application,
  not proof of its execution history. Do not re-run its destructive duplicate cleanup or
  silently insert a journal entry. The restored-copy upgrade must verify the real state.
- Newer candidate migrations are 0012–0014. A strict full-prefix match intentionally remains
  false because of the missing historical journal entry.
- Five old running rows remain; newest started September 10. Four completed runs occurred
  in the last 24 hours, with no failed rows in that interval. Row age alone does not prove a
  worker is absent. Do not erase evidence to make the check appear green.
- One configured Zendesk source has no account reference. That reference is mandatory for
  shadow ingestion; do not enable shadow operation or invent a binding for legacy evidence.

The census contains aggregates and migration/schema facts only. It performs no database
writes and never fetches vendor data. Its output is a new file on each invocation.

The 01:53 UTC September 25 read-only backup restored all 32 tables / 28,878 rows with
identical contents, then applied candidate migrations through 0014 without changing any
existing application data. See `2026-09-24-production-restore-release-candidate.json`.
The encrypted archive and private manifest remain outside Git; the disposable cluster,
plaintext archives and local password were removed. This verifies the actual legacy state
can upgrade without replaying 0009. It does not fix its journal or prove historical cleanup.
Refresh again if source data changes or rollout is delayed materially.

Production environment metadata at this checkpoint includes the existing database, SSO,
cron and Zendesk keys; neither shadow opt-in nor shadow credential nor sync heartbeat URL
is present. Metadata presence is not credential validation. Production environment entries
were not changed. External sync alert delivery is not configured by this release check.

## Candidate fetch and authentication checks

The existing production Microsoft sign-in completed successfully into the admin view. No
new credential or role was required. Candidate CI runs 36084274927/36084270689 and Preview
`dpl_HeLiguYaVE1fYaETCPerNGFVmJkd` passed at a2752aa.

The candidate's actual current-week Zendesk fetch completed in 159,204 ms with 318 GETs,
five rate-limit responses/retries, 62 identities and 186 in-memory records. The PostgreSQL
connection was read-only, and the harness did not call the sync publisher or retain payloads.
See `2026-09-24-production-fetch-release-candidate.json`. This is one local timing sample;
it excludes publication/hosted latency and does not certify worst-case duration or business
attribution. The standalone harness caps requests and fetch duration and aborts sibling
requests during cleanup. No recurring ingestion was enabled.

The synthetic Preview export menu actions executed, but file-byte acceptance remains open:
the in-app browser download observation timed out and its clipboard bridge returned the
prior editor clipboard even after the page showed the copy-success toast. Neither observation
proves an application export defect or proves the exported file is correct. Existing automated
export-context/CSV tests pass; do not substitute that for hosted file-byte inspection.

## Production migration checkpoint — 02:09 UTC September 25

The guarded operator command rechecked the exact candidate HEAD, clean checkout, restored
backup less than one hour old, all 11 migration hashes, zero recent running jobs, zero duplicate
visibility scopes, and an exact content match between every production table and the restored
backup manifest. It then ran the standard transactional Drizzle migrator with 5-second lock
and 60-second statement limits. Migrations 0012–0014 applied successfully. Every existing
application table retained its row count and content digest (excluding only the new nullable
roster column); the new revision table is empty. The historical 0009 journal gap was preserved.
See `2026-09-24-production-migration-release.json`. No historical repair or metric publication
was run. Application deployment is the next step.

Application rollback target remains `dpl_n5978weiS8aDUPYswkWAMkmbw7JL`. Preserve the compatible
schema and revision evidence on rollback. Vercel's documented rollback restores the prior
deployment's configuration and cron definitions and disables automatic production-domain
assignment until a later promotion. The official CLI implements rollback with an empty-body
POST to `/v9/projects/{projectId}/rollback/{deploymentId}`. This action has not been invoked.
References: [Vercel Instant Rollback](https://vercel.com/docs/instant-rollback) and
[official CLI implementation](https://github.com/vercel/vercel/blob/main/packages/cli/src/commands/rollback/request-rollback.ts).
