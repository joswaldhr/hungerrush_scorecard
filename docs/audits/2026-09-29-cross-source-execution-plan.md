# Cadence cross-source audit, metric qualification and delivery plan

September 29, 2026. Requested by the user after confirming the original product purpose.
Three planning agents reviewed Assembled, Zendesk and end-to-end acceptance. This document
combines their recommendations under the latest user safeguards. Planning used repository
evidence and official vendor documentation; no additional tenant requests or mutations were
performed for this plan. It is an execution plan, not a completed instance audit.

## Outcome and scope

Barbara and Alex open an employee's last completed week in Cadence, trust the full agreed
scorecard, conduct the 1:1 and export the same information without rebuilding source reports.
The standalone app and Microsoft sign-in remain. Rippling explains export use; no Rippling
migration or connector is in scope. Adam's demo stays frozen. Hosting migration, rankings,
AI performance judgments and unrelated dashboards do not join this release.

Audit the accessible Assembled instance broadly enough to identify its actual role, all
available reporting surfaces and their metric families. Integrate only the metrics required
by the manager workflow. A vendor capability catalog is not an exhaustive extraction of
every employee's history, and not every metric on a vendor menu belongs on a 1:1 scorecard.

The current baseline is 23 assigned keys / 40 team assignments across 62 employees. The
latest acceptance ledger records 14/40 with verified production arithmetic and 0/40 meeting
the full contract. These are evidence counts, not a product accuracy percentage or effort
estimate. Do not shrink the denominator by hiding unavailable fields. Newly required
Assembled metrics expand the requirements explicitly after their meaning is established.

## What “100%” must mean

Every agreed reporting requirement is accounted for. Every published employee/metric/period
has complete eligible source evidence, a documented definition and no unexplained discrepancy.
All eligible numeric values are delivered automatically by the meeting-readiness deadline.
A verified empty sample is a legitimate reported outcome; a missing integration, unknown
population or withheld unverified metric remains unfinished work.

Qualification is bounded to source observations, effective definitions and reporting scope.
It cannot guarantee that vendors never fail, revise data or omit evidence. Cadence must
detect those conditions and recover without fabricating zeros or relabeling old data as fresh.
Matching two dashboards, passing unit tests, or displaying a number does not prove this standard.

## Work package 1: complete manager requirements and a baseline

Use the current requirements matrix and retained reports first. Inventory every column,
manual transformation, filter, target and exception used in both managers' actual 1:1 packs.
Include fields currently outside Cadence, so certifying its existing configuration cannot
hide remaining manual work. Do not infer requirements from every API field we can fetch.

Record one row per team/metric contract: question answered, accountable definition owner,
source and report scope, numerator/denominator, units, attribution, date basis/timezone,
eligible identities, zero/no-sample rules, observation lag, target compatibility, definition
version and effective date. The same label can require separate team-specific contracts.

Preserve a baseline of production assignments, policies, deployed versions and demo identity.
Maintain a decision log for unresolved business meaning. Ask only for genuine missing facts
or material definition choices, in a consolidated set with concrete alternatives. Routine
technical checkpoints do not need user approval. Do not contact managers or vendors without
explicit messaging authorization. Validate the final pack with the managers through an
authorized handoff; that is product acceptance, not a recurring implementation permission gate.

Exit: every known required column maps to a contract or a named unresolved decision; current
40 assignments remain visible. Unknown requirements are marked unknown, not silently absent.

## Work package 2: audit the actual Assembled instance

The existing key works; keep it in place. Recent read-only discovery found 104 people,
18 activity types, 61/62 unique nondeleted pilot matches and six structurally valid schedule
samples. One POS exact-email person is deleted. Those observations do not qualify adherence,
effort, historical eligibility or all-employee schedule coverage. Production connector remains
retired. The key screenshot shows version 2025-04-15, but the configured secret has not been
bound to a specific named key; never guess or rotate credentials to resolve semantics.

