# POS source report scope review — October 6

Agent sign-in restores Explore access. Existing definition inspection occurs one report
at a time without formula, filter, date, aggregation or layout changes. No Apply/Save is
used. All three temporary definition tabs are closed, and the user-owned tab returns to
the original shared-dashboard listing. Private report identifiers, names, group bindings
and source data remain outside Git.

## Older retained employee report

The report name matches the retained September 25 inbound CSV. Its saved definition has
ten metrics, including the eight previously compared, leg-agent rows, and seven filters
including leg date, agent role/status, leg type/status, call group and direction.
All 18 selected group labels are read from rendered checked states. Exact retained
deleted-inclusive census matching resolves 14 labels. Exact group-audit rename transitions
resolve the other four, including one multi-step name lineage. Each label resolves to one
group ID present in the retained census. The 18 labels represent 17 distinct IDs because
one old/new-name pair is an alias; three IDs supplement the original known 14.

This resolves the four unknown labels; it does not prove report/source populations are
equivalent. Replaying the retained September 13–19 export with all 17 IDs matches 45 of
55 rows across eight measures; ten rows differ. Count and duration mismatches remain
unexplained. Preserve the old export/input and its 14-group pass as conditional evidence;
do not overwrite it, call the wider comparison passed, or infer the report changed.
See the group binding and expanded export comparison aggregates.

Next compare an unmodified report export under its explicitly observed saved dates and
all saved filters, with a separately complete/fresh bounded source capture and independent
source sets. Establish historical group-name/ID semantics and role/status eligibility;
do not silently substitute current identities or targets. No producer is activated.

## Dashboard-linked offered-call report is a separate contract

The POS Support Audit dashboard's inbound report contains one SUM offered metric, seven
selected groups and call-created date, with leg-agent rows and Central reporting time.
All seven group names bind uniquely in the retained census; two groups are deleted and
must not silently disappear. Its saved formula is the sum of distinct completed inbound
calls, voicemail calls and abandoned calls. The formula is read without editing and its
calculation Save control is disabled. Direction selection remains unverified.

This differs from the older 18-label leg-date report and Menufy's outcome-leg subtotal.
According to the [official Voice metric definitions](https://support.zendesk.com/hc/en-us/articles/4409156145434-Metrics-and-attributes-for-Zendesk-Voice),
completed inbound calls can include voicemail, voicemail is a call-type condition, and
abandonment includes on-hold as well as IVR/queue/voicemail. Therefore component overlap
must be measured explicitly; unioning them or inheriting a leg-offer formula would change
the saved calculation. The tenant's underlying custom dataset/formulas still need source
parity; official defaults do not establish tenant equivalence.

No production database writes, vendor API requests, app deployment, policy activation,
employee changes or demo changes occur in this inspection/offline comparison. Zendesk
reports/dashboards/configuration remain untouched. Existing human-action and historical
repair guards remain disabled. Hosted print and actual clipboard checks remain separate.
