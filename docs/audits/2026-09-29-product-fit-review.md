# Product-fit and architecture critique

September 29, 2026. Review requested by the user. No vendor requests, report generation,
application feature changes, access changes or hosting migration were performed for this
review. Public vendor documentation and retained repository evidence were read. The private
Assembled timeline URL did not return inspectable content through the web reader; this is
not evidence of missing account access or absent data.

## Requirement, in the user's terms

Managers assemble employee metrics from Zendesk and Assembled before each 1:1, then
historically attach/paste their reports into Rippling. Cadence should automatically prepare
the accurate scorecard, accessible through Microsoft work-account login. Export is part
of that workflow, not authorization to move the product into Rippling or integrate its API.

## Verdict

Retain the standalone application, Microsoft sign-in and PostgreSQL. They support a
consistent employee/period experience, cross-source identity, permissions and history.
Vercel/Railway were reasonable delivery choices; changing their names does not fix missing
data, incorrect definitions or incomplete source sets. Choose eventual company hosting
for ownership and operational requirements, independently of metric qualification.

The main product gap is reliable replacement of the managers' full reporting process.
Prioritize that over broader meeting management, company-wide dashboards or another
visual expansion. A polished synthetic demonstration demonstrates presentation, not
production completeness or correctness. Honest unavailable values protect users but
still leave manual preparation work and do not satisfy the requirement.

## Verified Assembled gap

Production source capability code labels Assembled `retired`; the integration document
confirms its collector was removed. An environment variable, stored identity or one-off
credential check is not an operational integration.

The September 1 roster problem was superseded. The retained September 25 complete census
matched all 23 Menufy and 39 POS employees by exact email to nondeleted Assembled people,
with zero ambiguous matches. A limited effort sample exists. It explicitly leaves report
units, state exclusions and full numerator coverage unqualified. See
`2026-09-25-workforce-source-capability.json`; this is dated evidence, not a new live census.

Assembled publicly documents schedule events and asynchronously generated adherence
reports. Scheduled activity alone does not prove actual worked time or adherence. Its
report API can supply reference metrics, but account entitlement, settings, employee
scope and meaning must be verified for the specific scorecard. Report generation uses
POST followed by GET; do not describe that as a GET-only probe or initiate it incidentally.
[Assembled reporting documentation](https://support.assembled.com/hc/en-us/articles/44279534584973-Retrieving-Scheduled-Hours-Using-the-Assembled-API)

## Where the design needs stronger discipline

- Start with every column the two managers actually use. Map each to its meaning, vendor,
  saved report/filter, employee attribution, period, units, denominator and intended
  target. Do not build the scorecard around whichever fields an API happens to return.
- Use source-provided calculations when their documented semantics match the requirement
  and can be reconciled. Derive a value from events only when necessary and independently
  test the source sets. Do not silently recreate every vendor formula from scratch.
- Compare the managers' reports as evidence, not unquestionable truth. The retained
  September 28 review found SUM talk time and MAX hold time where Cadence wanted averages,
  and updater attribution that did not prove verified human activity. Matching the wrong
  population or aggregate cannot certify the intended metric.
- Reconcile all eligible employee/metric/period cases, including nulls, real zeros, shared
  work, transfers, reopened tickets, late source changes and period boundaries. Database
  self-consistency and unit tests are necessary but insufficient.
- Make reporting publication reliable before meetings: owned freshness deadlines,
  resumable bounded collection, shared leases/pacing, recovery and alerts. Avoid relying
  on the manager's page load or a manual sync to make a scorecard usable.
- Keep publication and source observation times distinct. Retain reviewed snapshots and
  show later corrections explicitly; a changing vendor report need not mean an earlier
  accurately labeled snapshot was wrong.

Vercel's Hobby cron currently permits daily schedules with hour-level timing; Pro has
minute-level scheduling. Function execution limits also apply to cron. Match hosting
and worker design to measured work and reporting deadlines; a platform migration alone
cannot establish source reliability. [Vercel scheduling limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

## Alternative worth benchmarking

Assembled already documents an agent scorecard. A short comparison using the managers'
exact required columns should establish whether existing vendor reports can supply a
complete approved pack. Do not assume vendor UI availability proves API availability,
cross-source semantics, export suitability or organization-specific coverage.
[Assembled agent scorecard](https://support.assembled.com/hc/en-us/articles/5156650607245-Understanding-the-Agent-Scorecard)

If the only output were a fixed weekly attachment, an automated report-generation pipeline
could be smaller than an interactive application. Cadence earns its ongoing maintenance
cost through unified source definitions, scoped access, person/week navigation, retained
history, explanation and consistent exports. Given the existing investment and stated
growth, retain the focused app while making that reporting foundation dependable; do not
rewrite it merely to change hosting or substitute an unqualified reporting tool.

## What the accuracy commitment can mean

Require zero unexplained differences for the approved definition and complete source
population at a recorded observation, and require all agreed report requirements to be
accounted for. An external outage, no eligible responses or evidence that never existed
cannot be solved by inventing a number. Detect and expose these states, recover where
possible, and distinguish a legitimate no-sample result from a missing integration.
Never promise that mutable external systems can remain available and unchanged forever.

The current acceptance ledger records 14/40 team assignments with verified production
arithmetic and 0/40 full contracts as its latest qualification checkpoint. This is neither
proof that every other value is wrong nor permission to claim complete reporting. Do not
shrink the denominator by dropping hard metrics. Identify any newly required Assembled
metrics separately and update the agreed inventory before expanding it.

## Recommended next work

1. Reconcile the complete current 1:1 report requirements for both managers against the
   existing acceptance inventory. Use retained reports and existing definitions first.
2. Prioritize a bounded Assembled qualification: current account/scope, identities, exact
   required metrics and compatible scheduled/actual time definitions. No inferred zeros.
3. Finish source-to-scorecard/history/export proof for each required metric family and
   preserve the approved verified-human policy until qualifying evidence exists.
4. Complete the main app's gated last-week/export release and dependable automatic refresh.
5. Have both managers use the real workflow for two weekly cycles; measure preparation
   time and require no manual reconstruction of the agreed reporting requirements.

Company hosting and later product expansion stay planned work. This review does not
authorize an incidental metric-policy change or any Zendesk editor/mutation.