| Audit area | Instance evidence to capture | Output |
|---|---|---|
| Actual business use | Reporting surfaces used by managers, exports and manual steps | Assembled's role in the existing meeting workflow |
| Enabled capabilities | Available reports, scorecards, schedule analysis, team performance, real-time views and other exposed reports; unavailable/disabled surfaces recorded | Complete accessible-surface catalog, with observed/not enabled/not inspected/access blocked states |
| Integrations and lineage | Connected Zendesk ticket/Talk and other actual integrations, sync health, captured state sources and capture mode | Diagram of where each metric's evidence originates and which outputs share upstream data |
| People and scope | Person/agent/platform IDs, teams, queues, sites, channels, deleted records, effective membership and exclusions | Exact identity map and unresolved employee-period cases; no fuzzy silent remapping |
| Time and settings | Timezone, schedule layers, event types, productive/auxiliary/time-off classification, state/channel/queue mappings, grace/exclusion rules where present | Dated calculation-settings record; unknown settings remain blockers for dependent contracts |
| Workforce metrics | Scheduled/actual/productive time, schedule/productive adherence, conformance, occupancy, utilization and shrinkage if enabled | Available metric dictionary with units, formulas, source population and intended use |
| Ticket/quality/effort metrics | Available solved/handled/touched, response/resolution/handle time, quality/CSAT and throughput fields | Definitions and overlap map against Cadence/Zendesk; no assumed equivalence |
| Reporting behavior | Filters, aggregation, export precision, refresh lag, late changes, exclusions, history retention, case drill-down and API access | Reproducible retrieval route and known limits for each required report |

Catalog every exposed metric on each inspected surface. Record unsupported or inaccessible
families explicitly; public documentation alone cannot establish tenant availability. Stop
catalog expansion after the accessible surface inventory closes; qualifying optional future
metrics must not delay the two managers' agreed core pack.

Use retained downloads, supported GET APIs and ordinary nonediting read views. Do not alter
Assembled schedules, states, mappings, exclusions, report definitions, people, settings or keys.
Reuse known analytical reports before generating new ones. If report generation is necessary,
its POST is a separately described, bounded analytical job, not a GET-only audit. Specify
type, scope, employee/channel/period, request limit and retrieval plan first. That does not
authorize configuration or source-record writes. Any tool-required access confirmation remains
a real dependency; continue other work around it.

Exit: accessible instance catalog, source lineage, prioritized required metric contracts,
identity gaps and settings/coverage blockers are recorded. A successful API call is not exit
evidence for metric accuracy.

## Work package 3: choose the right source and settle Zendesk definitions

| Family | Primary qualification route | Main unresolved work |
|---|---|---|
| CSAT and first reply | Released Zendesk source contracts | Finish compatible targets, complete-period coverage, recurring freshness, recovery and genuine scheduler evidence |
| Outbound calls | Zendesk calls, employee legs and required ticket joins | Preserve delayed-parent protections; turn controlled validated publication into dependable recurring reporting through gated activation |
| Inbound calls and durations | Zendesk Talk calls/legs plus retained manager definitions | Reconcile offered components including unreachable; employee vs call attribution; mean vs SUM/MAX; true hold abandonment; zeros/nulls and measured denominators |
| Human Tickets Updated/Resolved | Source-bound Zendesk human action evidence | Establish event provenance, identity and historical eligibility; updater role/channel or ticket viewing is not proof |
| Elevated and avoidable elevated work | Team-specific ticket classifications plus verified work events | Establish actual team workflows, classification effective at the event, employee work attribution and avoidable-subset rules |
| Ticket handling effort | Candidate Assembled active-state/solved-effort evidence | Determine whether ticket-viewing effort meets the intended use; lifetime solved-cohort numerator, touched-ticket denominator, capture completeness, units and exclusions |
| Backlog | Zendesk status/assignment snapshot | Qualify exact observed time and scope; historical week-end backlog needs retained evidence or a complete defensible reconstruction |
| Required workforce metrics | Assembled schedules, actual states and account-defined reports | Qualify productive vs schedule adherence, planned vs actual time, channel allocation, layers and exclusions before assignment |

Assembled can add workforce context and potentially effort evidence. It can cross-check
identities and help explain why work time and ticket throughput differ. When it derives a
ticket metric from Zendesk, agreement is not independent evidence of upstream completeness.
Never average conflicting totals or silently use one source as fallback for a different
definition. Choose one accountable primary contract per metric and use other sources as
clearly labeled comparison evidence.

Create an early human-attribution feasibility checkpoint. After reviewing the available
source-bound provenance, state either the evidence path that can prove human activity or
the exact missing evidence/instrumentation and earliest defensible prospective reporting
date. Do not repeatedly try role/channel heuristics. Do not relax the user's human-only
policy or enable shadow ingestion/action-v2/historical repair to manufacture proof.

Exit: each core family has a settled contract and viable evidence path, or a precise blocker.
Preserve manager report differences in the decision log; reproducing a misleading formula
does not make it correct for the stated purpose.

