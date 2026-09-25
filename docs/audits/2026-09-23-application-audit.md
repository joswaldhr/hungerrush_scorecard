# HungerRush Cadence — application audit and overhaul plan

**Audit date:** September 23, 2026. **Repository baseline:** `ab062c33f70e2152b8786f6a8ade5a7e0ab96697`.
**Scope:** current repository, local authenticated browser experience, read-only queries against the configured database, build/test/lint checks, dependency advisory check, and relevant vendor documentation. This is an audit, not an implementation.

The accompanying [metric contracts](C:/Users/JamesOswald/projects2/hungerrush_scorecard/docs/audits/2026-09-23-metric-contracts.md) and [baseline evidence](C:/Users/JamesOswald/projects2/hungerrush_scorecard/docs/audits/2026-09-23-baseline.json) are part of this report. The [diagnostic script](C:/Users/JamesOswald/projects2/hungerrush_scorecard/docs/audits/2026-09-23-readonly-baseline.mjs) uses a read-only transaction and statement timeout. No application code, database records, migrations, source synchronization, production deployment, or credentials were changed.

**Evidence labels:** CONFIRMED means directly observed in code, a check, the database, or the browser; it does not automatically mean an exploit or every possible production impact was demonstrated. LIKELY means a supported inference. UNKNOWN means the audit could not establish the fact. Proposed thresholds and architecture below are recommendations, not existing service guarantees. P0 means correctness/security risk; P1 means significant reliability/usability/performance problem; P2 means meaningful improvement; P3 means polish.

## 1. Executive summary

The application has a useful, restrained product shape: managers select a person and review a weekly 1:1 scorecard. Its Next.js/TypeScript/PostgreSQL foundation is suitable for that job. Server-side authorization, reusable metric and target functions, structured ingestion, uniqueness constraints, batch writes, and a coherent visual theme are worth preserving. A wholesale rewrite is not justified.

**The main problem is that the product can express more confidence than its evidence supports.** Recalculation relabels old facts as freshly complete; source corrections to null leave old values behind; capped source fetches can appear successful; historical targets and periods are not consistently preserved; and client navigation can show the wrong reporting period. Several administrative mutations also fail to carry organization scope through to the write.

These are observable issues, not speculative modernization opportunities. The database contains 16 facts whose current source payload has become null, 8,519 metric values whose freshness timestamp is more than one day later than the supporting fact's observation, and five abandoned running jobs. Browser Back reproduced a URL/scorecard period mismatch. The most recent current-week Talk fetch reached its 50-page cap.

**Recommendation:** keep the application and implement an incremental trust overhaul. Correct period/value coupling and authorization boundaries immediately, then introduce scoped publication, explicit quality states, versioned calculations, and independent source reconciliation. Improve the interface around that evidence. Optimize sync work where timings show the cost.

**Readiness verdict:** not ready to serve as an unqualified, authoritative employee-performance system or to expand into multiple organizations. Existing limited internal use requires explicit awareness of the findings; passing build and unit checks does not establish metric correctness. Production infrastructure backup, restore, and alert delivery remain unverified.

Existing decisions remain intact: the 1:1 workflow stays primary; removed Team/Home/standalone Employee experiences are not proposed for restoration; Menufy range targets stay unchanged as previously directed; the current Sun–Sat UTC convention is not silently changed.

## 2. System map

| Layer | Current implementation and responsibility |
|---|---|
| Frontend | Next.js App Router and React; server-rendered authenticated pages; client employee picker, week navigation, scorecard cache, visibility UI, and exports. |
| Application backend | Server actions and API routes in `src/app`; metric queries and rules in `src/lib/domain/metrics`; roster and reconciliation domains. |
| Database | Drizzle with postgres.js. Configured database reports PostgreSQL 18.6. Employees, memberships, identities, definitions, assignments, targets, source records, facts, values, sync/reconciliation records, and visibility settings. |
| Integration | Live Zendesk tickets, ticket metric sets, satisfaction ratings, Talk calls, and groups/roster. Assembled is residual configuration/catalog data, not an active connector. No active Rippling ingestion was found. |
| Authentication | NextAuth 5 beta with Microsoft Entra ID; development-only credentials. Application user/organization/assignment authorization is separate from authentication. |
| Sync | Four daily Vercel cron requests for offsets 0–3; Zendesk fetch/aggregate → transactional source/fact publication → metric computation. Manual sync also exists. |
| Deployment | Vercel configuration and external PostgreSQL; environment variables supply credentials. Local configuration points at a shared database, so local execution is not equivalent to an isolated staging environment. |

Current data flow:

```text
Zendesk tickets / metric_sets / ratings / Talk calls
  → connector fetches, filters, attributes, and aggregates per employee/week
  → source_records (weekly summaries, not full source-event archive)
  → normalized_facts (one number per metric/employee/week/source record)
  → computeMetricValuesFromFacts
  → metric_values
  → authorized scorecard query + current assignment/target/visibility resolution
  → server action / scorecard cache
  → metric tables and overall status
  → CSV / canvas-based PNG and PDF
```

Primary implementation anchors: [Zendesk connector](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/connectors/zendesk.ts), [sync engine](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/connectors/sync-engine.ts), [compute](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/compute-values.ts), [queries](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/queries.ts), [schema](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/db/schema.ts), [authorization](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/auth/authorization.ts).

## 3. Baseline

### Checks at the audited revision

| Check | Observed outcome |
|---|---|
| `pnpm typecheck` | Passed. |
| `pnpm lint` | Passed; one unused-variable warning in `run-sync.test.ts:35`; formatting checks passed. |
| `pnpm build` | Passed; Next 16.3.5; compile 14.9 s, TypeScript 11.1 s, page generation 380 ms; 21 dynamic routes. Build was not deployed. |
| `pnpm test` | 13 of 17 suites passed; 151 tests passed, 37 skipped. Four suites failed in database setup with PostgreSQL authentication error 28P01 for local `cadence`. This is an incomplete test run, not 37 proven application failures. |
| `pnpm audit --prod --json` | Zero reported advisories at audit time; 171 dependencies reported. This is not a general security certification. |
| Built chunk files | 31 files totaling 1,936,265 bytes on disk; largest 418,540 bytes. Aggregate artifacts are **not** initial-route transfer size. |
| Query sample | Indexed fact lookup was sub-millisecond in the measured database EXPLAIN sample; remote diagnostic calls mostly about 104–129 ms, sample extraction about 267 ms. Network latency and query execution are different measurements. |

Failed integration suites: authorization, roster reconciliation, metric-visibility actions, and queries. The configured local test database was unavailable with its test credentials. No shared database was repurposed to make tests pass.

