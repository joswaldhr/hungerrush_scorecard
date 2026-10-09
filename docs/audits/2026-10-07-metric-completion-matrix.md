# Production metric completion

## Current readiness and next work — October 9, 00:35 UTC

This table supersedes older status paragraphs below. A published number, successful
job or reported-value count is not a whole-scorecard accuracy claim.

| Workstream | Verified state | Next acceptance check |
|---|---|---|
| Solved report credits | Both teams' September 27 and October 4 queue generations completed. Current-week independent reconstruction matches 23 Menufy and 39 POS values with zero differences, including five genuine zeros. | Correlate the two newer runs with platform invocation logs; observe the next six-hour collection and a full recurring day. |
| Ticket updates | PR59 and a controlled Menufy publication are live for September 27–October 3: 23 independently verified values/sets, 21 matching populated report rows and two source-proven zeros. Hosted/live export checks pass for that closed week. Current source replay matches but its report comparison is unavailable. | Older/current reference qualification, POS's own definition and recurring operation. Assignment is bounded to the one published week; no recurring publisher is active. Explore contributing-event IDs remain unverified. |
| Inbound and outbound | Scoped independent canaries are recorded below; five outbound employees remain excluded. Some legacy numeric measures still lack qualified contracts. | Resolve those source joins and qualify each remaining measure; then verify genuine recurring publication and recovery. |
| CSAT and first reply | Separate qualified policies exist. No-rating cohorts remain null. Optional CSAT recovery is not enabled. | Verify repeated scheduling, bounded recovery, sample denominators and observation freshness independently. |
| Roster lifecycle | PR57 checks directory account state. PR58 adds durable manager-specific archive/restore; one confirmed removal is live (22 active / one archived for that manager; other manager 39 unchanged). Historical data and source assignments are preserved. | First directory slot has correlated HTTP 200 and refreshed 62-account observation; scheduler user agent/duration remain unverified. Decouple group discovery and establish company/team roster authority. Manager meeting-list archive is not employment termination or source-assignment removal. |
| Manager experience | Administrator view-as and prior export bytes were checked. | Each manager's own sign-in and normal meeting/export workflow; native print remains unverified. |

**Source roster discrepancy, now handled in the meeting list:** a manager-reported former team member remains an
active, unsuspended Zendesk agent in the mapped group. Today's 06:12 UTC Cadence
observation and 20:30 UTC bounded source read agree; no departure proposal exists.
This is a source-authority gap, not evidence of company employment. Zendesk's
`active` means not deleted, not employed. Do not archive employment from this flag.
PR58 now provides the dated, reviewed manager meeting-list archive with retained
history and protection against automatic re-addition. Actual source team membership
and company employment still need an agreed authority. Keep personnel details private;
no Zendesk or employee records were changed.

The account is independently disabled in Entra, first observed October 5 and confirmed
October 8. PR57 now surfaces that conflict to the scoped manager and administrators.
PR58 subsequently closes the meeting-list removal gap; HR/source authority remains open.

**Execution order:** the focused Data Health release is live in PR56; address roster authority
and discovery visibility; finish one metric family at a time using independent
report/source comparisons, then prove recurring operation. Keep a single owner for
integration and releases. Parallel research, when requested, must have disjoint
scopes and cannot mutate vendors or production independently.

**Completion standard:** every expected employee/metric/period has a correctly
defined value or a truthful, explained no-sample/not-applicable state; unexplained
gaps are zero, source sets and denominators reconcile, and refresh/retry/access/export
behavior is observed. Never replace missing evidence with zero to improve coverage.

Earlier dated sections below are historical evidence, not the current checklist.

**October 8, 18:11 UTC — continuation repair live and current acceptance baseline:**
PR54 (`bf7ea0d`) corrects deleted-ticket pagination; isolated synthetic checks, all
1,224 tests, exact CI/build and production read checks pass. Fresh parent joins reduce
Menufy's last-closed-week update differences to one employee / one update among 21
populated report rows. No update-credit formula or publication changed. Actual manager
contexts now have a retained domain-reader census for all 62 current employees over
two closed weeks and current week. Coverage is not certification: unqualified legacy
numbers and legitimate null cohorts are distinguished in the remaining work.
See `2026-10-08-manager-visible-coverage.json` and the authoritative ledger.

