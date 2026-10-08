# Fixed CSAT periods and separately gated recovery

## Verified production result

PR50 merged at 15:21 UTC to `2a62d53337765c553b2cdaffa0415cf764fd103e`.
Master CI/build `37800104959` passed. Production `dpl_FjYh9B34SCKicN55KR1pCTRE17JA`
is READY and owns the live alias. Login/authenticated representative reads, anonymous
rejection and disabled recovery checks pass. All 22 environment metadata entries and
16 cron definitions remain unchanged. No extra source sync was triggered for the smoke
check. See `2026-10-08-csat-release-smoke.json`.

Independent read-only reconstruction additionally checks all 255 CSAT values/cohorts
across two closed weeks and the current week for 62 current staff, with zero differences.
This is retained-source reconciliation, not fresh Explore parity or historical roster
certification. See `2026-10-08-csat-three-periods.json`. Recovery activation and actual
unattended execution remain separate incomplete work.

## Release manifest

Candidate `e4231e61c6faf8b11e20982dc180aa0da84f18e4` (PR50) passes exact
CI/build `37799303964`. Local validation passed 1,216 tests / 151 files, typecheck
and scoped lint. The code pins scheduled CSAT dates before asynchronous work and
retains fixed dates when queued work resumes. Optional CSAT recovery uses the
existing account lease, policy-bound queue, persisted backoff and atomic publisher.
Recognized source 429 retry-after survives into a failed job's retry deadline.

This is a **code-only release**. Both `ZENDESK_REPORT_RECOVERY` and
`ZENDESK_CSAT_RECOVERY` remain absent; no queue activation, source collection,
assignment, formula, target, credential or cron change accompanies the release.
The 22 production environment metadata entries and 16 cron definitions are the
pre-release baseline. Existing qualified CSAT policy remains unchanged.

## Hosted and recovery gates

Runtime/script-identical isolated Preview `0eee0479fbebbb7055ae61876586f5000b5d065e`
is READY at `dpl_4gEk74umzJhZyBTyEyirK51C4RQi`. Its explicit guarded build exercises
the real CSAT staff binding, collector, source-record adapter, normalizer and atomic
publisher using only a synthetic transport/account and a separately owned synthetic
organization. Eighteen values across September 20–26, September 27–October 3 and
October 4–10 match expected results, including three zeros and six no-sample nulls.
All unrelated values match. The actual queue persists a fixed current-week job's
cooldown without issuing another simulated source request. Nine simulated requests,
zero vendor requests and zero production access were recorded at 15:17 UTC.

Failure, interrupted-owner, stale-acknowledgement, removed-policy, longer-than-one-day
retry and rollover cases pass separate PostgreSQL/worker tests. Hosted cooldown is
pending work, not proof of unattended recovery. There are no UI/export changes in
this release; the separate production refresh was checked in the authenticated
representative scorecard, including its new source observation time and null reason.

Fresh encrypted restore at 15:06 UTC matches all 35 tables / 374,350 rows and schema
compatibility through 0017. The receipt is `2026-10-08-csat-refresh-restore.json`;
its DPAPI profile-bound limitation remains. Recheck its one-hour age before merge.

## Rollout and rollback

Recheck exact PR head/CI and merge the candidate. Verify master CI, READY deployment,
live alias, login, authenticated core reads, disabled recovery and unchanged environment/
cron metadata. No active source endpoint should be invoked merely to smoke-test code.

Rollback is `dpl_GNJxmAjuSeCfUVrTVui2ete9WtQ4` (`baca908`), with both recovery switches
still absent. It preserves the existing qualified POS and CSAT publications. No new
production queue payloads are created by this release; no data repair is needed.
After any later CSAT queue activation, older workers cannot decode new CSAT jobs:
keep this compatible worker as the rollback baseline, or keep both switches off
when reverting to an older deployment. Never delete queued evidence to make rollback pass.

The independently checked current-week CSAT refresh at 15:09 ran on the existing
`baca908` production code. Its 85 employee metrics, retained predecessors and unrelated
digests passed separately; see `2026-10-08-csat-controlled-recovery.json`. A controlled
success does not prove adequate scheduler capacity or unattended retry. Those gates,
other metric families and complete team scorecards remain open. Zendesk and the demo
remain unchanged.
