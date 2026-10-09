# Qualified import recovery candidate — October 9

Local candidate only. No source requests, publication, environment changes, schedule changes,
or deployment were performed for this increment.

## Defects and changes

First-reply's daily route could lose its request when a source cooldown or another reader
prevented a run. Its connector inherited fixed-period capability but recomputed dates from
an offset. The connector now validates and consumes the saved period, and the direct route
pins it before asynchronous cooldown checks. Source meaning, timezone and cutover remain
unchanged.

`ZENDESK_FIRST_REPLY_RECOVERY=1` is a separate, default-off opt-in. It requires an active
report dispatcher, qualified first-reply policy and matching organization/source/account.
Both qualified CSAT and first-reply routes enqueue due demand instead of running duplicate
direct collectors when their recovery switches are enabled. Enqueue failure cannot fall back
to a vendor request; delegated responses are 202 with `completed: false`.

The shared dispatcher attempts one claimed job per tick using the existing sync lease,
account coordination, atomic publisher and retained vendor retry delay. Original fixed periods
survive Sunday and worker replacement. Policy changes exclude old jobs from execution.
Planning preserves each original daily UTC slot: CSAT 08/10/12/14, first reply 16/18/20/22,
with prospective cutovers. Before a slot is reached, its latest prior-day demand remains
eligible; enabling recovery may therefore catch up those original saved periods. The bounded
queue accepts at most 24 requested definitions and six active policy hashes (maximum planned
set: 21 definitions with two solved policies and all three optional import families).

Data Health now includes configured CSAT, first-reply and legacy recovery jobs. Team labels
come only from the caller's assigned teams; organization/source binding and direct-employee
assignment restrictions remain. Multi-team collectors are labeled shared imports, not separate
team jobs. Health reads neither request work nor contact Zendesk. As before, this view describes
the currently planned horizon, not an unbounded history of pending older jobs.

## Validation

- TypeScript: pass.
- Scoped production-code ESLint: pass.
- Planner/config, cron routes and dispatcher: 35 tests pass across four files.
- PostgreSQL queue, health authorization/nonmutation and first-reply bindings/fixed-period:
  24 tests pass across three files, using explicit isolated loopback test database.
- Test fixture fixes: added synthetic credentials to the mocked collection-path fixture;
  corrected zero-padding in a test timestamp. Neither failure involved vendor access.
- Production policy flags remain unchanged. Full integrated CI/build, fresh restore, hosted
  health acceptance, scoped canary, source reconciliation and actual scheduler/recovery
  evidence remain release/activation requirements.

## Activation and rollback

Do not enable the new switch merely because these tests pass. Recalculate dispatcher capacity
including the additional first-reply jobs and vendor throttling, qualify a fixed-period canary,
and observe real scheduled attempts and their resulting publications. Queue completion is
operational evidence, not metric certification. Leave human attribution, shadow/v2 publication,
historical repair, demo data and vendor configuration unchanged.

For rollback, disable the specific optional recovery switch before returning to the recorded
compatible application deployment; the original daily route then resumes direct collection.
Preserve queued records and verify no in-flight recovery lease before enabling overlapping
execution. Do not erase publication history or change source definitions.