**October 8, 17:43 UTC — latest verified coverage:** all 62 active employees have
the five scoped inbound measures refreshed for September 27–October 3 (PR51 ledger
receipts), and 57 have five outbound measures refreshed (PR52). The outbound fixed-date
code is live as `e05014d`; independent checks match all 285 newly persisted outbound
values. Five employees remain excluded pending source-parent/report reconciliation.
CSAT current-week recovery and three-period verification were completed earlier today;
the older failed-CSAT checkpoint below is superseded. Recurring outbound and Menufy
publication, ticket-update credits, remaining metric gaps, prior comparison/target
context and real scheduler evidence remain open. See the authoritative implementation
ledger and `2026-10-08-outbound-scoped-refresh.md` for exact boundaries.

**October 8, 14:42 UTC — Menufy fixed-period code correction live:**
PR49 merged to `baca908`; exact candidate CI `37793605960` and master CI
`37794117956` pass. Production `dpl_GNJxmAjuSeCfUVrTVui2ete9WtQ4` is READY and
owns the live alias. Login, authenticated representative scorecard and disabled Menufy/
recovery endpoints pass; anonymous inbound requests are rejected. All 22 production
environment metadata entries and 16 cron definitions are unchanged. No extra sync was
triggered. The prior qualified POS deployment is the code-only rollback reference.
See `2026-10-08-menufy-fixed-production.json`; new Menufy publication remains disabled.

The fresh read-only operational census records 14 completed/two failed runs in the
last day, with no running workers. Older-week legacy and current CSAT requests hit
source rate limits and wrote zero values; current CSAT still carries an October 6
observation. This is database evidence, not newly correlated scheduler-log evidence.
The solved-only recovery path does not cover all metric families: CSAT needs durable
fixed-period retry, alongside adequate scheduler capacity. See the aggregate
`2026-10-08-operational-census.json`. Remaining source discrepancies, Menufy activation,
closed POS periods, other families, lifecycle/access and real scheduling remain open.

**October 8, 14:02 UTC — five POS inbound measures live and independently verified:**
PR44 and PR48 are merged; production `bc8e26e` passes exact master CI/build
`37732854918`. Active deployment `dpl_5H9MubkMyqtAbEVjZ3QUbkbyXdbR` is READY
and owns the production alias. The code-only deployment first verified authenticated
inactive routes, anonymous rejection and unchanged policy metadata. Activation added
only the collection and POS release policies; all 16 existing crons are unchanged,
the recovery queue stays disabled, and no new schedule was installed.

A fresh 13:48 encrypted backup restored 35 tables / 373,526 rows with matching
digests. An earlier attempt correctly stopped before dispatch because its backup
was older than one hour. The one controlled canary returned HTTP 200 in 54.567 seconds
and published 195 current-week values for all 39 POS employees. Independent Python
reconstruction matches every value, 546 contributing-source sets and 156 duration
numerator/denominator checks with zero differences. Twelve genuine zeros and 24
no-sample nulls retain their meaning. Eleven protected digest groups are unchanged;
170 predecessor value snapshots match at the captured millisecond timestamp precision.

Representative production scorecard and stored history match all five corrected values.
Fresh actual CSV (11,203 bytes), PDF (785,748) and PNG (1,190,593) downloads pass;
PDF/PNG decoded pixels match exactly, and the rendered PDF is visually inspected.
Current statuses stay neutral, incompatible targets/comparisons stay withheld, and
history returns to the selected week. The administrator's original Barbara preview
was restored and the temporary tab closed. This is administrator preview evidence,
not the manager's own login. Native print remains unverified.

See [the production receipt](2026-10-08-pos-inbound-production.json). Closed-week POS
publication, declined/missed assignments, remaining metric families, roster/access
and genuine scheduled operation remain open. The full goal still covers both teams.
The previous deployment/pending-publication descriptions below are historical.


**October 8, 05:24 UTC — fresh POS qualification:** Runtime `7403b78` passes exact
CI/build and 1,205 tests; its default-off authenticated POS endpoint is READY on
isolated Preview. Fresh bounded collection and identity/group checks support all
39 current staff for last closed and current weeks. Independent source reconstruction
and the actual publication wrapper match all 546 values and contributing evidence,
with zero differences; neither of two global parent gaps affects these cohorts.
Backup/restore matches all 35 tables / 355,355 rows. Aggregate receipts and the scoped
release manifest are pushed in PR44 `8f2818f`. Production publication remains pending;
declined/missed require prospective assignments and genuine scheduling remains open.
This does not close the other POS measures, Menufy gaps or cross-cutting requirements.