## Work package 4: independently reconcile complete populations

Initial current cohorts: September 13–19 and September 20–26 closed weeks; September 27–
October 3 through a fixed observation cutoff. Use each contract's actual timezone and date
basis. Keep existing Sunday–Saturday UTC selection keys; no incidental calendar migration.
Retain earlier qualified observations as regression evidence. Historical gaps stay explicit.

For every eligible employee and required metric, compare original source records, retained
observations, independent expected values, candidate calculations, published values and the
same scorecard/history/export snapshot. The verifier must not reuse the candidate calculator
or database output as its expected result. Use one versioned source snapshot shared by workers
so disagreements are not caused by reading mutable vendors at different times.

Require zero unexplained missing/extra IDs, count or denominator differences. Reconcile raw
sums before rounding; define a justified numerical tolerance only for numeric representation.
Ordinary internal reconciliation tolerances do not certify source accuracy. Two independent
code paths over one dataset improve implementation checks but cannot prove missing upstream
events never existed; label that assurance limit explicitly.

Include transfers, deleted/recreated people, reopened tickets, multiple contributors, bots and
integrations, private/public updates, repeated call legs, late parent records, legitimate zeros,
no eligible sample, missing measurements, overlapping schedules, time off, midnight, DST,
month/year boundaries and post-review corrections. Synthetic tests cover edge cases but do
not replace full real population comparison. Assembled solved-effort can include earlier work;
one week's state extract is not automatically the complete numerator.

Exit: exact employee-period reconciliation matrix with observation/version references and
zero unexplained differences for each qualified contract. No chosen-example certification.

## Agents and coordination

Use the lead plus at most three concurrent agents. Initial planning reviews are complete;
the roles below describe execution assignments, not unattended background jobs.

| Role | First wave | Later wave | Authority |
|---|---|---|---|
| Lead / integrator | Requirements, decisions, source-read manifests, master ledger and dependencies | Integrate focused changes and own release/rollback | Sole release/configuration owner; coordinates all vendor reads |
| Assembled specialist | Actual-instance catalog, identity/settings, workforce and effort contracts | Inactive adapter and source-specific tests once qualified | Scoped assigned files; read evidence; no independent source mutations or releases |
| Zendesk specialist | Ticket/CSAT/Talk definitions, human-action feasibility and discrepancy investigation | Family-specific fixes, coverage and bounded collection | Scoped assigned files; no report editors or independent publisher activation |
| Independent verifier | Challenge definitions and design reference comparisons | Offline reconciliation, adversarial tests; then reliability/access/export verification | Cannot certify by calling the implementation under review |

Exactly one designated live collector at a time, under the lead's account-wide request
budget and awareness of production jobs. This role may be assigned to one specialist for a
bounded collection; the other agents use retained private snapshots and synthetic fixtures.
No parallel vendor crawlers, repeated full downloads or quota competition. Existing local
locks alone do not coordinate other integrations or hosts.

Each handoff names its question, scope, inputs, allowed paths, output artifact, pass criteria,
prohibited actions and unresolved assumptions. Give implementation agents disjoint files or
isolated worktrees. The lead resolves shared schema/contract changes before integration.
For each substantial implementation, a worker other than its author reviews the evidence.
Rotate a freed slot into operational/UI/export checks rather than spawning extra collectors.

Raw evidence stays in access-restricted local storage with minimal fields, observation dates,
digests and a retention/deletion policy. Public Git gets code, synthetic cases and aggregates
only. Agents do not message managers, create access, change keys or merge master themselves.

## Work package 5: implement and release one family at a time

Keep the modular monolith. Build inactive adapters only when contracts are settled; do not
blindly restore the retired Assembled connector. Centralize qualified domain meaning so
scorecards, history and exports cannot invent separate calculations.

Implement bounded collection, resumable progress where needed, complete joins, idempotency,
atomic publication, revisions and last-good preservation. Partial collection must not publish
a plausible total. Targets require matching units, cohort, definition and effective historical
context. A missing legitimate target is distinct from an unverified target; never substitute
today's configuration for old weeks.

Before a family release: exact candidate type/lint/tests/build; isolated PostgreSQL transaction,
rollback and concurrency tests where applicable; synthetic hosted authorization and actual
downloaded export-byte verification; fresh encrypted backup and verified restore; explicit
canary scope, effective period, predecessor policy and rollback deployment. Inspect private
data boundaries and unchanged unrelated assignments/history before and after publication.

