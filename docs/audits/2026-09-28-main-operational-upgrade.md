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

Candidate `3bfc9df37070db21d22a0cc17349769cb01514b2`, PR41, passes exact CI
`36487847138`: 866 tests / 109 files, TypeScript, lint and production build. Local
checks pass as well. Prior-week comparisons now require complete quality for both
observations; the integration query carries the prior observation's actual quality.

The reused checkout contained an ignored private recovery script included
by the broad TypeScript glob; exclude private backups/nested worktrees from application
typechecking. The dependency directory is an existing shared junction; invoke the
installed tools directly instead of letting pnpm try to replace that junction.

## Separate Preview and remaining release gates

Main Preview `dpl_5hvg7HpvnPKgoYeJsrbJU55KrPHU` is READY at the exact candidate SHA.
Its separate branch alias ends `git-code-6aedad-water-hungerrush-scorecard.vercel.app`.
The frozen demo remains READY at its recorded deployment and original alias.

Two initial builds failed the explicit database isolation guard before the application
build. Inheriting an existing deployment did not retain its old branch's sensitive
environment overrides. Record these as prevented unsafe builds, not successful checks.
The resolved Preview uses an explicit main-branch-only synthetic staging database
override, independent auth/session and cron secrets, and blank vendor credentials and
source publication policies. No existing demo or production variable was changed.
Sensitive values stay out of this record.

Anonymous main Preview navigation reaches Microsoft sign-in. Authenticated checks are
pending a separate single-tenant Microsoft registration, prepared as “HungerRush Cadence
Main Preview” with only this Preview's callback. The browser tool requires action-time
confirmation for new persistent authentication access; that question is pending. Existing
demo authentication remains unchanged. A placeholder deliberately prevents accidental
use of the existing application's credential. Do not claim hosted manager or export
checks have passed on this candidate yet.

After authentication setup: verify the combined synthetic UI and actual export bytes,
then obtain a fresh encrypted backup/restore and pass production rollout/smoke gates.
No merge to master or production upgrade has occurred.

## Fresh reporting health and independent recovery work

The read-only September 28 census observed 12 completed and two failed runs in the last
24 hours, with no running or stale workers. Failures were a CSAT 429 and an outbound
source-coverage rejection. Later successful controlled jobs do not prove scheduler
recovery. Aggregate reports retain intervals, quality and observation evidence; hosted
invocation correlation remains incomplete.

PR42 (`codex/csat-bounded-recovery`) separately adds one vendor-directed bounded CSAT
retry. Its default remains disabled for other users of the shared transport. It changes
no formulas, policies, schedules or historical rows; the original collection deadline
and request budget remain. See `2026-09-28-csat-bounded-recovery.md` in that branch.