**October 8 POS hosted acceptance:** PR44 `ed5350a` passes exact CI/build
`37729327026`; runtime-identical isolated Preview `2b89c27` is READY. Its full
synthetic collection/live-adapter/publication path matches 21 values over two closed
weeks plus current with unrelated values unchanged. Browser values, closed/current
history, actual CSV bytes, rendered PDF and PNG exports pass for the seven measures.
Zero/null sample handling, neutral progress status and withheld targets are retained.
Evidence is in PR44 `786e5a2` (`2026-10-08-pos-inbound-preview.json`). Fresh production
source/roster qualification, release/canary, native print and genuine ongoing scheduling
remain required. This does not complete or narrow either team's full metric scope.

**October 8 POS publication candidate:** PR44 `fa92837` connects the seven calculations
to guarded atomic publication with fixed periods, source/employee/assignment checks,
legacy replacement isolation and exact duration provenance. All 1,199 local tests pass;
exact CI `37728421985` is queued. It is not activated or deployed. Hosted rehearsal,
fresh source/roster reconciliation, catalog/release, canary and scheduler evidence remain;
offered, abandonment, transfer and other team metric requirements remain unchanged.

**October 8 POS replay records:** PR44 `ea7680d` adds minimized, replayable employee
records and local-period coverage checks. All 1,019 local tests pass; 78 serialized
employee-periods preserve all 546 independent values and contributing evidence.
Prior calculator CI `37726475078` passes. The new records remain blocked from publication;
guarded publisher integration, fresh qualification and the other metric families remain open.

**October 8 POS candidate:** PR44 `fededf0` implements seven saved-report measures.
Retained weekly/monthly source comparisons match all 882 exported values and 71 monthly
source sets; a separate two-period 39-person capture matches 546 values and 390 source
sets. All 1,012 local tests pass. No publisher is connected or activated. Fresh source,
publication/recovery/scheduling and remaining offered/abandonment/transfer definitions
are still required. The full goal has not been reduced to these seven measures.

**October 8:** Representative POS closed/current CSV bytes and copied text agree with
all 38 displayed rows. Actual closed PDF/PNG and exact stored history also agree.
This does not qualify the source values: closed outbound observations predate the
period's end, while current outbound remains a different legacy definition. Ongoing
qualified outbound refresh remains open. See `2026-10-08-pos-production-export-verification.json`.

**October 7, 21:04 UTC:** PR47's collector/publication coordination is live after exact
CI/build, isolated synthetic rehearsal and fresh encrypted restore. One controlled
Menufy current-week refresh independently matches all 23 staff / **1,657 credits**,
including three numeric zeros. All 69 exact predecessor snapshots match revisions and
12 unrelated-data digest groups are unchanged. This closes the production refresh-revision
check for this scope. It does not close genuine scheduling, deferred-work recovery,
daily capacity, other metric families or remaining formats. No new schedules changed.
See [the coordination receipt](2026-10-07-report-sync-coordination-production.json).

**October 7, 20:34 UTC:** The first incremental collection refresh passes: one page,
783 new events, exhausted through 20:32:53 UTC, with thirteen unaffected digest groups
and prior retained events unchanged. It does not refresh the published solved values.
Daily source volume reaches 14,219 events; ongoing scheduling must handle multiple
batches, deferred work and adjacent-hour cooldown collisions before activation. No new
schedule is installed; the full acceptance matrix remains open.

**October 7, 20:13 UTC:** Both solved definitions are published for all 62 current
staff in the last closed and current weeks: **124 employee-week values**, with zero
unexplained independent source-set/count differences. All four manual canaries preserve
unrelated data and return HTTP 200 on the verified live deployment. Menufy browser,
closed/current CSV bytes and rendered closed PDF checks pass. POS's changed closed-week
total is explained by a source ticket becoming unsolved. New schedules, genuine solved
cron/revisions and wider metric completion remain open. See
[the production canary receipt](2026-10-07-solved-production-canaries.json).

**October 7, 19:46 UTC:** Fresh durable Menufy joins and independent reconstruction
match all 23 active employees in both initial publication periods: 4,106 last-week
solved credits and 1,634 current credits through 19:41:45 UTC. No count/source-set
differences or unresolved parents remain in these captures. This supports the solved
definition only; update-event report discrepancies remain unresolved. Production
catalog/canary and scheduled operation are still pending. See
[the fresh qualification receipt](2026-10-07-durable-solved-qualification.json).

