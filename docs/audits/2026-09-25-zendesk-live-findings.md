# Zendesk metric investigation — live findings

Investigation started September 25 at approximately 16:37 UTC. This is evidence of
discovery and diagnostic implementation, **not a new production metric release or a
claim that all metrics are accurate**. Production was read only. Vendor calls were GETs;
Explore reports were inspected without saving changes. Private identities, ticket IDs,
report IDs, credentials and raw payloads remain outside tracked files.

## Inventory and source capability

The production census at 16:41 UTC found 25 active definitions, 23 assigned metric keys
and 40 team assignment rows (21 Menufy, 19 POS). All 62 active employees have a Zendesk
identity mapping; mappings alone do not establish historical eligibility or human activity.
Twelve visibility overrides exist. See `2026-09-25-metric-accuracy-census.json` for aggregate
assignment, visibility, target-scope and retained-source coverage. Numeric/complete storage
status is not independent accuracy certification.

Account and both supplied manager profiles use Central Time, corresponding to
`America/Chicago`. Five business schedules exist: four Central and one Eastern. The
default is weekdays 08:00–17:00. Per-ticket schedule application remains to be established;
do not infer it solely from the account default.

Inspection of 701 ticket-field definitions found an inactive integer minutes-spent field,
but no active canonical Time Tracking duration fields by the inspected names. The installed
workforce application is enabled; a separate workforce application is disabled. This does
not prove active effort data is absent everywhere. Access/field semantics from the enabled
workforce source remain a separate requirement for genuine handling effort.

The active Menufy elevation dropdown has 33 tag choices matching the current elevation-tag
pattern. The active POS escalation-type dropdown has three choices, none matching that
pattern. POS also has an active avoidable-escalation checkbox. Current tag heuristics are
therefore not a common verified contract for both teams. Tag presence does not prove the
employee performed the work.

## Actual manager report discovery

Existing authenticated Explore access succeeded. Reports owned by the supplied Menufy
manager and a daily-summary dashboard last updated by the supplied POS manager were found.
Ownership/update history is evidence of relevance, not proof of current managerial trust.

- The Menufy agent-audit dashboard selects September 13–19 as Last Week and uses Central
  time. Its ticket activity reports use update dates and updater identity.
- The Menufy CSAT report uses Support: Tickets, current assignee rows, **ticket solved date**,
  and five selected support groups (including legacy/manager/principal groups). Its metrics
  are good, bad, surveyed tickets, satisfaction percentage and satisfaction-rated percentage.
- Its `Sent` label represents surveyed tickets with offered/good/bad status, not confirmed
  email delivery. Response percentage is rated / surveyed. No ratings means no CSAT score;
  surveyed tickets with no responses produce a genuine 0% response rate.
- The Menufy inbound report uses **leg agent**, distinct accepted/declined/missed leg counts,
  sum of leg talk seconds and maximum leg hold seconds. Offered and abandoned-on-hold are
  custom measures requiring formula inspection. Whole-call counts/durations cannot be
  substituted for these employee measures. The report also contains a distinct inbound-call
  measure; even within one report, measures have different grains.
- The POS daily-summary dashboard uses call-created date and Central time, with queue/team
  offered, answered, wait time and AHT. These are not automatically per-employee measures.
  A widget reported a network error; the complete dashboard was not certified.
- The Menufy 2026 dashboard includes separate FCR/repeat-caller, backlog and management tabs;
  their definitions have not yet been inspected. No trusted first-reply/active-effort report
  definition has been established merely by discovering these dashboards.

Zendesk's [Support metric definitions](https://support.zendesk.com/hc/en-us/articles/4408827693594-Metrics-and-attributes-for-Zendesk-Support)
support the surveyed/rated distinction. Actual group and date filters were inspected in the
tenant UI; generic vendor documentation alone was not treated as account configuration.

## First-reply incident traced

