# Main application operational upgrade

The user authorized completing and upgrading the main application while leaving the
presenter's demo frozen. This record separates usable UI delivery from metric qualification.

## Frozen demo and working boundary

- Demo deployment: `dpl_6zgVGDyR2tW1JMVmbmv7hTm4fTYR`, app SHA `f17821c`.
- Preserve its alias, access settings, fixtures and share link. No demo branch pushes,
  demo redeployments, alias reassignment or fixture resets as part of this work.
- Main candidate branch: `codex/main-operational-upgrade`, based on production `ed6b2df`.
  Reuse the clean, idle managed checkout; the presentation branch remains unchanged.
- Automatic deployments of the candidate branch are disabled. Hosted checks require a
  separate Preview URL, synthetic database and a verified environment before execution.
- Zendesk remains read-only with no report/dashboard editors, per the latest AGENTS
  instruction. This supersedes older documentation permitting brief editor inspection.

## Ordered delivery and acceptance

1. **Manager review and export release.** Carry the previously tested last-week default,
   neutral current-week presentation, stable sidebar, configured headlines, guarded
   comparisons and reliable file delivery into the main app. Exclude demo routes,
   fixtures, demo authentication and PR38's unqualified inbound publisher. Verify
   current/history scope, missing versus zero, warnings, targets, navigation/races,
   print and actual PDF/PNG/CSV output on this exact combined candidate. Full technical
   gates, fresh recovery and production smoke checks precede completion.
2. **Operational census.** Refresh read-only production evidence for published values,
   source freshness, failed/interrupted runs, effective policies and real scheduler
   outcomes. Do not manufacture scheduled evidence with manual jobs. Make the next
   correction follow the actual failure, not old checkpoints.
3. **Metric qualification.** Maintain the 40-assignment acceptance denominator. Work one
   family at a time: call collection/publication and inbound contracts; CSAT/reply
   recovery; verified-human tickets; handling/elevation/backlog; historical targets.
   Reuse retained evidence, reconcile exact employee/period sets independently and
   publish only qualified scoped changes. Unverified attribution stays unavailable.
4. **Completion review.** Reconcile UI/history/exports, test manager boundaries and
   recovery, document remaining external dependencies, and update the acceptance ledger
   with observed production results. A usable page or passing CI is not certification.

## Baseline

Production is `ed6b2df` / `dpl_DBWaKeHfuutr8i3qeyAawQUCSUJ6`. The prior acceptance
ledger records 14/40 assignments with verified production arithmetic and 0/40 complete
contracts. These are dated evidence counts, not an engineering progress percentage.
New source publishers, human-action ingestion/publication and historical repair remain
disabled. No schema, vendor configuration, employee assignment or metric policy changes
are included in the first UI release.

## Validation

In progress. The reused checkout contained an ignored private recovery script included
by the broad TypeScript glob; exclude private backups/nested worktrees from application
typechecking. The dependency directory is an existing shared junction; invoke the
installed tools directly instead of letting pnpm try to replace that junction.