**October 7, 19:43 UTC:** Durable manual bootstrap is complete: 139,915 events /
142 pages through October 7 19:41:45 UTC. Eight corrected paced batches avoided
further source throttling. Fresh joined-source reconciliation, catalog/canary publication
and genuine scheduling remain; zero new solved values are published. The completed
stream alone does not complete solved-ticket acceptance. See
[the aggregate collection receipt](2026-10-07-report-event-bootstrap-verification.json).

**October 7, 19:14 UTC:** The PR46 pacing correction is live and its first resumed
manual batch advanced ten pages without source throttling. Production retains 74,414
events / 75 pages through October 2; bootstrap is incomplete. Exact CI, isolated
synthetic complete-path checks and fresh encrypted recovery pass. No solved catalog,
publication policy or new schedule is active. Continue collection, fresh joins,
independent reconciliation and scoped publication; do not treat the pacing release
as completed employee metrics. See [the receipt](2026-10-07-report-pacing-production.json).

**October 7, 18:44 UTC:** PR45's collection-only production policy is active and its
manual bootstrap is incomplete (25,516 retained events / 26 pages before the current
resumed batch). No new solved catalog, publication policy or schedule is active.
A source HTTP 429 preserved progress and cooldown; continuation followed read-only
cooldown/lease checks. This supersedes earlier inactive-collector descriptions below,
not the outstanding solved-publication gates. Genuine first-reply scheduling is now
verified separately for current and last-closed weeks; the closed-week receipt is
[recorded here](2026-10-07-first-reply-closed-week-scheduled.json).

This is the acceptance tracker for the active goal: usable, independently reconciled
1:1 scorecards for both manager teams. Code deployment, numeric availability and
source correctness are separate states. The October 7 live code release does not
complete this tracker. The current roster baseline is 23 Menufy and 39 POS employees;
refresh that inventory before publication and evaluate period eligibility explicitly.

Fresh October 7 read-only production assignment inventory confirms **21 effective team
keys / 23 active staff for Menufy**, and **19 / 39 for POS**, at September 27 and
October 4 period starts. Menufy's four prospective inbound additions bring October 11
to 25 keys; POS remains at 19. There are no duplicate team assignment rows for these
keys. [The aggregate inventory](2026-10-07-effective-metric-inventory.json) lists every
key, unit, aggregation and status. Counts do not establish accuracy, employee-specific
override resolution or historical membership. POS has no effective first-response
assignment in this inventory; existing stored first-response values must not be
mistaken for an assigned metric. This inventory preceded the subsequent October 7
solved catalog activation; the qualified solved keys are now assigned from September 27
as recorded above, replacing the old human-only solved assignments prospectively.

## Metric acceptance matrix