**Operational snapshot:** captured at 2026-09-23 18:38:18 UTC. One organization; 97 employee records, 62 active and 62 active Zendesk mappings; 25 metric definitions, 40 assignments, 29 targets; 2,592 source records; 12,781 facts and 12,781 metric values; 79 sync runs. Of those runs, 71 completed, three failed, and five remained running from September 9–10. There were zero unmapped source rows and zero duplicate visibility groups in the checks performed. Forty-one active employees have no line; POS employees make that count unsuitable as a blanket error count.

**Periods:** 11 distinct intervals coexist, including old Monday starts and new Sunday starts. September 14–20 has 1,371 metric rows; September 13–19 has 1,057. September 21–27 has 946; September 20–26 has 1,075. The four-week refresh has created multiple overlapping old/new intervals; this is more than a single boundary-day issue.

**Anonymized representative values:** these are regression references, not independently certified source truth. The JSON has broader samples across four cohort representatives and historical periods.

| Period | Cohort sample | Tickets resolved | Inbound | Outbound | CSAT |
|---|---|---:|---:|---:|---:|
| Sep 20–26 | POS sample 1 | 47 | 22 | 10 | 66.67% |
| Sep 20–26 | Menufy consumer sample 2 | 294 | 9 | 51 | — |
| Sep 20–26 | Menufy restaurant sample 3 | 66 | 40 | 16 | 100% |
| Sep 20–26 | Menufy without line sample 4 | 0 | 0 | 0 | — |
| Sep 13–19 | POS sample 1 | 44 | 41 | 23 | — |
| Sep 13–19 | Menufy consumer sample 2 | 420 | 39 | 234 | 25% |
| Sep 13–19 | Menufy restaurant sample 3 | 115 | 86 | 47 | 85.71% |
| Sep 6–12 | Menufy restaurant sample 3 | 81 | 83 | 25 | — |

A dash here means the table does not assert a CSAT observation for that sample; inspect the JSON for full values. Source CSAT is not universally absent: 31 of 62 current-week summaries have ratings, totaling 64; the previous Sunday period has 44 rated summaries and 176 ratings.

**Browser baseline:** the local development server already running at port 3000 was used. A manager's picker displayed 23 people grouped into restaurant, consumer, and other. The restaurant sample scorecard displayed 66/115 tickets, 31.7/41.3 minute response time, and 100/85.7% CSAT for current/prior weeks. Previous-week navigation worked; Back to the default URL left the previous-week content selected. The dark desktop UI was readable and orderly, but repeated category headers and compact text required substantial vertical scanning.

**Not measured:** production p50/p95 page/API latency, actual route transfer bytes, Core Web Vitals, a production request waterfall, mobile layout/accessibility conformance, production concurrency, and tenant-wide independent vendor parity. Development compilation timings must not stand in for production page performance.

## 4. P0 critical findings

### P0-01 — Freshness and completeness are asserted without source evidence

**CONFIRMED · HIGH RISK · DATABASE MIGRATION.** [compute-values.ts:43](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/compute-values.ts:43) reads every fact for the organization and metric key, then writes `dataFreshnessAt = new Date()`, `qualityStatus = complete`, and calculation version 1. It does not restrict by the requested source instance, week, successful publication, or applicable definition version. Both [cron](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/app/api/cron/sync/route.ts) and [manual sync](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/app/api/sync/run/route.ts) invoke computation after the sync result, including a failed result. Sync success is recorded before computation finishes.

**Impact:** old values can appear freshly complete after another week succeeds or a failed fetch. The 8,519 timestamp gaps confirm that this is happening at the data-model level. A source-wide last-success timestamp cannot prove current-week health.

**Action:** preserve source-observed, fetched, calculated, and published timestamps separately. Publish only a validated source/employee/period/version batch. Carry partial/failed/stale states into queries and exports. Mark overall run success only after required publication succeeds. Recompute a bounded scope.

**Acceptance:** fail one source leg and one compute batch; previous values retain their original observation time and are visibly stale/failed. Unrelated periods do not receive new freshness timestamps.

### P0-02 — A corrected null leaves a previous non-null metric behind

**CONFIRMED · HIGH RISK · DATABASE MIGRATION.** The connector omits null-valued facts; [sync-engine.ts:428](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/connectors/sync-engine.ts:428) upserts emitted facts without removing superseded members of the source record's fact set. Compute also skips nulls without retiring old metric values. The diagnostic identified **16 surviving facts** whose latest source payload is null: five handle-time and eleven response-time values.

**Action:** publish complete, versioned fact sets with explicit null reason/tombstone semantics. Update or retire the corresponding value in the same logical publication. Include transformer/mapping versions in change detection; unchanged payload hashes must not prevent re-normalization after a logic or identity correction.

**Acceptance:** non-null → null → zero → corrected non-null sequences yield the exact intended state, with audit history and no obsolete active result.

### P0-03 — Talk period filtering/pagination can corrupt weekly call metrics

**CONFIRMED code mismatch; production magnitude UNKNOWN · REQUIRES VENDOR VERIFICATION · HIGH RISK.** [fetchCallsForWeek](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/connectors/zendesk.ts:219) accepts calls only against an upper created-at boundary, has no lower created-at check or call-ID deduplication, stops after 50 pages, and can stop when a page is entirely beyond the period. Its termination assumes an `end_of_stream` field or null next page.

Zendesk documents a modified-since export, count-based completion, and a continuing next-page link. Its call record also attributes `agent_id` to the first answering agent and describes call-wide durations. Those semantics do not establish per-agent offers or work time. [Zendesk Talk incremental export documentation](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/).

The latest current-week run reached 50 pages and collected 3,763 calls. This proves the guard was reached, not how many calls were lost or duplicated.

**Action:** verify live response contract and cursor boundaries; deduplicate by stable source ID; filter both reporting boundaries; distinguish export exhaustion from safety-budget exhaustion. Use agent-leg data only if vendor-verified and required by the business contract.

**Acceptance:** fixtures cover old-created/new-modified calls, repeated cursor-boundary records, empty terminal pages, calls beyond the period, transfers, and page-budget exhaustion. Independent source IDs and totals reconcile.

### P0-04 — Ticket search truncation and mutable cohorts undermine metric meaning

**CONFIRMED implementation; exact business parity UNKNOWN · REQUIRES VENDOR VERIFICATION · REQUIRES PRODUCT DECISION.** [searchAllPages](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/connectors/zendesk.ts:143) stops at 1,000 results and warns rather than publishing an incomplete state. The vendor's search limit is real. [Zendesk Search API](https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/).

In `fetchRecords`, “Tickets Resolved” counts tickets currently solved/closed from a current-assignee query filtered by **last updated in the period**. This is not necessarily resolution events occurring in that period or work performed by that employee. “Avg Handle Time” is full-resolution business minutes for tickets created in the period within that same updated cohort, not measured agent handling effort. Updated tickets can disappear from an older week's cohort after a later update. Elevated metrics inspect present tags, not escalation events or the elevating employee.