PR41's last-week/navigation/export release remains separate; its main Preview authenticated
and export gates are still open. Demo proof cannot substitute. PR38's unqualified work and
inactive human-action features remain separate. No merge to master until relevant gates pass.

Exit: independently reconciled scoped publication, preserved unrelated data and a tested
recovery path. A deployed but disabled collector is not operational completion.

## Work package 6: make it ready before meetings and prove use

Define the pilot's readiness deadline with the actual meeting schedule. Proposed starting
service target: last week's pack ready by 8:00 a.m. America/Chicago on the first meeting day;
this is a planning assumption, not an existing promise. Determine per-source expected delay,
safe correction lookback, refresh cadence and visible last-success/observation semantics.
Measure capacity against hosting limits before choosing worker changes. Hosting migration
is not a prerequisite unless measured constraints require it.

Correlate actual scheduled invocations, scheduler identity, HTTP outcomes, durations, database
runs, published periods and freshness. Manual syncs cannot supply scheduler evidence. Test
timeouts, rate limits, partial pages, stale leases, duplicate requests and safe retries in
isolation; verify last-good preservation and the operational recovery path. Name an incident
owner and define an alert delivery route before enabling it; this plan sends no messages.

Check Microsoft sign-in, manager scope, historical access, fixed-week sharing, last-week default,
neutral current-week progress, late-response races, compatible comparisons and H:MM:SS display.
Verify denied direct employee/history/export requests as well as successful navigation;
hidden links alone do not enforce manager authorization.
Downloaded PDF/PNG/CSV, print and copied text must match the selected employee/period/version.
Retain what was presented and make later corrections explainable. Never call old historical
observations stale solely because their observation timestamp is old.

Both managers then use their complete agreed packs through two real weekly review cycles,
with no manual reconstruction of required metrics. Measure preparation time and record any
missing column, discrepancy or export issue. Technical completion can precede this observation;
full pilot acceptance cannot truthfully compress two weekly cycles into one day.

## Execution order, progress and real blockers

Start the Assembled instance catalog and Zendesk semantic review together, with serialized
source reads. At the same time prepare independent replay tests and finish reliability gates
for already-qualified families. Resolve high-risk human attribution and effort feasibility
early. Do not make all calls/CSAT work wait on Assembled or make Assembled wait on Preview auth.
After contracts settle, implement and release family-sized increments, then observe actual
scheduling and pilot use. Re-estimate delivery after catalog/feasibility gates reveal real
dependencies; no unsupported completion date or blanket percent-complete estimate.

Report separate counts: catalog surfaces inspected/known; required columns mapped/identified;
contracts defined/required; employee-period cases reconciled/eligible; unexplained mismatches;
assignments published and scheduled/required; actual exports checked; meetings completed without
reconstruction. Keep denominators and the date of each observation explicit. Unavailable
metrics, inactive code and synthetic demo values do not earn reporting completion credit.

Known blockers to track: deleted POS Assembled identity and effective dates; manager-required
workforce columns and account settings; human-action provenance; inbound definition mismatches;
historical target context; main Preview authentication/export proof; remaining scheduler
correlation and recurring source activation. Continue independent work around each blocker.
Only ask for a genuinely missing business fact or required access action, not routine approval.

## References

- [Current requirements](2026-09-29-reporting-requirements.md) and its census/identity evidence.
- [Metric acceptance ledger](2026-09-25-metric-acceptance-ledger.md): current qualification denominator.
- [Retained manager report definitions](2026-09-28-report-definition-review.md): historical inspection evidence, not permission to reopen editors.
- [Safety guardrails](../SAFETY_GUARDRAILS.md): no Zendesk editors or mutations under latest AGENTS.
- [Assembled metrics and definitions](https://support.assembled.com/hc/en-us/articles/9945313474061-Metrics-and-definitions): general vendor definitions, not observed tenant configuration.
- [Assembled agent scorecard](https://support.assembled.com/hc/en-us/articles/5156650607245-Understanding-the-Agent-Scorecard): view/drill-down observation and aggregation differences.
- [Assembled ticket effort methodology](https://support.assembled.com/hc/en-us/articles/21941584400909-Agent-average-handle-time): viewing-based solved effort does not prove the actor who solved a ticket.
- [Assembled API reference](https://docs.assembled.com/): supported retrieval and report-generation mechanisms.