| Metric / family | Menufy evidence and remaining work | POS evidence and remaining work |
| --- | --- | --- |
| Solved tickets | Qualified updater-credit catalog and publication are live from September 27. All 23 active staff independently match 4,106 closed / 1,634 current credits after complete durable collection and fresh joins. UI and actual closed/current CSV plus closed PDF checks pass. Ongoing delta capacity, scheduled publication/revisions and remaining format checks are open. | Qualified current-assignee/solved-date catalog and publication are live from September 27. All 39 active staff independently match 1,410 closed / 733 current tickets. The one-ticket reduction from the earlier saved report is source-explained; second closed-week independent evidence remains 1,464. Representative POS browser/history and ongoing scheduling/revisions remain open. |
| Update activity | Current 23-person cohort, fresh October 8 parent joins: 20 of 21 populated second-week report rows match, one differs by one update; two employees have no report row. A follower-change-only candidate is a hypothesis, not proof of the missing report member. First-week residual, fresh event/identity qualification and separate publication remain required. See the parent-reconciliation receipt. | Establish the applicable update-activity report's exact unit, scope and attribution. Do not copy Menufy's updater/group contract or use current-assignee snapshots. |
| First response | Qualified business-time policy exists. Verify all current employee cohorts, zero-sample semantics, freshness and actual scheduled execution after the release. | Verify team-specific definition and per-employee source evidence; inherited labels and stored numbers are insufficient. |
| CSAT score / response rate where assigned | Preserve existing qualified solved-date/current-assignee calculation and its separate rated/offered/cohort denominators. A score without ratings is legitimately unavailable; confirm each blank against its cohort. Close scheduled refresh/recovery checks. | Match team-specific rating cohort and every employee's numerator/denominator. Do not assume Menufy's release policy applies. |
| Inbound offered / accepted / declined / missed / unreachable / answer rate | Retained comparison covers all 23 active staff over closed/current periods. Qualified publisher remains inactive; new catalog entries are effective October 11. Finish fresh durable collection, scoped canary and scheduled refresh; do not backdate the new assignments silently. | POS source projection has separate weekly and monthly report parity. Reconcile offered components separately, integrate the qualified projection, then complete publication and scheduling. |
| Inbound total talk / max hold | Saved SUM/MAX definitions have source parity. They must be labeled and published as SUM/MAX, not substituted for averages. Publication and operation gates remain. | Preserve report aggregation and eligible agent-leg cohorts; qualify each displayed duration before activation. |
| Inbound average talk / hold / total duration / consultation | Identify and verify each required average's denominator. SUM/MAX exports alone do not qualify averages. Null with no eligible legs is distinct from absent collection. | Retained projection comparisons support eight report measures; integrate the separate projection branch, preserve duration sample counts and verify weekly/current publishing. |
| Abandoned on hold | Verify actual agent-leg on-hold abandonment. A mislabeled IVR/queue/voicemail subtotal is not an acceptable replacement. | Same semantic check; retain team-specific source scope. |
| Outbound participation / completed / non-answered / talk / hold | Controlled publication and source comparisons exist; older retained observations do not establish daily freshness. Complete ongoing collection/scheduling and qualify average versus total talk separately. | Source projection comparison exists; finish its team-specific publication, null/sample handling and scheduled operation. |
| Elevated / avoidable elevated work | Current tags alone do not prove who worked an escalation. Establish classification, event attribution and exact report correspondence. | Same evidence requirement, using POS classification and scope. |
| Backlog snapshot | Retain observation timestamp; do not describe an observed snapshot as a guaranteed week-end count. Confirm required team scope and cadence. | Same snapshot distinction; verify employee ownership and observation time. |
| Active handle time | Resolution duration is not active handling time. Establish a valid source/definition if required; do not relabel resolution time to fill this row. | Same requirement. |
| Historical away / transfers-only durations | Required by retained meeting template. A current-day cumulative Talk endpoint cannot reconstruct last week. Find a complete historical source or implement a prospectively qualified capture with its explicit history limit. | Confirm whether required by the team's meeting pack before adding a different team's measures. |

The source census contains historical stored keys that may no longer be displayed or
assigned. It is not an assignment inventory. Before final acceptance, reconcile current
effective team/employee assignments and the retained meeting-pack requirements into an
individual key checklist; no family may be silently dropped to make the tracker green.
Assembled remains parked. HR attendance points remain outside the Zendesk metric scope.

## Cross-cutting acceptance

- Reconcile employee identities, additions, departures and transfers; preserve prior
  observations and manager authorization. Current identity matching does not prove
  historical team membership.
- Compare at least two completed weeks where reliable history exists and the current
  in-progress week. Check exact contributing sets and denominators, not just totals.
- Require complete joins, bounded collection and explicit observation times. A complete
  calendar week is not necessarily a complete source capture; incomplete current weeks
  must use an explicit as-of contract and neutral presentation.
- Exercise real PostgreSQL atomic publication, corrections, predecessor revisions,
  identity/config changes and rollback. Keep old human-only ticket keys guarded.
- Pass exact CI/build, isolated synthetic Preview, fresh encrypted backup/restore,
  scoped canary and independent readback before production widening.
- Verify UI/history/export consistency and genuine scheduled runs, including recovery.
  Manual collection must never be recorded as scheduler evidence.

## October 7 implementation increment

The resumable report-event stream now passes exact Linux CI/build **37660654108**
at **d4797f2** (1,083 tests / 135 files). It retains minimized immutable events and
continuations atomically, prevents concurrent/stale collectors, preserves Retry-After
across handoffs and limits each invocation. It does not activate any collection or
publication policy. Offline PostgreSQL replay reproduces all 23 current Menufy staff's
counts and contributing sets from the retained source; see
[the replay receipt](2026-10-07-report-event-replay-verification.json).

