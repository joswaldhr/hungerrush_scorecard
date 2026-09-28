# Monday manager handoff

Target: September 28, 2026, before **3:00 p.m. America/Chicago** (20:00 UTC).
This is a readiness record, not a claim that every assigned metric is certified.

**14:51 UTC update:** PR32 is merged and production is READY on `670fe22` /
`dpl_EFzonruTEMUEzGazCkJFbU7YvVo1`. Master CI passed. Both manager views, current/previous
scorecards, history and actual production CSV bytes passed post-deployment checks.
Protected metric data, employee assignments, targets and environment settings are unchanged.
New metric publishers remain disabled; the activation/access requirements below still apply.

## Using the live app

Open [Cadence](https://hungerrush-scorecard.vercel.app/one-on-ones) and sign in with
the existing work account. Select an assigned employee. For the most recent complete
week, use **September 20–26**. September 27–October 3 is still in progress.

Times use **H:MM:SS**. Ticket first reply uses business time; call measures use elapsed
time. Open a metric's **Data details** to see its source definition, observation time,
sample coverage and any unavailable explanation. A dash does not mean zero. Export
uses the loaded employee and reporting period; stored reporting periods remain available.

## Verified as of the morning checkpoint

- The morning baseline was `8a0c4bd`; the deployment update above supersedes that application version.
- Existing administrator View-as paths list 23 Menufy and 39 POS employees.
- Current/previous scorecards load, five category tables align, duration labels are
  consistent, and current-week results carry the in-progress notice.
- A controlled recovery refreshed current-week CSAT: 62 source summaries / 85 values;
  all 85 independently match. Earlier periods and 13,813 unrelated metric rows are unchanged.
- The post-recovery page displays the new source observation time and explicit empty-survey
  reasons. The temporary manager view was exited and the administrator session restored.
- Earlier hosted synthetic current/history/revision and CSV/PDF/PNG checks passed.
  Those checks are distinct from a fresh production export by the receiving manager.

## Open handoff requirements

| Requirement | State and next action |
|---|---|
| Receiving manager's account | Work email requested; verify the existing active account and assigned scope when supplied. Administrator View-as does not prove their own sign-in. |
| New call-metric activation | PR32 code is deployed with the new publishers disabled. Hosted outbound rehearsal requires recovery of the existing staging database credential; source and scoped-publication gates still apply. |
| All assigned metrics accurate | Not complete. Human Tickets Updated/Resolved remain unavailable under the approved attribution policy. Other unqualified metrics retain the limitations in the metric acceptance ledger. |
| Recurring current-week CSAT rate limit | Today's recovery succeeded; the cause of the intermittent scheduled HTTP 429 remains unresolved. Do not describe the controlled recovery as scheduler certification. |
| First-reply freshness | Existing schedule includes current and previous weeks before the handoff deadline. Only actual observed executions can establish Monday success; no extra invocation is planned merely to create evidence. |

No Zendesk reports, dashboards, tickets, settings or permissions were changed. No editor
sessions were opened. New Talk/outbound policies, human-action shadow ingestion, action-v2
publication and historical repair remain inactive.

The [implementation ledger](2026-09-23-implementation-progress.md) owns subsequent updates;
the [metric acceptance ledger](2026-09-25-metric-acceptance-ledger.md) records the remaining
source and definition requirements.