**Action:** explicitly approve definitions; use source events/audits or validated exports where event semantics are intended. Preserve the old contract under version 1. Do not silently rename/recalculate history or change target bands.

**Acceptance:** resolved-then-updated, reassigned, reopened, transferred, and retagged ticket fixtures match an independently prepared source ledger; exceeding 1,000 results cannot yield “complete.”

### P0-05 — Displayed period can diverge from URL and cached values

**CONFIRMED in code and browser · QUICK WIN.** [scorecard-body.ts:49](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/components/scorecard-body.tsx:49) caches weeks indefinitely. Navigation changes the selected period before the new rows arrive, while fallback rows come from `lastLoadedPeriod`; prefetch can also move that fallback. Export remains available. The popstate handler ignores a URL without a week parameter.

**Reproduction:** open a scorecard at the default URL → Previous Week → browser Back. The URL returns to default while the previous week remains displayed. Source also supports the risk of new headings over old rows during an uncached request.

**Action:** one immutable loaded snapshot must own rows, period, targets, freshness, and export context. Track requested period separately; skeleton or explicitly label prior content until the requested snapshot resolves. Handle absent/invalid query parameters, failed loads, races, and cache invalidation.

**Acceptance:** back/forward, rapid navigation, prefetch, failed load, and export-during-load tests never combine values and labels from different periods.

### P0-06 — Organization boundaries are not enforced by several admin writes

**CONFIRMED code path; no exploit executed · HIGH RISK.** [roster-actions.ts](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/app/(app)/admin/roster-actions.ts), [visibility actions](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/app/(app)/admin/metric-visibility/actions.ts), and [roster-review actions](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/app/(app)/admin/roster-review/actions.ts) require an administrator but discard relevant organization context for posted organization IDs or identifier-only writes. An administrator role is not authorization for every object ID.

**Exposure:** current database has one organization, limiting the present cross-tenant blast radius; the code is unsafe for tenant expansion. Do not infer a demonstrated external breach.

**Action:** derive organization from the authenticated context; validate all related employees, teams, definitions, groups, and candidates in that organization; scope the final mutation predicate. Stamp actor identity. Use transactions for multi-record roster decisions.

**Acceptance:** two-organization tests prove foreign IDs cannot create, update, delete, reveal existence, or create cross-tenant references.

### P0-07 — Reconciliation expands individual authorization into team scope

**CONFIRMED · HIGH RISK.** [run route](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/app/api/reconciliation/run/route.ts) authorizes a visible team derived from assignments, while [engine](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/reconciliation/engine.ts) expands to team memberships rather than the permitted employee intersection. [results route](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/app/api/reconciliation/results/route.ts) filters detail rows but returns aggregate counts from the broader run. Run metadata is also broader than individual visibility.

**Action:** pass an explicit authorized employee set into every query and aggregate, enforce membership dates, and scope run visibility. Detail-row filtering already exists and should be retained.

**Acceptance:** a manager assigned one employee in a shared team can neither initiate nor infer reconciliation results for coworkers outside that assignment.

### P0-08 — Historical reporting applies current context and incompatible period calendars

**CONFIRMED · DATABASE MIGRATION · HIGH RISK.** [queries.ts](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/queries.ts) does not apply definition/assignment/target effective dates, passes a null role to target resolution, and uses current employee line/team. The database contains overlapping Monday and Sunday periods, but navigation normalizes to Sundays. Existing history can become unreachable or receive a different target after organizational changes.

**Action:** model period identity/calendar version; preserve existing periods and offer deliberate legacy access. Resolve employee membership, assignment, and target as of the chosen period, with deterministic tie handling and recorded target provenance.

**Acceptance:** changing a person's current team/line or a future target cannot silently change a historical scorecard. A migration coverage report accounts for every old interval without summing overlapping weeks.

## 5. P1 major findings

| ID | Evidence and consequence | Required improvement |
|---|---|---|
| P1-01 | CONFIRMED: [status.ts](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/metrics/status.ts) returns on-track for zero metrics or no targeted metrics, and omits missing rows from the overall judgment. Current unfinished week is judged against full-week ranges. | Separate data sufficiency and performance; distinguish in-progress periods. Preserve approved target values. |
| P1-02 | CONFIRMED: summaries discard individual event IDs and most average denominators; value provenance stores only source strategy. | Retain minimal source evidence, numerator/denominator, revisions, and calculation/target provenance. |
| P1-03 | CONFIRMED: reconciliation reads normalized facts and shares the production aggregate helper; default percentage tolerance can forgive wrong counts. | Keep this internal consistency check, add independent vendor-level reconciliation with metric-specific tolerances. |
| P1-04 | CONFIRMED: [rate-limit.ts](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/rate-limit.ts) checks then inserts separately; no durable lease/reaper; five old running jobs. | Atomic per-source/period lease, heartbeat, bounded takeover, and dead-job recovery. |
| P1-05 | CONFIRMED: sync fallback retries statements in the same failed PostgreSQL transaction; checkpoint update is outside the publication transaction despite its comment. | Use savepoints or fail the batch; atomically advance checkpoint with committed data. Validate with a real database. |
| P1-06 | CONFIRMED: HTTP success can contain failed sync results; manual UI checks HTTP status; cron heartbeat may fire on failed/skipped work. | Typed outcome contract and meaningful-success heartbeat; show actionable failure and last good publication. |
| P1-07 | CONFIRMED: fetch time dominates; metric-set calls are serial batches, and compute rewrites historical values each leg. Largest recent fetch 250.4 s against configured 300 s execution budget. | Scope compute; measure and bound source work; resumable jobs if corrected ingestion cannot reliably fit the budget. |
| P1-08 | CONFIRMED: [roster reconcile](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/lib/domain/roster/reconcile.ts) loses line mapping, discovery deduplicates by email/first group, and multi-step approvals are not atomic. | Deterministic group-to-team/line policy; transactional approval and departure handling with reviewer trail. Existing snapshot had no duplicate pending departures. |
| P1-09 | CONFIRMED: exports capture tables without employee header; CSV uses “this week/last week” even for history and omits actual dates/version/freshness. | Export the same explicit scorecard snapshot, including identity, year, timezone, quality, and target provenance. |
| P1-10 | CONFIRMED: four database suites cannot run locally; key negative action, source-contract, and browser navigation cases are absent. | Isolated reproducible integration database and risk-focused regression coverage. |
| P1-11 | CONFIRMED: tracked backup JSON includes email patterns, employee IDs, and payloads. Repository exposure/retention policy is UNKNOWN. | Review access and retention; move sensitive backups to controlled storage and substitute synthetic fixtures. Any history rewrite requires a separate coordinated decision. |