The follow-up joins the durable stream to freshly resolved staff and ticket/metric
parents, requires explicit deletion evidence and uses exact local week boundaries
through DST. Its solved-only adapter preserves the oldest dependency's observation
time and current-week watermark, rejecting stale/incomplete sources before publication.
This remains inactive pending final technical and release gates. It does not qualify
update counts, modify CSAT/first-reply policy or change the legacy human-only guards.

`zendesk-solved-publication-record.ts`, `zendesk-solved-report-bindings.ts` and
`zendesk-solved-publisher.ts` connect the two distinct solved calculations to the existing
atomic sync service. They publish only their new solved key, replay minimized source
evidence, bind organization/source/account/team/employee/period, require effective
compatible assignments, and reject stale or incomplete captures. The publication
transaction rechecks assignments and staff bindings and rejects changed fetched records.
Dedicated authenticated routes and separate strict policies now exist; absent production
policies keep them inactive. Legacy human-only keys, update counts, targets and existing
source policies are unchanged. PR45's live code does not establish numeric publication.

Local synthetic PostgreSQL checks cover publication, repeat-refresh idempotency, numeric
zero corrections, revision retention, failed-coverage preservation, incompatible
assignment rollback, staff departure, record tampering and observation expiry. These
tests are implementation evidence, not production activation or source qualification.
Exact code commit `0993446` passes Linux CI/build `37650598578`, including migrations
and all 1,049 tests. Draft PR45 is the review boundary; it remains unmerged and inactive.

### Current-week follow-through

The follow-up adds explicit as-of coverage, cutoff-preserving provenance/source
descriptions and a bounded GET-only POS collector connected to the same publisher.
Fresh source collection on October 7 resolves all 39 current staff and yields 654
solved tickets before 16:26:38 UTC from 833 padded source tickets. Independent Python
matches every employee count and contributing ID. See
[the aggregate receipt](2026-10-07-pos-current-solved-verification.json).
All 1,060 local tests pass, including preservation of closed-week values during current
publication. No live values, assignments, policy or schedule changed.

The search cutoff is a reporting exclusion boundary, not a guarantee of instantaneous
source indexing. Zendesk documents that [search indexing can take a few minutes](https://developer.zendesk.com/api-reference/ticketing/ticket-management/search/).
The one-minute exclusion is not claimed to eliminate that delay. Ongoing collection
must refresh the selected period and preserve observation/cutoff evidence; live current
weeks remain progress views. A same-cutoff Explore comparison is not available for this
capture. Menufy's fresh event-stream capture is complete: 38 pages, 1,952 joined
parents, 14 source-confirmed deletions and zero unresolved joins. Independent Python
matches all 23 employee counts and contributing sets, including 1,527 solved credits
through October 7 16:30:07 UTC. The 5,617 update-event IDs have implementation parity
only; their report qualification remains unresolved. See
[the aggregate receipt](2026-10-07-menufy-current-ticket-verification.json).

Exact runtime `42e477b` passes CI/build `37652865585`. Runtime-identical synthetic
Preview `5184d74` is READY (`dpl_5yWoab2m7S8bynprjH9fy62brVri`); its guarded rehearsal
publishes both solved definitions for closed/current weeks, including a numeric zero,
and preserves all unrelated values. Hosted UI/export checks and qualified ongoing
collection still need completion before activation, alongside catalog/release checks.

Follow-up `3224a70` passes exact CI/build `37655992624` (1,062 tests / 132 files).
Runtime-identical Preview `45cf3a4` verifies real synthetic publication through the sync
service, closed/current history, zero values, neutral current status and withheld
incompatible targets. Actual CSV, PDF and PNG were downloaded; the visual exports now
retain concise ticket-credit attribution and current cutoffs, and PDF/PNG pixels match.
See [the hosted receipt](2026-10-07-solved-preview-verification.json). Native print and
clipboard bytes remain unverified. Qualified ongoing Menufy collection, production
catalog/canary/recovery and genuine scheduling are still required.

### Existing first-reply scheduled operation

The October 7 current-week Menufy first-reply invocation is confirmed as
`vercel-cron/1.0`, HTTP 200 on production release `7fa4593`, with a 60.255-second
database run, zero errors and 23 current-period observations. Nineteen have numeric
means from 588 duration samples; four have zero samples across 12 cohort tickets and
correctly remain unavailable. Source/fact/value predecessor revisions exist for all
23. See [the scheduler receipt](2026-10-07-first-reply-scheduled-verification.json).
Other offsets/families and POS qualification remain open; this does not certify them.
