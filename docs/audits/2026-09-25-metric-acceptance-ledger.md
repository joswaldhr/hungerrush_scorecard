# Metric acceptance ledger

## October 5 — fresh POS baseline

The read-only inventory remains 40 assignments / 23 keys, including 19 POS assignments
and 39 active POS employees with unique source mappings. Qualified last-week outbound
observations stop on September 28; this week's rows still use legacy source context.
The automatic qualified call policies remain disabled. Recent successful jobs therefore
do not certify complete POS reporting. No full-contract count is increased.

The shared hosted export gap has advanced: actual PDF/PNG/CSV files were saved, a narrow
capture clipping bug was fixed, and fresh files match displayed/historical synthetic
values. This establishes presentation agreement, not independent source correctness.
See `2026-10-05-pos-readiness.md` for current evidence and remaining release dependencies.

## October 5 — POS qualification scope and completion clarification

The user requested bringing the POS manager's metrics to the same standard as Menufy.
Menufy is **not fully certified**: the October 2 checkpoint confirms interactive Preview
sign-in and core reads, not completed hosted export verification, inbound production
activation or genuine scheduled recovery. Human ticket activity and other unresolved
definitions remain separate gaps. Do not carry the dated arithmetic counts below forward
as a current completion percentage; refresh inventory and source observations first.

Initial POS evidence review reuses the retained September 25 inbound comparison and
September 28 outbound release. The latter independently matched 195 published values
across 39 employees for one controlled observation. The inbound comparison matched 55
report rows and all 2,012 source legs for September 13–19. These are historical evidence,
not current freshness or complete-contract certification. Four selected historical group
labels were unresolved. The report's abandonment label includes IVR/queue/voicemail
abandonment, and its hold mean repeats whole-call hold across joined legs; reproducing
those formulas does not establish that their labels describe employee performance.

POS work proceeds in this order:

1. Refresh read-only production inventory, bindings, reporting periods, active policies
   and failed/stale jobs. Reconcile the current assignment denominator; preserve the
   prior observations and distinguish controlled runs from actual scheduled execution.
2. Establish POS report-specific definitions and scope from retained reports/source
   evidence. Resolve call versus leg date, agent/supervisor participation, selected groups,
   zero/null behavior and the abandonment/hold discrepancies. Do not inherit Menufy's
   SUM/MAX, offered-call components or date basis merely because its implementation exists.
3. Independently reconcile every eligible POS employee for two closed periods and the
   current period where source history supports it. Require exact source membership,
   counts, duration sums and measured denominators before display rounding; retain missing
   parent/source coverage as unavailable. Reuse existing outbound/CSAT evidence and
   investigate the specific remaining gaps rather than restarting those families.
4. Verify matching hosted scorecard/history/PDF/PNG/CSV snapshots, then complete fresh
   recovery, scoped production canary and genuinely scheduled refresh checks. Publish
   only qualified families; preserve unrelated metrics and the frozen demonstration.
5. Close ticket-human attribution, elevated work, handling/backlog and target-context
   dependencies separately for each applicable assignment. Never mark either team complete
   solely because call arithmetic, sign-in, a deployment or a synthetic fixture passes.

This increment changes documentation only. No new source reads, report editors, production
writes, deployment changes or policy activation occurred. The main implementation ledger
continues to own release state; the dated sections below retain their historical context.

## September 28 acceptance requirement

The user requires **100% metric accuracy and 100% reporting**, reaffirmed after PR32's
production deployment. A usable page, successful deployment, passing tests, disabled
metric or unavailable value caused by an unresolved defect does not satisfy this requirement.
The inventory remains **23 assigned keys / 40 team assignments**; do not reduce that
denominator to the families currently working. Recheck the inventory if assignments change.

For each assignment, completion requires all of the following:

1. An explicit definition, unit, reporting timezone/date basis, employee attribution,
   scope, numerator, denominator, zero/no-sample behavior and compatible target policy.
2. Complete source sets for every eligible employee in the qualified periods: pagination,
   duplicates, late changes, identity mappings and required parent joins accounted for.
   Reconcile at employee/period/key level, not just team totals or selected examples.
3. Independent reconstruction with zero unexplained source-ID, count or denominator
   differences; compare raw duration sums before documented display rounding. Use two
   closed weeks and the current week where retained history supports those checks.
4. The qualified calculation actually published in production, with matching current,
   history and export results, revisions and preserved unrelated values. Deployed but
   disabled code earns no reporting completion credit.
5. Genuine scheduled execution, correct intervals, observed freshness and tested failure/
   recovery behavior. A successful manual recovery is not scheduler evidence. Source gaps,
   rate-limit failures and stale observations remain visible and unresolved until repaired.

