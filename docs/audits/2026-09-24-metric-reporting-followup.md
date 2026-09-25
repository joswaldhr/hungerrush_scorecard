# POS and Menufy metric reporting follow-up

The user reported incorrect-looking production scorecards after the core release. This
follow-up does not certify independent parity for every metric. The core release established
publication and application reliability, not correctness of every business definition.

## Read-only findings (September 25 UTC)

- All 62 active employees have Zendesk identity mappings: 39 POS and 23 Menufy. No duplicate
  employee/source identity groups were found. Current-week stored metric values had no
  mismatch between their team and the employee's current primary team.
- Both teams had all three current-week source summaries observed at 02:16 UTC, with
  retained source evidence. This incident is not explained by an absent team-wide sync.
- A targeted vendor re-read of 131 ticket metric sets (three GET requests, no writes)
  reproduced the duration summaries under the existing exclusion rule. The rule incorrectly
  treats a reported zero business duration as missing whenever calendar duration is positive.
  This drops samples and biases means upward. Null durations must remain missing; reported
  zero durations must contribute to both the sum and denominator.
- The selected Menufy first-reply average is a ticket-cohort measurement, not every reply
  performed by that employee. POS's `avg_handle_time` is full-resolution business elapsed
  time, not active handling effort. These semantic issues remain independent of the zero fix.
- Call metrics use whole-call `agent_id` attribution, not every agent's participation in
  transferred calls. Existing missed/declined assignments have no active historical producer.
- A separate read-only current-week probe completed 8 call pages and 14 leg pages in 24
  vendor GETs including two exact employee-account lookups. For the Menufy sample, 4 whole
  inbound calls were attributed to the employee, versus 8 distinct inbound calls with a
  completed agent leg. The POS sample had 19 versus 20 inbound and 15 versus 16 outbound.
  Both samples had zero unmatched leg call IDs. This confirms a grain/attribution mismatch;
  it does not define offers, transferred-call target bands, or all-team historical eligibility.
  The week was still in progress. No calls/legs were published by the probe.
- CSAT response rate has no verified survey-invitation denominator. CSAT score is a different
  measure and can be based on a single good/bad rating.

Vendor definitions: [ticket metrics](https://developer.zendesk.com/api-reference/ticketing/tickets/ticket_metrics/),
[business-hour metrics](https://support.zendesk.com/hc/en-us/articles/5654110765338-How-does-Zendesk-record-its-business-hour-metrics),
[call and leg exports](https://developer.zendesk.com/api-reference/voice/talk-api/incremental_exports/).

## Correction

The connector now includes reported business zeros and rejects malformed negative/nonfinite
durations. Newly fetched ticket summaries record `durationPolicy: include_reported_business_zero`
in source evidence. This is a correction to the existing business-minute average, not a
switch to calendar time or a new handling-effort definition. Normal refreshes retain
predecessor source/fact/value revisions using the existing atomic publication path. There
is no database migration, target adjustment, bulk historical repair, or direct metric edit.

Scorecards and CSV/text/captured exports now explain the actual source measurements and
why unsupported metrics are blank. POS handle time has an always-visible warning that its
source measures resolution elapsed time. Source-specific descriptions do not apply to
manual or other vendors' same-named metrics. Existing ticket human-attribution containment
remains in force. Descriptions do not resolve call-grain or target-definition mismatches.

## Remaining work

Local validation: 559 tests across 65 files passed against isolated PostgreSQL, including
zero-duration source evidence, unsupported query states, rendered reasons and export context.
TypeScript and lint/format checks passed. Hosted release verification is recorded separately.

Reconcile employee participation using agent legs joined to calls, with explicit direction,
transfer and distinct-call eligibility. Validate intended POS/Menufy report cohorts and
target applicability against the reports the managers actually use. Verify survey invitation
coverage before producing response rate. Complete verified human activity attribution before
publishing Tickets Updated/Resolved. Do not label successful tests as business parity.

## Duration and readability plan

The user specifically requested consistent time measurement and aligned columns.

1. Use `H:MM:SS` for every supported duration on scorecards, comparison periods, targets,
   stored history and CSV/text/PDF/image exports. Convert minutes/hours/seconds only at the
   formatting boundary. Round to the nearest second, preserve zero, and never wrap at 24h.
   Counts and percentages retain their own formats. Unknown duration units remain explicit
   rather than being guessed. Export metadata declares the display format.
2. Keep business time distinct from elapsed time: ticket first reply/full resolution use the
   Zendesk business-minute measurements; calls use elapsed duration. Do not multiply a target
   in storage or change a period/timezone to make a displayed number look better.
3. Disclose the current full-resolution-versus-handling mismatch and the first-reply cohort.
   The user-visible time standard is a readability correction, not certification of the
   underlying cohort, employee attribution or handling-effort target.
4. Give each category the same five fixed column widths, with horizontal scrolling on narrow
   screens. Long metric names and explanations must wrap without moving the numeric columns.
5. Verify boundary rounding, equivalent units, values over 24 hours, actual/prior/target parity
   and exported units. Visually inspect the hosted scorecard at desktop and narrow widths.

Tickets Resolved remains blocked by the selected verified-human policy; it is not missing
because of the duration formatter or a failed employee sync. Source-based action publication
must resolve that separately. Call attribution needs its own correction as established above.
