# September 28 code deployment

The user explicitly instructed merging PR32 and deploying production. This manifest
separates that code deployment from enabling new metric definitions or collection.

## Scope

- Application candidate: `e6510cc709b0bde4aabdfd4c4735831c5f658d5e`, plus release-evidence-only
  documentation. Both exact-head CI runs 36434706285/36434695487 passed; 782 tests / 103 files,
  PostgreSQL migration checks, typecheck, lint and production build. Vercel Preview is READY.
- Active changes: shared, bounded Talk request coordination and terminal-page verification;
  fewer unused legacy duration-detail requests; safe Support failure diagnostics; exported
  explanations for withheld human ticket activity. No source definition, target, assignment,
  schedule or database schema changes.
- New durable Talk collection and outbound publication routes/code remain **disabled**:
  production has neither `ZENDESK_TALK_COLLECTION_POLICY` nor `ZENDESK_OUTBOUND_POLICY`.
  They have no schedule entries. Their outstanding hosted synthetic/source/canary gates
  apply before activation; this deployment does not satisfy or bypass those gates.
- Existing qualified CSAT and first-reply settings remain unchanged. Human ticket counts,
  shadow ingestion, action-v2 publication and historical repair remain disabled.
- Zendesk remains GET-only, without report/dashboard editor sessions or mutations.

## Recovery and active-path checks

Create a fresh encrypted production snapshot and restore it into an isolated local
PostgreSQL 18 instance, checking every table digest and schema compatibility through 0015.
Retain private recovery files outside Git; no cleanup deletion. Record aggregate evidence
in `2026-09-28-code-release-backup.json`.

Before merge, exercise the candidate's slowest observed and oldest supported weekly fetches
(offsets 1 and 3) against bounded live GETs, with all database coordination confined to the
isolated restored copy. Stop on 429, foreign endpoint, incomplete pagination or an overrun.
Require each fetch under 270 seconds to leave publication headroom in the 300-second host
budget. This is a local real-source measurement, not proof of future hosted latency or
genuine scheduler execution. No metric publication or production database write occurs
in this qualification. Record aggregate timings in `2026-09-28-code-release-runtime.json`.

The prior deployed application and immediate rollback reference are
`8a0c4bd8b26ac660b0cfd1a7e5dddd41a687debc` /
`dpl_69LgEzQCG6k9LCfdBWsnhKbb4AuQ`. There is no migration to reverse. If the application
regresses, restore that deployment while preserving current data, policies and revisions.
Do not restore the full database over legitimate newer writes.

## Deployment verification

Merge only the verified head after fresh backup/runtime checks pass. Verify Vercel's
production alias is READY on the resulting merge commit, then check authenticated manager
navigation, the reported scorecard, period/history reads, and the changed export explanation.
Verify new policies remain absent. A code release and a successful manual check do not
certify scheduled syncs or every metric. The receiving manager's own sign-in still requires
their account identity; an administrator View-as check is labeled accordingly.