For the reported employee, all 132 IDs in the two stored created-ticket cohorts were
re-read with their metric sets. Unrounded business-minute sums and denominators exactly
matched retained evidence: 4,368 / 18 for September 13 and 59,148 / 50 for September 20.
The latter is 1,182.96 minutes, displayed as 19:43:00 after rounding to the nearest second.
The earlier zero-denominator exclusion defect was already corrected by PR24.

This proves arithmetic on the selected IDs, **not correctness of the selected population
or attribution**. One long-duration example had several days between creation and its first
public reply. The high value is not simply a minutes/seconds conversion error. A ticket's
first public reply does not establish that its current assignee caused the elapsed delay.

A separate creation-date search (without Cadence's last-update condition) returned 284
unique tickets across a padded two-week interval, over three complete search pages. Metric
sets were obtained for all 284. Current assignment is the basis; this is not a historical
assignment census. Source observations are sequential rather than an atomic vendor snapshot.

| Closed September 13–19 comparison | Selected tickets | Measured replies | Business minutes sum | Mean minutes |
|---|---:|---:|---:|---:|
| Retained production cohort | 28 | 18 | 4,368 | 242.666667 |
| Independent created cohort, UTC | 161 | 64 | 19,838 | 309.968750 |
| Independent created cohort, Central | 166 | 67 | 26,275 | 392.164179 |

All 133 UTC-created tickets absent from the retained cohort had their latest update after
the reporting week, and none was updated after the stored source observation. This strongly
supports the additional last-update filter as the exclusion mechanism. Historical assignment
is not reconstructed by this test. Changing only formatting cannot correct this cohort issue.
Central boundaries also move four retained tickets out and add other boundary tickets.

The current week remains provisional. Its independent UTC/ Central means were 1,150.057692 /
1,137.911111 business minutes; freshness and cohort differences both apply. Do not replace
production with these sampled reference values or treat a lower number as evidence of truth.
See `2026-09-25-first-reply-reference.json` for unrounded aggregate results and input digest.

## First CSAT numeric match

A **separate solved-date search**, padded around the closed week, returned 187 unique
tickets across two complete pages, with 187 metric sets. This avoids using a creation-date
census to qualify a solved-date metric. The offline reference selected the five exact report
groups and Central solved dates. Its 12 surveyed tickets, zero good, zero bad, no satisfaction
score and 0% response match the incident employee's visibly aligned row in Explore. The UTC
calculation instead selects 13 surveyed tickets. Group-filtered aggregate output is in
`2026-09-25-csat-filtered-reference.json`; the all-group diagnostic is retained separately.

This is **one employee / one week / numeric parity**, not exact ticket-set parity with
Explore or qualification of the entire team, POS, a second week, late updates, targets,
historical scope or production publication. The source capability for a denominator exists;
the existing integration has not implemented this report contract.

## Independent diagnostic implementation

`scripts/reference-zendesk-ticket-metrics.ts` reads a minimal private snapshot and emits
allowlisted aggregate results. It never loads `.env`, connects to a database, calls Zendesk,
or publishes values. The reference module imports no connector, normalizer or publisher.
It joins source IDs, checks duplicate/missing metric-set coverage, applies explicit IANA
date boundaries, preserves zeros and nulls, and retains unrounded sums/denominators.
Input digests permit replay against private snapshots without publishing employee or ticket IDs.

The command distinguishes creation and solved-date populations. A manifest's completeness
assertion is recorded but not independently proven by the runner; source pagination/count
evidence is the investigator's separate responsibility. Scope/observation alignment and
human attribution cannot be inferred from a passing calculation.

Ten focused tests passed, including both DST transition days, UTC-versus-Central boundaries,
zero/null arithmetic, invalid/missing evidence, group selection and solved-date CSAT.
TypeScript passed. An initial threaded jsdom test launch stalled and was interrupted; the
successful bounded test run used one fork and the Node environment. No database test fixture
or retained source evidence was modified. Formatting/lint status is recorded in the ledger.

## Next execution priorities

1. Qualify solved-date CSAT across the full scoped population and both closed weeks, including
   exact report sets or documented drill-through limits, source freshness and late ratings.
2. Resolve each call report's custom formulas and filters; reconcile agent legs against calls
   by call-created Central dates. Retained complete UTC-week exports can be reused only where
   coverage permits; the additional Central boundary must be acquired, not assumed complete.
3. Define first reply as a clearly named creation-cohort measure and separate full resolution
   from active handling effort. Revalidate applicable targets before versioned publication.
4. Trace POS escalation field workflows and historical ticket actions. Keep unverified human
   activity unavailable; do not turn current role/assignee or parent web-channel into proof.

No new production formulas were deployed in this increment. Shadow recurring ingestion,
version-2 publication and historical repair remain disabled. Hosted export-file byte inspection
and corrected scheduled roster execution remain unverified as recorded in the release ledger.

## Expanded CSAT qualification — second investigation increment

The Menufy report comparison now covers **all 23 report rows across both September 6–12
and September 13–19: 46 exact good/bad/surveyed count matches, 46 displayed score matches
and 46 displayed response-percentage matches**. Unrounded reference arithmetic is retained
privately. The second period was selected only in an unsaved report view, then discarded by
reloading; no report definition was saved.

This expansion exposed a source-population trap in the diagnostic query itself. Searching
`satisfaction:offered satisfaction:good satisfaction:bad` returned 4,271 unique tickets over
five completed export pages, exactly matching that query's separate count. However, the
tenant search treated ratings with comments separately. It omitted 44 tickets returned by
`satisfaction:goodwithcomment satisfaction:badwithcomment`, with zero ID overlap. This first
population matched only 12 of 23 report rows for September 13. The missing variants were
added, and the combined population of **4,315 unique tickets / 4,315 metric sets** matched
the expanded count endpoint and both weeks' report rows. This demonstrates why matching
pagination counts cannot by itself establish semantic completeness. Comment bodies were not
retained in the minimal private snapshot or committed.

The [Zendesk search reference](https://support.zendesk.com/hc/en-us/articles/4408886879258-Zendesk-Support-search-reference)
documents the separate commented-rating search values. Future survey collection must include
all five search variants, or collect an independently complete unfiltered solved population
and select raw offered/good/bad scores locally. API ticket score values and search values
are different vocabularies; do not insert `goodwithcomment` into the raw-score calculation.

The report population covers 19 of the 23 active mapped Menufy employees. The other four
identities each resolved uniquely to an active unsuspended Zendesk agent and had zero
currently assigned solved tickets across the padded two-week interval, even without group
restrictions. They therefore have no survey denominator in this current-assignee contract;
do not publish a 0% CSAT score for them or assume a broken identity mapping. Report rows and
the active roster are not interchangeable denominators.

For the incident employee's September 13 week, an unsaved Ticket ID decomposition was also
read completely: 147 distinct solved-ticket rows, all ticket/metric cells, including 12
surveyed tickets. Those **12 exact ticket IDs matched** the independent source set. The
temporary decomposition was discarded. Full report-population ticket-set parity remains
open; the 46 numeric matches do not silently promote it to passed.

POS's survey-count report was found and inspected: current assignee rows, good/bad ticket
counts, solved date and Central time, plus brand/group/rating filters. Its copied dataset and
exact filter values still require inspection before declaring POS parity.

Aggregate evidence: `2026-09-25-menufy-csat-parity.json`. The diagnostic CLI now records whether
its source population includes all solved tickets or only surveyed statuses. First-increment
commit `37aa246` is pushed in draft PR27; both CI runs 36164672208 / 36164703108 passed.
Production formulas, target versions and data remain unchanged. Candidate contract,
late-update/replay behavior, exact full source-set qualification and rollout gates remain.
