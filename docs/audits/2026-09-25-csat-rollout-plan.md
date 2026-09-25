# CSAT rollout plan after source qualification

No production activation has occurred. This plan replaces the assumption that another
collector can simply be appended to the existing scheduled sync.

## Qualified source behavior

- POS: all 39 active employee identities, 20 groups and one brand. A complete 38-request
  read collected 1,896 padded tickets and metric sets in 56.781 seconds. The local solved
  cohort contains 1,563 tickets. All 101 good / 4 bad ticket IDs match the previously
  reconciled closed-week export. The additional three active identities have no ratings.
  The 1,107 offered/rated denominator matches an independent calculation, but POS response
  rate has no report/assignment qualification and must not be published for that team.
- Menufy: a second complete 116-request read took 113.860 seconds and again returned
  5,764 padded tickets/metric sets. The 27-identity scope combines all 23 active employees
  and the report's historical identities. All 4,357 cohort IDs, 60 good, 13 bad and 1,823
  offered/rated ticket sets match the previous complete observation. Four additional
  active identities have no cohort tickets. An initial comparison used the older
  rated/offered-only reference as a full-cohort baseline; its 22 cohort differences were
  population mismatch, not source changes. Repeating against the complete prior live
  population yields zero differences.
- A complete staff-only census resolves all 62 active Cadence identities in four requests
  and 3.630 seconds, avoiding 62 individual lookups. Exact active, unsuspended agent/admin
  email matches are required. This is current-assignee identity evidence, not verification
  that a person authored a ticket action.

## Scheduling decision

Existing production sync invocations took 195–235 seconds. The qualified CSAT reads add
about 174 seconds including staff lookup. Appending them sequentially exceeds the current
300-second function budget. Do not enable that composition or assume parallel requests
will remain below vendor limits.

Use a separate CSAT-only invocation for one reporting week, sharing the existing source
lease and atomic publisher. Enforce a global request ceiling and a 240-second fetch
deadline, leaving time for publication and failure reporting. A failed or incomplete
collection publishes no values. Keep the normal collector from writing CSAT for periods
owned by the replacement policy, including manual refresh paths.

The complete two-team invocation is now qualified: 152 GETs, 146.427 seconds, 62 employees
and 85 facts with zero independent or prior-observation differences. Before enabling
recurring execution, qualify synthetic hosted publication. Proposed daily windows are 08, 10, 12 and 14 UTC for offsets 0–3.
Two-hour spacing accommodates the plan's hourly scheduling precision and the existing
five-minute source cooldown; these windows are separate from the current 06:00–06:45
configured sync slots. No new cron entries are enabled in this checkpoint. A failed cron
is not automatically retried by Vercel, so failure/freshness evidence and recovery remain
part of the release gate.

References: [Vercel cron scheduling and limits](https://vercel.com/docs/cron-jobs/usage-and-pricing),
[function duration](https://vercel.com/docs/functions/configuring-functions/duration),
[cron failures and rollback behavior](https://vercel.com/docs/cron-jobs/manage-cron-jobs),
[Zendesk staff role filters and cursor pagination](https://developer.zendesk.com/api-reference/ticketing/users/users/).

## Policy and release order

1. Validate explicit source UUID, organization UUID, Zendesk account reference, timezone,
   Sunday cutover and unique per-team group/brand IDs. Select score only for POS and the
   qualified score/response metrics for Menufy. No missing binding may become an all-account
   query. The pure policy parser and identity census are implemented; they do not activate
   collection. Private numeric bindings remain outside Git.
2. Start the prospective contract at the reviewed current-week boundary, preserving earlier
   periods under their existing definition. Do not activate historical repair. Freeze the
   new calculation version independently of later definition-row edits. Keep source-scope
   fingerprints and original revisions. Existing targets remain withheld until qualified.
3. Implemented and locally tested: the bounded collector plus consistent ownership gating in every legacy
   entry point. Check deadlines, missing identities, source failures, concurrent attempts,
   null corrections, correct versions, and no fallback to legacy CSAT after cutover.
4. Qualify a complete read-only invocation and hosted synthetic publication, including
   screen/history/export values and actual exported bytes. Stage only synthetic records.
5. Obtain a fresh backup and exact restore rehearsal including migration 0015; drain active
   publishers, widen the two numeric columns with bounded lock waits, then enable the
   reviewed policy and schedule. Validate actual publication and later scheduled evidence
   separately. Update the certification ledger only after those results exist.
6. Roll back application/policy and cron ownership together. Vercel instant rollback does
   not revert cron schedules. Retain compatible widened columns and revisions; never
   restore an older database over intervening writes as a routine rollback.

The remaining call, first-reply, effort and verified-human-action contracts remain separate
release work. A successful CSAT source qualification is not certification of all 40 assigned
team metrics.
