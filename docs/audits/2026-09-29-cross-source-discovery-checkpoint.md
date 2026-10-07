# Cross-source discovery checkpoint

**Later September 29 update:** The user signed in and explicitly requested an
Assembled audit. The authenticated read-only instance pass is now recorded in
[the instance audit](2026-09-29-assembled-instance-audit.md). It supersedes the
browser sign-in blocker and uninspected UI/settings statements below. All five
standard Report pages, connected integrations and relevant visible state settings
were inspected. Numerical qualification, identity coverage and production release
gaps remain open; no blocked delegated task was retried.

September 29. Execution started after the user's approval of the cross-source plan.
This pass inspected existing aggregate evidence, application source and public API
documentation. No new authenticated vendor API requests, analytical report-generation
requests, database writes, source changes or deployments occurred.

## Current Assembled evidence coverage

| Surface | Evidence state | Remaining requirement |
|---|---|---|
| People and pilot matching | Earlier September 29 complete API census: 104 people, 61/62 unique nondeleted matches | Resolve the deleted POS person's historical eligibility without changing source people or employee assignments |
| Activity types | Earlier census: 18 types, four productive and four time-off | Account-specific definitions and state mappings have not been inspected |
| Schedule availability | Six earlier samples, one employee per team across three intervals; 168 structurally valid segments | Full eligible population, schedule-layer meaning, exclusions and independent totals remain unqualified |
| Handling effort | September 25 single-employee report and state sample retained as aggregate findings | Exact report units, lifetime numerator, exclusions and all-employee coverage remain unqualified |
| Adherence and other analytical reports | Public API documents report capability | Actual account settings, enabled fields, report outputs and their semantics remain unverified |
| Report menus, integration views and settings | Assembled browser opens to sign-in | Authenticated ordinary read views are needed to complete the instance catalog |

The existing API key is already verified; the browser sign-in dependency is separate.
The user has been asked to sign in to the opened Assembled tab. No credentials were
requested in chat, no new access was provisioned and no key was changed.

## Important release evidence gap

The retained production census at `2026-09-29T14:33:34.914Z` contains source-contract
provenance for current-week outbound values. Its September 13–19 and September 20–26
outbound groups have zero rows carrying that provenance. This does not by itself prove
every older value is wrong; it does mean the current-week canaries cannot certify the
default previous-week review. Older Monday–Sunday intervals also remain present and
must retain their exact period identity.

The outbound cron route can return HTTP 200 for `enabled:false` or
`skipped:before_prospective_cutover`. An HTTP success alone therefore cannot prove
scheduled publication. Qualification requires the response outcome, exact reporting
period, completed database run and actual source/publication evidence to agree.

Historical repair and new action publication remain disabled. Do not backdate a policy
or relabel earlier observations to fill this evidence gap. A separately qualified and
scoped historical proposal would be required before any historical correction.

References: the main-upgrade checkout's retained
`2026-09-29-post-csat-release-reporting-health.json`, and
`src/app/api/cron/outbound/route.ts`. These are retained observations, not a new live census.

## Execution limits

All three delegated execution tasks were stopped by automatic safety review with the
reason `Potentially unintended activity`. No new agent deliverables were present in
the working tree at inspection. The blocked tasks were not retried through another
mechanism. This pass was narrowed to retained aggregate evidence and read-only inspection.

At this earlier checkpoint the Assembled audit was pending authenticated read views;
the later update above records the completed discovery pass and remaining limits.
The metric acceptance denominator and certification counts remain unchanged. Adam's
demo, production settings, Zendesk and Assembled source configuration remain unchanged.