For P1-05, PostgreSQL requires rollback to a savepoint to recover an aborted transaction before continuing statements; catching the exception alone is insufficient. [PostgreSQL SAVEPOINT documentation](https://www.postgresql.org/docs/15/sql-savepoint.html).

## 6. P2 improvements

- **CONFIRMED:** nullable visibility uniqueness permits logically duplicate rules under concurrency even though none currently exist. Add suitable partial unique constraints or nulls-not-distinct semantics after a duplicate census. [PostgreSQL constraint behavior](https://www.postgresql.org/docs/current/ddl-constraints.html). **DATABASE MIGRATION.**
- **CONFIRMED:** schema strings and relationships lack some business invariants: target bounds, date order, allowed scope combinations, cross-organization references, and active membership exclusivity. Add only invariants that the product actually requires.
- **CONFIRMED:** numeric averages use single-precision `real` and early rounding. Preserve exact counts and numerator/denominator evidence; choose numeric precision for ratios during versioned migration, rather than replacing every number indiscriminately.
- **CONFIRMED:** overall status text is duplicated between UI/export; dormant briefing and observation modules retain older product concepts. Consolidate active presentation rules, then remove unreachable code with import evidence.
- **CONFIRMED:** source configuration still lists Assembled as configured without a successful sync. Distinguish retired/unsupported from failing active integrations.
- **CONFIRMED:** date parsing accepts a shape more readily than a valid business period; future periods can receive misleading current labels. Validate dates and supported calendars at the boundary.
- **LIKELY:** live environment configuration makes accidental data mutation during local scripts easier. Introduce explicit environment identity and protective checks for seed/backfill/admin scripts.
- **UNKNOWN:** contrast ratios, complete keyboard behavior, touch layout, and screen-reader announcements require a dedicated measured accessibility pass.

## 7. P3 polish

Retain the current branding and dark/light token structure. Reduce repeated category chrome, improve long-label wrapping, align number columns, and use consistent duration labels. Preserve text status alongside color. Small transition and spacing changes should follow usability checks, not precede the correctness work. Remove the unused test variable as routine housekeeping. These changes do not justify a new frontend framework.

## 8. UI / UX audit

**Core workflow:** the picker → person's scorecard path matches the current product decision. Search, sort, team/line grouping, week controls, and exports are useful. Server loading/error boundaries, empty states, skip navigation, and reduced-motion support are positive foundations.

**Trust:** tables receive quality/freshness/version fields but do not make those distinctions legible per metric. A single integration banner cannot explain one missing source metric alongside another complete one. Provide a compact period/data summary and a metric details disclosure: definition, source, observations, target reason, and reconciliation state. Missing, unsupported, no activity, stale, partial, and failed must have distinct explanations.

**Navigation:** correct P0-05 before cosmetic work. Preserve picker filters and the selected period on return; next/previous employee controls may reduce repeated navigation without adding a new dashboard. Show full dates and year. Clarify “selected week” versus “previous week”; an open period must be labeled in progress.

**Status:** current restaurant sample is marked needs-attention for three volume metrics in an unfinished week. That arithmetic follows the existing ranges, but the presentation invites a premature judgment. Add provisional assessment rather than prorating or changing targets without product approval.

**Interaction/accessibility:** [week navigator](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/components/week-navigator.tsx) blurs clicked controls; the custom export menu lacks complete menu/focus/Escape behavior. Use accessible primitives and preserve keyboard focus. Announce completed period loads and failures. Large desktop inspection is not proof of mobile compliance.

**Picker completeness:** [one-on-ones-picker.tsx](C:/Users/JamesOswald/projects2/hungerrush_scorecard/src/components/one-on-ones-picker.tsx) explicitly groups recognized lines and null lines; an unexpected nonempty line can disappear. A person without the expected team grouping can also be omitted. Render a visible uncategorized bucket and operational mapping warning.

**Exports:** CSV/PNG/PDF should represent an immutable loaded snapshot. Include employee, team/line as of period, exact dates/timezone, produced-at versus source-observed-at, quality, targets, and calculation version. Escape formula-leading CSV text fields. Check page breaks, clipping, dark/light capture, and PDF text accessibility; canvas exports are images, not inherently accessible documents.

## 9. Information architecture audit

Keep **1:1s** as the manager entry point. Put data health, reconciliation, and administrative roster/visibility work behind the appropriate role and a consistent operational navigation group. Explain the difference: health answers “did data arrive?”; reconciliation answers “does it match evidence?”; visibility config answers “what is displayed?”

Do not restore removed Team, Home, employee-directory, notes, or AI briefing experiences simply because remnants exist. Link contextual metric details from the scorecard. Administrative actions should describe their scope and consequences and return useful success/failure outcomes.

## 10. Data / metric audit

The [complete 25-definition contract inventory](C:/Users/JamesOswald/projects2/hungerrush_scorecard/docs/audits/2026-09-23-metric-contracts.md) documents the 20 requested attributes using shared rules plus per-metric definitions, formulas, source fields, targets, and reconciliation requirements. There are **20 connector-produced metric keys**, three additionally assigned but unsupported Menufy metrics, and two unassigned catalog entries.

Critical distinctions:

- “Resolved,” “updated,” “handle time,” “offered,” “accepted,” and “non-answered” currently encode specific technical filters that do not automatically equal their familiar business meanings.
- Counts legitimately return zero only when source coverage and identity mapping are complete.
- Ratios and averages need denominators. Averaging already-aggregated employee-week values is not a safe general aggregation across unequal samples.
- Backlog is a point-in-time current-week snapshot, not a historical end-of-week reconstruction.
- Source corrections and period changes need explicit revisions; current `calculationVersion = 1` is not effective version control.
- Current line-specific targets override fallback targets. Leave the existing Menufy range bands alone. Correct historical target selection and disclose target provenance.
- NPS, reopen rate, online/away hours, SLA breaches, and other example metrics in the request are not present as current definitions; do not invent integrations or add these to scope.

## 11. Data lineage

| Metric family | Source → ingestion → storage | Downstream path and failure points |
|---|---|---|
| Tickets/counts/escalations | Search by assignee + updated dates; current status/tags → `agent_stats` summary → keyed facts | Compute → authorized metric query → table/status → exports. Cap, reassignment, late updates, mutable tags, and wrong event semantics can change attribution/cohort. |
| Response/full resolution | Ticket cohort above, subset created within period → metric sets' business minutes → rounded average in `agent_stats` | Missing sets/business-minute exclusions reduce denominator; denominator lost; null removal bug retains prior value. |
| CSAT | Ratings request bounded by timestamps and received score → group by numeric assignee → good/(good+bad) → `csat_summary` | Null if no rated response; payload has rating count but value provenance lacks it. API time semantics and parity still need independent verification. |
| Calls | Incremental Talk export → filter/attribute by first agent → per-direction `call_stats` | Lower-bound, cursor, cap, dedup, and agent attribution issues propagate to every call metric; durations may describe whole calls. |
| Backlog | Current open ticket search → current-week snapshot → latest fact | No source-event reconstruction for old period end; generic recomputation refreshes its timestamp incorrectly. |
| Unsupported metrics | Catalog/assignment only | No live fact producer; render explained unavailability, never zero or implied successful integration. |

At ingestion, source-record uniqueness is useful; within API pages, call-ID dedup is missing. During normalization, skipped nulls and unchanged hashes can retain obsolete facts. During computation, broad source/period scope and unweighted averages create risk. At query time, current organization structure and targets alter history. At UI/export time, asynchronous state can change context. Each boundary needs a testable contract.

## 12. Sync / integration audit

Keep source/fact transactional publication, batch upserts, bounded employee-fetch concurrency, request timeouts, 429 handling, and phase timing instrumentation. These are material improvements already present.

The configured cron runs four offsets daily at 06:00/06:15/06:30/06:45 UTC. Prior operational notes explain platform scheduling variability; observed later starts alone are not a newly proven scheduler defect. However, each period needs its own success record and expected-publication deadline.

The latest four runs had fetch times of approximately **119, 197, 163, and 161 seconds**, publication 2–2.4 seconds, and computation 8–11 seconds. On September 22, one fetch took 250 seconds. Metric-set fetching was the largest recorded phase in the latest historical legs (about 81–109 seconds), followed by ticket search; Talk was not universally the dominant cost.

Retry coverage handles 429 but not a general transient network/5xx policy. Introduce bounded jittered retries, validated Retry-After parsing, a total job budget, and restartable checkpoints. Do not simply multiply retries into a 300-second route budget. A durable queue is justified if corrected ingestion exceeds that budget, not merely because queues are fashionable.

The four-week refresh is a deliberate bounded correction window, not a full historical backfill. State that limitation, support explicit approved backfills, and retain source evidence older than upstream retention. Roster membership changes must not erase historical identity links. Source-instance config and disabled status must constrain selection; current global connector credentials are not a multi-account design.

## 13. Database audit

The normalized relational structure, foreign keys, and source/fact/value uniqueness are worth keeping. Current volume is small; the measured query already uses an index effectively. No evidence supports a database replacement or a blanket index campaign.

Important migrations are semantic: period/calendar identity; definition/calculation versions; source batches/publications; nullable quality reason; numerator/denominator/provenance; effective organizational context; and tenant-safe constraints. Add indexes only after EXPLAIN and workload evidence identify a costly path.

Visibility rules need null-aware uniqueness. Targets need valid bounds and deterministic ambiguity handling. Multi-record roster actions need transactions; logical departure uniqueness should be enforced. Updates to computed values currently leave team/calculation metadata inconsistent with newly supplied insert values. Resolve this through versioned publication, not a one-off patch to historical team IDs.

Never deduplicate Monday/Sunday periods by choosing arbitrary rows: they represent different intervals. Snapshot them, map them to calendar versions, and preserve access. Existing single-precision values and early rounding cannot regenerate lost exact source arithmetic.

## 14. Performance audit

**Highest-return work:** restrict compute to the published source/period, reduce repeated all-history rewrites, and measure safe metric-set batching/concurrency. Cache resolved numeric identities with explicit invalidation. Maintain vendor rate-limit budgets.

**Frontend:** keep server-side data access, client-side local interactions, and dynamically imported export libraries. Repair cache identity, bounded lifetime, and invalidation before adding broader caches. Authorization, target/visibility version, period, and publication identity belong in any shared cache key.

**Proposed acceptance budgets, to confirm in Phase 0:** on representative production hardware/network, warmed scorecard navigation p95 under 1 second; uncached scorecard response p95 under 2 seconds; no stale-context frame; LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1 at the agreed percentile. These are targets, not measured current results. For sync, preserve execution headroom: p95 work below 70% of the actual platform timeout or split into resumable units.

Measure RSC/server action duration, SQL duration/count, transferred JS, export cost, and cold/warm behavior across realistic roster sizes. Do not add virtualization for 62 people or replace React without evidence.

## 15. Security / permissions audit

Keep the production guard that disables development credentials and refuses startup without Entra configuration. Keep authenticated layout/route checks, server-side employee authorization, secret-bearing work on the server, and the guarded view-as mechanism. A plain view-as cookie is not by itself an authorization bypass when the real-user privilege check remains authoritative.

Resolve P0-06 and P0-07 before tenant expansion. Test direct server actions as hostile inputs, not just helper functions. Apply effective assignment dates, including future starts. Validate organization ownership of every referenced object, with deny-by-default behavior and consistent audit records.

Only `.env.example` is tracked among environment files at HEAD. That is positive but not proof that historical commits, logs, or deployment settings never contained secrets. Tracked backup payloads do contain employee-linked data. Confirm repository access, retention, exports, backup encryption, and operator permissions. No destructive history rewrite or credential rotation was performed.

Production Entra tenant policy, token/session expiry behavior, proxy/header configuration, deployment access, and database network/access policy are UNKNOWN without platform access. Avoid claiming a completed penetration test.

## 16. Testing audit

Keep pure target-resolution, visibility, period, comparison, and metric tests. Existing fixes have regression value. Do not replace them wholesale.

Repair the isolated database setup and make its PostgreSQL version deliberate; live 18.6 and local/CI assumptions of 17 should be tested or aligned. Then prioritize:

1. Two-organization malicious admin inputs and one-employee reconciliation scope.
2. Full ingestion correction lifecycle, including null/zero, transaction rollback, concurrent jobs, partial source failure, and compute failure.
3. Independent source fixtures with stable ticket/call/rating IDs, late changes, transfers, page limits, and cursor boundaries.
4. Historical target/membership/calendar versioning.
5. Browser back/forward, rapid period changes, error/retry, cache refresh, and export snapshot fidelity.
6. Roster line mapping and transactional approval/departure.
7. Keyboard, small-screen, and screen-reader flows.

A mocked transaction cannot prove PostgreSQL savepoint recovery. A golden dataset produced by the same formulas cannot prove vendor parity. Use independently hand-verified examples and read-only vendor evidence.

## 17. Observability audit

Structured logs, sync rows/errors, phase diagnostics, a database health endpoint, a data-health page, and optional cron heartbeat are useful existing facilities. Documentation saying there is no monitoring at all is too broad.

Gaps: truthful source-period completeness, job leases/heartbeats, compute/publication outcomes, alert routing/delivery evidence, reconciliation drift alerts, and production frontend/server latency distributions. The health endpoint's `select 1` establishes connectivity, not metric freshness.

Attach correlation IDs for job → source batch → computation → publication → reconciliation. Track request/retry counts, cursor progress, duplicate/dropped records, unmapped identities, expected versus actual coverage, and period deadlines. Alert on failed/late publication, cap reached, dead job, mismatch, and database outage. Suppress duplicate noise; every alert needs an owner and recovery link. Verify delivery with a controlled failure rather than assuming a configured URL works.

## 18. Code quality / architecture audit

Keep TypeScript strictness, domain folders, shared formatting, reusable UI primitives, and the existing monolith. The main duplication is orchestration and contract interpretation, not a need for microservices.

Move cron/manual orchestration into one tested application service. Both should use the same scoped publication result. Keep connector-specific parsing separate from metric business definitions. Make scorecard queries return a complete snapshot; clients should not rebuild trust decisions from loosely synchronized rows and dates.

Separate authorization context from user-submitted filters. Use validated vendor payloads at the boundary instead of relying on type assertions. Resolve ownership of status/export labels in one presentation function. Remove dormant product domains only after confirming no active callers; retain useful tests as part of replacement behavior where appropriate.

## 19. Dependency audit

The stack is internally coherent: Next/React, Drizzle/postgres.js, Tailwind/Radix, Zod, and Vitest. Zero production advisories were reported by the registry check. Exact installed versions and the lockfile should remain reproducible.

NextAuth is explicitly `5.0.0-beta.32`; treat authentication upgrades as a separately tested change with Entra/session rollback coverage. This audit did not establish a newer compatible stable release and does not recommend an unverified upgrade. Align Next and eslint-config-next versions during ordinary maintenance after compatibility checks.

No source imports of `@radix-ui/react-tabs` were found; remove if the build and lockfile audit confirms it is unused. html2canvas/jsPDF have a real export purpose and are already dynamically imported. Evaluate export accessibility/functionality before choosing a replacement, not by package size alone.

## 20. Documentation / CLAUDE.md audit

Repository documents contain valuable incident history and explicit decisions, but mix current truth, plans, and superseded investigations.

| Statement/theme | Audit disposition |
|---|---|
| “CSAT broken” blanket claim | Stale: current DB and browser have rated CSAT values. Exact source parity remains unverified. |
| Five live metrics in registry | Incomplete: 25 definitions, 20 producer keys, 40 assignments. |
| Monday–Sunday reporting | Historical: current code uses Sunday–Saturday UTC, with old intervals retained in data. |
| POS call metrics unassigned | Stale: current POS assignments include call metrics. |
| Historical results never overwritten | Contradicted by broad compute upserts and current-context targets. |
| Raw source payload archive | Misleading: stored employee-week summaries omit event-level evidence. |
| All monitoring absent | Overbroad: health, logs, diagnostics, and optional heartbeat exist; alert reliability still unknown. |
| Team/Home/employee pages as current IA | Superseded by the 1:1 product decision. |
| Rippling manager link | No active UI reference found; environment residue is not a current feature. |
| Signed view-as cookie | Documentation overstates cookie mechanism; security depends on guarded real-user authorization. |
| PostgreSQL 17 | Deployment snapshot reports 18.6; document actual environment matrix. |
| Menufy target recalibration | Explicitly deferred; retain current bands. Do not reopen as an automatic overhaul task. |

Earlier planning findings also need disposition: 429 handling and idempotent upserts are now implemented; transactional source/fact publication is improved; pagination exists but completeness remains unsafe; role/effective-date target gaps remain; dormant team/briefing complaints do not describe the current manager workflow. Keep FIX_LOG/INVESTIGATION/FOLLOWUPS as dated evidence, not parallel constitutions. An old unresolved incident entry must not override a later verified resolution.

CLAUDE.md should become a concise engineering constitution: product purpose, boundary rules, canonical metric logic location, data quality/versioning rules, UI conventions, performance expectations, testing, permissions, migration discipline, and documentation ownership. Keep long incident narratives and vendor research elsewhere.

## 21. Things to remove

**REMOVE after verification:** unused Radix tabs dependency; unreferenced old team-change/briefing/observation paths that no longer serve a supported workflow; stale current-state claims and duplicated status labels; “configured” presentation for retired Assembled; obsolete Rippling configuration if operationally unused.

**REMOVE from normal repository storage after controlled migration:** real employee backup payloads. Keep encrypted recoverable copies and retention/audit evidence elsewhere before removing tracked files. Deleting a working-tree file does not remove Git history.

Do not delete historical periods, external identity links for departed employees, source provenance, or target history to make the dataset appear cleaner.

## 22. Things to keep

**KEEP:** the focused 1:1 product; Next.js/React/TypeScript/PostgreSQL; server-side authorization; development-login production guard; pure target/visibility functions and regression tests; established Menufy range behavior; current Sun–Sat UTC default pending explicit policy; batch writes and source/fact transaction; uniqueness/idempotent upserts; request timeout/429 safeguards; diagnostic timings; search/sort grouping; design tokens, reduced motion, skip link, reusable primitives; lazy export loading; null-versus-zero intent.

Preserving these is more economical and safer than rebuilding the application around a new stack.

## 23. Target architecture

Keep a modular monolith with five explicit boundaries:

1. **Vendor adapters:** authenticated fetch, pagination, response validation, immutable minimal source evidence and coverage.
2. **Ingestion/publication service:** lease, staged batch, mapping version, normalization, transaction, scoped compute, publication decision.
3. **Metric domain:** versioned contracts, exact numerator/denominator, period/calendar semantics, target resolution, data quality, and independent reconciliation adapters.
4. **Authorized query service:** organization/employee scope and historical context; returns a complete scorecard snapshot.
5. **Presentation:** picker, snapshot renderer, metric evidence disclosure, operational tools, and export adapter.

Cron and manual routes become thin authenticated entry points. Introduce durable workers only if measured corrected workloads need them. A separate analytics warehouse, GraphQL layer, or general workflow platform is not justified by current scale.

## 24. Target data reliability architecture

Use a batch state machine: **queued → fetching → staged → validated → published**, with partial/failed/cancelled outcomes that never impersonate a successful publication. Maintain last-good publication and last-attempt separately for each source and period.

A value should identify organization, employee, historical team/line context, canonical period/calendar, metric definition/calculation version, source batch/revision, numerator/denominator where relevant, target version, source-observed time, fetched time, calculated time, published time, quality reason, and reconciliation result. Not every attribute needs a separate table; model according to demonstrated queries.

Contract quality states: complete, partial, stale, failed, missing, unsupported, and not-applicable, with open/closed period tracked separately. Zero is a numeric observation supported by a complete denominator/coverage, not a fallback for any of those states.

**Reconciliation:** retain fact-to-value consistency, add source-to-fact checks using independent IDs/cohorts, and compare rendered/exported snapshots to the same publication. Counts require exact match; ratios/durations permit only contract-defined rounding tolerance. Compare source coverage and denominators before comparing rounded values.

**Migration safety:** freeze old version 1 semantics, create version 2 with a dated contract, shadow-compute without changing manager output, compare representative closed/open periods and edge cases, document intentional differences, then canary by authorized cohort. Historical recalculation must be explicit and traceable. Keep both versions and a reversible publication pointer; do not silently replace old history. Backfills must preserve old source evidence and mark cases that cannot be reconstructed.

**Freshness proposal:** daily current-week publication with a configurable 36-hour stale threshold as an initial product decision; closed periods show observed-at and correction-window policy rather than becoming perpetually “fresh” through recomputation. Confirm manager expectations before adopting the number.

## 25. Target UI / design system

The scorecard header should answer: **who, which period, which calendar/timezone, open or closed, and how trustworthy the data is**. Next, show a justified assessment and any missing required evidence. Then use concise metric groups with actual, prior period, target, and status; place detailed definitions/source lineage in accessible disclosures.

Retain brand colors and existing primitives. Formalize type scale, spacing, numeric alignment, status colors/text, focus rings, loading/error/empty states, and mobile table behavior. Use status text and icons as well as color. Prefer one shared accessible menu/dialog pattern.

Create a snapshot-based export layout with explicit context and a print-oriented theme. Validate by comparing exported numbers, dates, targets, and quality flags with the loaded scorecard. Design polish is complete when representative tasks and accessibility checks pass, not when screenshots merely look different.

## 26. Target documentation structure

| Document | Owns |
|---|---|
| `CLAUDE.md` | Concise engineering rules and links to authoritative documents. |
| `docs/PRODUCT.md` | Supported workflows, roles, deliberate exclusions, approved reporting calendar and status policy. |
| `docs/ARCHITECTURE.md` | Boundaries, request/data flow, deployment topology, cache and publication design. |
| `docs/DATA_MODEL.md` | Tables, invariants, tenant/effective-date/version relationships, migration compatibility. |
| `docs/METRICS.md` | Canonical contracts, formulas, source cohorts, targets, quality, tolerances, versions. Replace/supersede the incomplete registry explicitly. |
| `docs/INTEGRATIONS.md` | Verified vendor contracts, endpoint limits, identity mapping, source coverage and unknowns. |
| `docs/RUNBOOK.md` | Deploy, migrate, backfill, alert response, repair, backup/restore, rollback and owners. |
| Existing design-system doc | Tokens/components, accessibility and export standards; cross-link rather than duplicate PRODUCT. |
| Dated audit/decision/incident archive | Evidence, rationale, superseded investigations, and acceptance records. Clearly non-authoritative for current behavior. |

Every behavior change updates its owning document in the same change. Name an owner by role before implementation starts; individual owners were not established in this audit. Keep one authority per decision and mark superseded documents visibly.

## 27. Production readiness gaps

| Area | Current evidence | Release gate |
|---|---|---|
| Deployment | Build passes; Vercel cron config exists | Verify actual platform limits, environment identity, cron auth, secrets and canary rollback. |
| Metrics | P0 correctness failures confirmed | No unaccepted P0; independently reconcile critical metrics before calling them authoritative. |
| Permissions | Base helpers exist; write/scope gaps remain | Negative action/API tests with multiple organizations and partial-team assignments. |
| Migrations | Drizzle structure exists | Expand/contract migrations, production-like rehearsal, versioned historical coverage report. |
| Backups | Tracked JSON snapshots exist | Verified encrypted DB backup and point-in-time strategy, retention/access policy, restore drill. JSON subsets are not a full recovery plan. |
| Source recovery | Four-week refresh and summary storage | Demonstrate what can/cannot be rebuilt beyond that window; never assume upstream retention. |
| Monitoring | Logs/health/optional heartbeat | Tested alerts for failed or late publication, dead job, mismatch, and database outage, with named responder. |
| Environment separation | Local app accesses shared data | Isolated test/staging database and guarded operational scripts. |
| UI/export | Period mismatch reproduced | Automated navigation and export-context checks; accessible interaction pass. |
| Operations | Provider configuration not inspected | Agreed recovery objectives, release owner, incident owner, escalation route, and recovery rehearsal. |

**Recovery proposal requiring operational agreement:** target daily backup plus provider PITR where supported, RPO no more than 24 hours and RTO within one working day for initial internal use. These are proposed objectives, not verified provider features. Restore into an isolated environment, verify organization/identity/target/version integrity and sample scorecards, and document actual achieved times. Include migrations, configuration, and source mapping in recovery, not only numeric values.

## 28. Prioritized implementation roadmap

This roadmap changes the suggested sequence slightly: emergency authorization containment runs alongside critical data work, rather than waiting for a later security phase. No phase below was implemented in this audit.

### Phase 0 — Baseline, safeguards, authoritative decisions

- **Objective:** make change outcomes measurable and reversible.
- **Scope:** retain this audit/snapshot; repair isolated test DB; inventory production settings; verify backups/restore; confirm metric semantics and reporting policy owners; establish page/API/sync budgets.
- **Dependencies:** access to operational configuration and vendor reference samples.
- **Files/systems:** audit artifacts, test setup/CI, environment handling, documentation, database backup service.
- **Risks:** treating current outputs as gold truth; accidental shared-database test writes.
- **Data migrations:** none; read-only census and restorable snapshot.
- **Validation:** repeat baseline in isolated environment, reconcile a hand-verified sample, complete restore drill.
- **Rollback:** discard diagnostic environment; retain original snapshot and code.
- **Definition of done:** baseline reproducible, critical definitions/unknowns recorded, safe test environment available, restore evidence and owners recorded.

### Phase 1 — Critical correctness and immediate permission containment

- **Objective:** stop misleading values/context and unauthorized object access.
- **Scope:** P0-01/02/05/06/07; explicit failure/quality states; bounded compute; accurate period snapshot; preserve last-good data.
- **Dependencies:** Phase 0 baseline; permission fixes can start immediately with isolated fixtures.
- **Files/systems:** compute, sync routes/service, source/fact publication, scorecard body/actions/export, admin/reconciliation actions, authorization.
- **Risks:** exposing previously hidden missing data, stale caches, mixed old/new consumers.
- **Data migrations:** additive publication/quality fields and tombstone/revision support; no destructive historical rewrite.
- **Validation:** null correction lifecycle, failed fetch/compute, race/back-navigation, export during loading, and cross-tenant/partial-team negative tests.
- **Rollback:** feature flag/pointer to last-good publication; preserve new evidence; old reader only if it does not reintroduce unsafe claims.
- **Definition of done:** failures cannot become complete/fresh; exact period/value coupling; scoped writes and aggregates; no unaccepted P0 in these paths.

### Phase 2 — Verified sources, reliability, and reconciliation

- **Objective:** make source completeness and metric meaning defensible.
- **Scope:** P0-03/04/08; vendor cursor/search repair; contract version 2; event/denominator evidence; calendar/history access; leases, resumability, independent reconciliation.
- **Dependencies:** vendor verification and approved definitions; Phase 1 publication model.
- **Files/systems:** Zendesk adapter/shared request helper, sync engine, metric contracts, reconciliation engine, schema and historical query service.
- **Risks:** source retention limits, changed numeric results, provider quota/runtime pressure.
- **Data migrations:** additive calendar/definition versions, source revisions, denominators, lease/checkpoint records; explicit limited backfills.
- **Validation:** edge-case source fixtures, exact count parity, ratio tolerance, old/new shadow report, all 11 existing intervals accounted for, concurrency/restart tests.
- **Rollback:** revert publication pointer/reader flag; retain old and new versions and raw evidence; never delete old intervals.
- **Definition of done:** critical metrics independently reconcile; capped/partial data cannot publish as complete; stale jobs recover; intentional metric changes are approved and versioned.

### Phase 3 — Security, roster integrity, and production safety

- **Objective:** complete systemic controls after urgent containment.
- **Scope:** effective assignment dates, tenant-safe relationships, transactional roster/line mapping, actor audit, sensitive backup relocation, environment and recovery controls.
- **Dependencies:** isolated multi-organization fixtures and operational owner.
- **Files/systems:** schema, authorization, roster engine/actions, scripts, deployment settings, backup storage.
- **Risks:** legacy relationship violations, changing group precedence, sensitive history handling.
- **Data migrations:** preflight then add validated constraints and historical membership context; deduplicate only after a reviewed report.
- **Validation:** invalid scope/date/relationship tests; roster retry/approval/departure tests; backup access and restore rehearsal.
- **Rollback:** reversible configuration and application deploy; preserve constraint preflight reports and data snapshots; avoid dropping evidence.
- **Definition of done:** every mutation/query has tested scope; roster operations are atomic; recovery and environment separation are documented and proven.

### Phase 4 — Architecture and code cleanup

- **Objective:** reduce competing implementations without changing approved outputs.
- **Scope:** one orchestration service, one snapshot query contract, shared status/export labels, validated vendor boundary, remove proven dormant code/dependencies.
- **Dependencies:** stabilized contracts and publication model.
- **Files/systems:** routes/actions, domain metrics/reconciliation, connector types, dormant briefings/observations, package manifest/lockfile.
- **Risks:** hidden caller dependency or subtle behavior drift.
- **Data migrations:** none expected beyond prior additive model; archive rather than drop unneeded historical data.
- **Validation:** public behavior regression suite, import graph, build, typecheck, lint, and full isolated tests.
- **Rollback:** small independently revertible commits.
- **Definition of done:** cron/manual share outcomes; no duplicate active trust/status rules; removed paths have no supported callers.

### Phase 5 — Design system and UI/UX overhaul

- **Objective:** make trust and manager navigation clear.
- **Scope:** context/freshness header, provisional and insufficient-data states, metric explanations, picker continuity, accessible menus, responsive tables, consistent snapshot exports.
- **Dependencies:** authoritative snapshot quality/period/target fields.
- **Files/systems:** scorecard/picker/week/export components, primitives, theme tokens, error/empty states.
- **Risks:** visual density, accidental target/meaning changes, export clipping.
- **Data migrations:** none.
- **Validation:** manager task walkthrough, keyboard/screen-reader checks, agreed small/large viewports, export-value comparison and page rendering.
- **Rollback:** scoped UI feature flag with the same safe snapshot API.
- **Definition of done:** identity/period/quality/status reason are discoverable; navigation preserves context; all supported exports match their snapshot; accessibility issues accepted or resolved.

### Phase 6 — Measured performance optimization

- **Objective:** meet agreed response and sync budgets with headroom.
- **Scope:** metric-set request scheduling, source-scoped compute, safe identity cache, SQL/route profiling, export loading; queue only if needed.
- **Dependencies:** correct source contract and baseline workload.
- **Files/systems:** connector/request scheduler, compute queries/indexes, query/cache layer, deployment runtime.
- **Risks:** quota amplification, stale authorization cache, speculative indexing.
- **Data migrations:** measured indexes or job storage only when justified by plans.
- **Validation:** before/after p50/p95, quotas, row counts, cold/warm page transfer and interaction timing; identical metric outputs.
- **Rollback:** concurrency/cache switches, additive index rollback if necessary, previous publication worker.
- **Definition of done:** accepted budgets met under representative load with correctness and permissions unchanged.

### Phase 7 — Regression and observability hardening

- **Objective:** detect correctness and operational regressions before managers do.
- **Scope:** complete risk matrix, publication/reconciliation alerts, real DB fault tests, frontend telemetry, dead-job detection, CI release gates.
- **Dependencies:** stable domain behavior; testing and logging begin in earlier phases, not here for the first time.
- **Files/systems:** test suites/fixtures/CI, logger and client-error endpoint, sync health, dashboards, alert receiver.
- **Risks:** alert noise, sensitive payload logging, flaky source-dependent CI.
- **Data migrations:** operational retention indexes/tables only if needed.
- **Validation:** controlled failures trigger correct owners; restore/replay works; deterministic offline fixtures and separate read-only vendor checks.
- **Rollback:** tune alert routing/thresholds; retain essential failure signals and audit data.
- **Definition of done:** critical failures are detectable/actionable; full isolated suite passes; no secret/employee payload leakage in telemetry.

### Phase 8 — Canary, final polish, and release readiness

- **Objective:** release an evidenced improvement with a viable rollback.
- **Scope:** shadow comparison review, canary managers, final docs/CLAUDE cleanup, accessibility/export polish, recovery and incident rehearsal.
- **Dependencies:** earlier gates; explicit acceptance of remaining risks.
- **Files/systems:** feature flags/publication pointer, docs, deployment configuration, release record.
- **Risks:** confusing old/new historical semantics; insufficient observation window.
- **Data migrations:** final compatibility cleanup only after old-reader usage ceases and backup recovery is proven.
- **Validation:** at least two closed weekly cycles plus an open-period cycle for critical metrics, canary task checks, rollback exercise, before/after budgets.
- **Rollback:** tested deployment and publication pointer reversal without deleting versioned history.
- **Definition of done:** no unresolved P0/P1 without explicit named acceptance; critical metric contracts/parity proven; stale/failed data cannot masquerade as current; permissions verified; core workflows and exports covered; alerts and restore tested; documentation matches production.

**Implementation order within the first tranche:** period snapshot bug and admin/reconciliation scope containment → false freshness and null correction → Talk/search completeness → historical/calendar/metric semantics. Keep changes independently reviewable. Success is fewer misleading decisions and easier recovery, not a larger diff.