A verified empty population may legitimately have no average or CSAT score; that is a
reported no-sample outcome, never a fabricated zero. An unknown population, missing join
or unverified attribution is an incomplete result. Certification is bounded to documented
periods, source observations and deployed definitions; it is not a guarantee that external
services can never fail. Future failures must be detected rather than silently misreported.

**Current evidence, September 28 18:08 UTC:** 14/40 assignments have independently verified production arithmetic;
full-contract certification remains 0/40 in this ledger. This is a qualification count,
not a claim that every remaining value is wrong or an estimate of engineering effort.
The September 28 POS canary and widening independently match all 195 current-week
outbound values across 39 employees, adding five assignments. All 143 predecessor
revisions and unchanged unrelated/history rows are verified; live scorecard/CSV parity
passes. No automatic collector policy is active. See the POS outbound release report.
The earlier Menufy/current-source observations below remain dated evidence.
The September 28 controlled CSAT recovery independently matched 85/85 values/cohorts;
its scheduled HTTP 429 cause remains open. PR32 deployed the call infrastructure with
new policies absent. PR33 corrected the outbound replacement guard, and a controlled
Menufy canary plus widening published five additional assignments / 115 current-week
values for all 23 employees. Independent values match exactly and 93 predecessor
revisions were verified. Automatic source refresh and genuine scheduler execution are
not yet certified; POS remains excluded because of employee parent-call gaps.
At 16:43 UTC the genuine first-reply scheduler published 23 current-week values
successfully (HTTP 200, 47.47-second function duration, `vercel-cron/1.0`, matching
database run). The separate outbound refresh subsequently rejected a new parent-call
gap without changing metrics; its activation was rolled back. These observations do
not increase the arithmetic denominator or remove remaining full-contract gates.
At 17:40 UTC the delayed-parent recovery candidate qualified all 62 Menufy/POS employees
from retained calls/legs with fresh bounded identity and ticket reads. Independent current-week
comparison matched 1,054 fields and 1,860 exact source sets with no differences and no
missing parents. This resolves the parent gap for that observation, not the general scheduler
or POS production gates. Production remains rolled back with the new policies absent;
see `2026-09-28-outbound-parent-recovery.md`.

Execution order: finish the call publication rehearsal and source gates; perform a scoped,
independently reconciled activation; resolve verified-human ticket activity and the handle/
elevated/backlog definitions; qualify targets and scheduled operation for each family.
Continue independent source/implementation work while external prerequisites are missing.
The hosted staging rehearsal passed using its credential inside its existing Preview
build environment, without extracting it; that blocker is resolved.
The September 28 user amendment permits brief no-edit report-definition inspection
with prompt closure. Zendesk mutations remain prohibited.

The dated September 25 baseline below is retained. Row updates for outbound reference
checks reflect later evidence. Menufy outbound production activation above supersedes
the older outbound rows' unactivated state; POS remains a candidate.

## September 25 baseline and subsequent family evidence

September 25 live investigation. Denominator: **23 assigned keys / 40 team assignments**.
**Source-to-production arithmetic is verified for 4 of 40 assignments (CSAT and Menufy first reply)** across 62 employees and 108 current-week values. Full-contract certification remains **0 of 40** while target compatibility and genuine scheduled execution of the replacements remain open.
That does not undo prior infrastructure/display validation. A sample match is not full
qualification; disabled metrics are not counted as complete. Evidence and private snapshot
locations are described in `2026-09-25-zendesk-live-findings.md` and the local investigation
scratch area. CSAT now uses explicit solved-date/current-assignee contract and calculation version 2 from September 20. Earlier observations retain their original meaning.

Status abbreviations: PV = production values independently verified; D = definition discovery; R = independent reference in progress;
B = source/attribution dependency. All rows still require applicable source coverage,
automated reconciliation, target review, staging/UI/export and production checks.

Talk candidate update, 22:00 UTC: 111 closed-week employee cases / 997 comparisons and
4,982 independent current-week field comparisons have zero differences. Two current POS
employee cases remain unavailable because of missing parent calls. These are candidate
calculation checks, **not additional production-certified assignments**. Durable collection,
joined-source coverage, outbound definitions and release gates remain open; see
`2026-09-25-talk-rollout-plan.md`.

