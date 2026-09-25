# First execution checkpoint — September 25, 18:08 UTC

Execution began approximately 16:37 UTC. This checkpoint records observed capabilities,
defects and the next release path; it is not a request for approval or a production release.
The denominator remains 23 assigned keys / 40 team assignments, with **0 newly certified
production assignments** under the replacement contracts. Prior application/display releases
remain deployed.

## Results and concrete dependencies

| Family | Observed result | Next requirement |
|---|---|---|
| CSAT | 46 Menufy and 64 POS row-week comparisons match two closed weeks. One exact 12-ticket incident set matches | Complete source-ID comparisons, version solved-date/current-assignee/group contracts, retain raw numerators/denominators and qualify late changes |
| Menufy inbound calls | 30 + 26 named rows match eight measures in two weeks. One exact eight-leg incident set matches | Full related-leg replay passes both weeks; first-week 920 named leg IDs and eight values match exactly. Finish second-week source sets and scorecard target/grain compatibility; report abandonment is participation, not responsibility |
| POS inbound averages | 55 rows match eight measures, including numeric CSV precision; report uses leg dates and mixed leg/call durations. Its on-hold abandonment label counts IVR/queue/voicemail instead | All 2,012 first-week leg IDs and eight values match. Complete a second week. Correct the mislabeled formula in the proposed contract. Four historical selected group labels do not resolve by name in the complete current/deleted group API census; do not silently replace them |
| Outbound calls | Source call and leg APIs are accessible and bounded | Inspect actual outbound report contract and complete both-team source-set comparisons |
| First response | Retained arithmetic reproduces; additional latest-update filtering excludes 133 tickets in the incident closed-week creation cohort. Central/UTC boundaries differ | Correct cohort, label it first public reply in business time, establish per-ticket schedule and target compatibility; current assignee is not reply authorship |
| Ticket handling effort | Existing workforce access succeeds; all 62 current employees match uniquely by exact email. One employee's state sample and solved-ticket effort report are available | Validate units, state exclusions, overlap/segment identity, channels and full pre-solve history. One-week state activity is not the complete numerator for tickets solved that week |
| Human ticket activity | Ticket events/audits exist; employee identity, role and web channel alone still do not prove manual action | Establish source-bound child-event provenance or a reviewed-event producer with complete coverage. Ticket viewing does not prove a human update/solve |
| Elevated/avoidable work | Menufy and POS use different fields/tags | Bind each team's actual workflow and historical child-event work attribution before counting |
| Backlog | Current ticket snapshot is accessible | Compare matched observation instants and exact assignee/status/group scope; do not fabricate historical snapshots |

## Revised execution order and forecast

1. Finish POS call reconciliation and full parent-call/leg boundary validation, then qualify
   the first CSAT/call source sets. These are bounded engineering tasks with working access.
2. Build independently releasable, versioned CSAT and call candidates. Preserve numerator,
   denominator, source IDs, timezone, cohort, team-specific scope and target context. Do not
   activate unrelated human-attribution or effort metrics with that batch.
3. Run the candidate's integration/CI checks, synthetic hosted comparison and actual export
   checks; refresh the production backup and restore rehearsal, then deploy and verify the
   first passing batch under existing authorization. Historical repair stays disabled.
4. Qualify the newly available workforce evidence separately. The retired scheduling
   connector remains retired; discovering working access is not authorization by evidence
   to silently republish scheduling metrics or reuse stale identity mappings.

Planning estimate from this checkpoint: another 1–2 hours for remaining first-batch source
qualification, 2–4 hours for implementation/integration, and 1–2 hours for hosted/backup/release
verification if those checks pass. This is a provisional 4–8-hour path for a first qualified
batch, **not an estimate for certifying all 40 assignments**. Full metric certification by
Monday cannot yet be promised. Human attribution and complete effort reconstruction have
no defensible completion time until their remaining evidence conditions are resolved.
No weekend user participation or routine checkpoint approval is assumed.

## Validation and operational limits

The independent references now have 24 passing focused tests. TypeScript, focused ESLint and
formatting passed. Commit `eb25aa2` passed both CI runs 36170406496 / 36170411326. Draft PR27
contains code and aggregate evidence only; private payloads and identifiers remain in local
Git-excluded scratch files. No new production metric formulas, data or target values changed.

The first call extract padded both call and leg creation dates. A separate full related-leg
read now retains all fetched leg creation dates to qualify the parent-call boundary rather
than assuming calls end within the padded interval. It completed 49 pages / 47,553 unique
latest legs; replay reproduces all eight measures for both weeks (56 named row-weeks).

Explore CSV bytes were inspected for all 55 POS rows and eight measures: exact counts and unrounded durations match within 1e-9 seconds. Cadence hosted export-file byte inspection remains unverified. The earlier four scheduled metric
publications passed, but the corrected roster path still lacks an observed scheduled run.
The completed one-time scheduler verification automation remains paused.