| Metric key | Assignments | State | Finding / next acceptance requirement |
|---|---:|---|---|
| avg_call_duration_inbound | 2 | R | POS 55 rows match mean leg duration, with 2,012 exact leg IDs; define employee scope separately from whole-call duration |
| avg_consultation_time_inbound | 2 | R | POS 55 rows match non-null leg consultation means; preserve zero versus null and qualify scorecard denominator |
| avg_handle_time | 1 | R | Current value is full-resolution elapsed business time. Workforce access and all 62 identities now verified; solved ticket-viewing effort report exists. Units, lifetime numerator, exclusions, source sets and release remain open |
| avg_hold_time_inbound | 2 | R | Menufy report is MAX leg hold; POS repeats whole-call hold for each leg. Neither is employee mean leg hold; corrected denominator and targets remain open |
| avg_hold_time_outbound | 2 | R | Retained independent employee-leg reconstruction passes; separate measured denominator and zeros/nulls implemented. Hosted publication, compatible targets and production/scheduler gates remain |
| avg_response_time | 1 | PV | PR29 deployed; all 23 qualification values and exact source sets independently match. Current/history/CSV/PDF/PNG checks pass. September 28 current-week cron independently observed in hosting logs and database: 23 values, HTTP 200, zero errors. Compatible targets remain withheld |
| avg_talk_time_inbound | 2 | R | POS 55 means match with exact source legs. Menufy report sums leg talk; scorecard average requires an explicit denominator |
| avg_talk_time_outbound | 2 | R | Menufy 44 employee-period cases / 220 comparisons and POS 72 cases / 1,296 fields match independent reconstruction. Report whole-call/customer-leg duration is not employee leg talk. Activation and target gates remain |
| avoidable_worked_elevated_tickets | 2 | B | Team-specific fields differ; work attribution and history unresolved |
| backlog_count | 1 | R | Snapshot measure; compare matched observation time and exact status/group scope |
| csat_response_rate | 1 | PV | Menufy two-week source sets match; all 23 current-week production values independently reconcile. Current/history and export context pass. Targets remain withheld; genuine scheduled execution remains unobserved |
| csat_score | 2 | PV | Both teams' two-week source sets match; all 62 current-week production values independently reconcile. PR27 deployed with retained revisions and precision safeguards. Targets remain withheld; genuine scheduled execution remains unobserved |
| declined_calls | 1 | R | Menufy 56 row-weeks match distinct declined plus transfer-declined legs; both-week exact source sets pass; publisher and target context pending |
| inbound_calls_abandoned_on_hold | 2 | R | Menufy 56 participation row-weeks match, not employee responsibility. POS on-hold label wrongly counts IVR/queue/voicemail abandonment; do not copy it |
| inbound_calls_accepted | 2 | R | Menufy 56 row-weeks and POS 55 rows match completed positive-talk agent legs. POS exact source set matches; target/period and release gates remain |
| inbound_calls_offered | 2 | R | Earlier 56 row-weeks matched a three-component subtotal. September 28 inspection found the current Menufy saved formula also includes unreachable legs; exact scope/version reconciliation is required before publication. See the report definition review |
| missed_calls | 1 | R | Menufy 56 row-weeks match Central call-date missed-leg counts; both-week source sets pass; publisher and release pending |
| outbound_calls | 2 | R | Exact employee-participating call sets match retained independent references; POS aggregate report matches 14 days / 979 calls / 56 count checks. POS employee Explore export remains unavailable; hosted and production gates remain |
| outbound_calls_completed | 2 | R | Distinct participating calls, repeated legs and explicit completion classification implemented and independently replayed. Candidate source sets match; no production publisher activated |
| outbound_calls_non_answered | 2 | R | Explicit retained-source outcome classification passes replay; uncertain outcomes stay null. Candidate success does not establish fresh live coverage, production publication or scheduler operation |
| tickets_resolved | 2 | B | Verified-human policy retained; audit child provenance and historical eligibility unresolved |
| tickets_updated | 2 | B | Report update-event counts may differ from selected distinct-ticket contract; do not silently change policy |
| worked_elevated_tickets | 2 | B | POS field choices do not match current Menufy tag pattern; work event attribution unresolved |

`first_contact_resolution` and `schedule_adherence` are active definitions but have zero
current assignments. They remain in inventory and are not counted in the 40-assignment
denominator. Their sources/meaning require qualification before assignment/activation.

Outbound row updates are supported by `2026-09-25-outbound-candidate-parity.json`,
`2026-09-25-pos-outbound-candidate-replay.json`, `2026-09-25-pos-outbound-daily-parity.json`
and `2026-09-25-outbound-publication-candidate.json`. The current deployed state is recorded
in `2026-09-28-code-production-deployment.json`; current recovery evidence is in
`2026-09-28-csat-controlled-recovery.json`.

Agent ownership for every next action: this task, under existing user execution authorization.
No manager communication or routine approval request is required to continue read-only
discovery or diagnostic implementation. A genuine missing source/access dependency must be
documented specifically, rather than inventing a number or calling it complete.
