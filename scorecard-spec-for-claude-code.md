# Scorecard Targets & Admin Controls — Spec for Claude Code

Three changes bundled together because they touch the same part of the app:

- **A.** Load new Restaurant / Consumer target values into the scorecard config
- **B.** Add a bulk "hide this row across every scorecard under a manager" control
- **C.** Require every target/visibility edit to declare its scope: Menufy, POS, or Both

---

## 1. Open questions to resolve first (don't guess on these)

**Q1 — Brand scope mapping. ✅ RESOLVED.** This chart is Menufy-only. "Restaurant" and "Consumer" are Menufy's two lines (Menufy Restaurant + Menufy Consumer). POS is a separate brand with its own target chart, not covered by this doc. Task C below has been updated to a two-tier scope model to reflect this.

**Q2 — "Declined calls (filter out ##caller name)." ✅ RESOLVED.** In Zendesk, abusive callers, bots, and scammers get their caller-name field notated with a marker like `##callername##` instead of a real name/caller ID. The filter excludes any call whose caller-name field carries that marker before counting toward the Declined Calls metric — declining a flagged abuser/bot/scammer is correct behavior and shouldn't count against the target of 0. Claude Code should still confirm the exact literal pattern (is it always double-hash on both sides, or are there variant tags?) by inspecting real flagged records in the data source, since I'm describing the convention, not the exact regex.

**Q3 — Range semantics.** For metrics with a min–max band (Tickets Solved, IB Calls, OB Calls) — does "On Track" mean the actual value must fall *within* the range? What happens if actual is above the max — still on track, or flagged? Same question below the min.

**Q4 — Direction on point-value metrics.** For thresholds like Avg Response Time = 60 mins or Avg Hold = 120 sec, confirm these are *ceilings* ("must be at or under"), not targets to hit exactly. Flagged per-metric with my best guess in the JSON below — please correct any that are wrong before Claude Code encodes the pass/fail logic.

**Q5 — Section labels.** I inferred section names (Volume / Efficiency / Quality / Inbound Call Metrics / Outbound Call Metrics) from blank divider rows in the sheet, matched to your existing scorecard's categories. Confirm this mapping is right.

---

## 2. Parsed target data

Schema: each metric has a `restaurant` and `consumer` block. `target: null` = N/T (show row, no target). `visible: false` = N/A (hide row). `direction` is my best guess — see Q3/Q4 above.

```json
[
  {
    "metric_key": "tickets_solved",
    "label": "Tickets Solved",
    "section": "volume",
    "direction": "range",
    "restaurant": { "visible": true, "target": { "type": "range", "min": 75, "max": 128 } },
    "consumer":   { "visible": true, "target": { "type": "range", "min": 282, "max": 443 } }
  },
  {
    "metric_key": "tickets_updated",
    "label": "Tickets Updated",
    "section": "volume",
    "direction": "informational",
    "restaurant": { "visible": true, "target": null },
    "consumer":   { "visible": true, "target": null }
  },
  {
    "metric_key": "worked_elevated_tickets",
    "label": "Worked Elevated Tickets",
    "section": "volume",
    "direction": "informational",
    "restaurant": { "visible": false, "target": null },
    "consumer":   { "visible": false, "target": null }
  },
  {
    "metric_key": "avoidable_worked_elevated_tickets",
    "label": "Avoidable Worked Elevated Tickets",
    "section": "volume",
    "direction": "informational",
    "restaurant": { "visible": false, "target": null },
    "consumer":   { "visible": false, "target": null }
  },
  {
    "metric_key": "avg_response_time_ticket",
    "label": "Avg Response Time (ticket)",
    "section": "efficiency",
    "direction": "lower_is_better",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "minutes", "value": 60 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "minutes", "value": 60 } }
  },
  {
    "metric_key": "csat_score",
    "label": "CSAT Score",
    "section": "quality",
    "direction": "higher_is_better",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "percent", "value": 70 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "percent", "value": 50 } }
  },
  {
    "metric_key": "csat_response_rate",
    "label": "CSAT Response Rate",
    "section": "quality",
    "direction": "higher_is_better",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "percent", "value": 15 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "percent", "value": 15 } }
  },
  {
    "metric_key": "ib_calls",
    "label": "IB Calls",
    "section": "inbound",
    "direction": "range",
    "restaurant": { "visible": true, "target": { "type": "range", "min": 52, "max": 72 } },
    "consumer":   { "visible": true, "target": { "type": "range", "min": 30, "max": 52 } }
  },
  {
    "metric_key": "missed_calls",
    "label": "Missed Calls",
    "section": "inbound",
    "direction": "lower_is_better",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "count", "value": 0 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "count", "value": 0 } }
  },
  {
    "metric_key": "declined_calls",
    "label": "Declined Calls",
    "section": "inbound",
    "direction": "lower_is_better",
    "filter_note": "Exclude records where the caller-name field carries a '##callername##'-style marker — Zendesk's convention for flagging abusive callers, bots, or scammers. These are intentionally declined and should not count against the target of 0. Confirm exact literal pattern/variants against real flagged records before implementing the filter.",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "count", "value": 0 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "count", "value": 0 } }
  },
  {
    "metric_key": "abandoned_on_hold",
    "label": "Abandoned on Hold",
    "section": "inbound",
    "direction": "lower_is_better",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "count", "value": 0 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "count", "value": 0 } }
  },
  {
    "metric_key": "avg_talk_inbound",
    "label": "Avg Talk",
    "section": "inbound",
    "direction": "informational",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "seconds", "value": 300 } },
    "consumer":   { "visible": true, "target": null }
  },
  {
    "metric_key": "avg_hold_inbound",
    "label": "Avg Hold",
    "section": "inbound",
    "direction": "lower_is_better",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "seconds", "value": 120 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "seconds", "value": 120 } }
  },
  {
    "metric_key": "avg_duration_inbound",
    "label": "Avg Duration",
    "section": "inbound",
    "direction": "informational",
    "restaurant": { "visible": false, "target": null },
    "consumer":   { "visible": false, "target": null }
  },
  {
    "metric_key": "avg_consultation_inbound",
    "label": "Avg Consultation",
    "section": "inbound",
    "direction": "informational",
    "restaurant": { "visible": false, "target": null },
    "consumer":   { "visible": false, "target": null }
  },
  {
    "metric_key": "ob_calls",
    "label": "OB Calls",
    "section": "outbound",
    "direction": "range",
    "restaurant": { "visible": true, "target": { "type": "range", "min": 35, "max": 75 } },
    "consumer":   { "visible": true, "target": { "type": "range", "min": 75, "max": 112 } }
  },
  {
    "metric_key": "completed_ob",
    "label": "Completed OB",
    "section": "outbound",
    "direction": "informational",
    "restaurant": { "visible": false, "target": null },
    "consumer":   { "visible": false, "target": null }
  },
  {
    "metric_key": "non_answered_ob",
    "label": "Non-answered OB",
    "section": "outbound",
    "direction": "informational",
    "restaurant": { "visible": false, "target": null },
    "consumer":   { "visible": false, "target": null }
  },
  {
    "metric_key": "avg_talk_outbound",
    "label": "Avg Talk",
    "section": "outbound",
    "direction": "informational",
    "restaurant": { "visible": true, "target": null },
    "consumer":   { "visible": true, "target": null }
  },
  {
    "metric_key": "avg_hold_outbound",
    "label": "Avg Hold",
    "section": "outbound",
    "direction": "lower_is_better",
    "restaurant": { "visible": true, "target": { "type": "threshold", "unit": "seconds", "value": 120 } },
    "consumer":   { "visible": true, "target": { "type": "threshold", "unit": "seconds", "value": 120 } }
  }
]
```

---

## 3. Task A — Load target config

1. Find wherever the scorecard currently stores per-metric targets (config file, DB table, or hardcoded in the rendering component — Claude Code should locate this first rather than assume a path).
2. Reconcile the existing schema against the JSON above. If the existing schema doesn't support ranges, thresholds, and a separate `visible` flag, extend it rather than bolting values onto the old shape.
3. Load the values above, resolving Q1–Q5 first where they affect correctness (especially Q3/Q4 — don't let Claude Code silently invent pass/fail logic for ranges and thresholds).
4. Existing "Status" logic (On Track / No Target / No Data, as seen on the live scorecard) needs to read from this new config rather than any old hardcoded targets.

---

## 4. Task B — Bulk hide/show rows across a manager's scorecards

**Requirement:** an admin should be able to hide (or unhide) a metric row once and have it apply to every scorecard under a given manager, instead of toggling it scorecard-by-scorecard.

**Suggested data model** — three-tier precedence, most specific wins:

- `global_default`: visible/hidden per `(brand, metric_key)`
- `manager_override`: visible/hidden per `(manager_id, brand, metric_key)`
- `scorecard_override`: visible/hidden per `(scorecard_id, brand, metric_key)` — for one-off exceptions

Resolved visibility for any given scorecard = scorecard_override, if one exists → else manager_override → else global_default.

**Suggested UI/UX:**

- On each metric row in an admin/settings view, add a "Hide" toggle.
- Next to the toggle, a scope control: **"This scorecard only" / "All scorecards under [Manager Name]" / "Global default"** — default selection should be the narrowest scope ("this scorecard only") so nobody bulk-hides something by accident.
- When "All scorecards under [Manager]" is chosen, show a confirmation modal naming the manager and the count of scorecards affected before committing.
- Keep an audit trail (who changed visibility, at what scope, when) — this is the kind of change someone will need to trace back later.

---

## 5. Task C — Brand scope on every target/visibility edit (Menufy / POS / Both)

**Requirement:** any time someone edits a target value or a row's visibility, they must explicitly pick which brand(s) it applies to, so changes don't silently leak across brand configs or silently apply to only one line when the intent was both.

**Confirmed structure (Q1 resolved):** Menufy has two sub-lines (Restaurant, Consumer) that can be targeted independently or together. POS is a single line with no sub-lines. So this is a two-tier selection, not a flat three-way pick:

- **Top level (required):** `Menufy` / `POS` / `Both` (both brands)
- **Second level (required only when the top-level selection includes Menufy):** `Restaurant` / `Consumer` / `Both` (both Menufy lines)

Concretely: choosing `Menufy` + `Both` applies to Menufy Restaurant and Menufy Consumer. Choosing `Menufy` + `Restaurant` applies to just that line. Choosing `POS` skips the second-level question entirely, since POS has no sub-lines. Choosing top-level `Both` (Menufy + POS together) still requires the second-level answer for the Menufy portion of that change.

**Suggested UI:** a required top-level radio group (`Menufy` / `POS` / `Both`) on any target/visibility edit form. When the selection includes Menufy, reveal a second required radio group (`Restaurant` / `Consumer` / `Both`) beneath it. Block save until every required level is answered — no silent default, and no way to save a Menufy-inclusive change without resolving which line(s) it hits.

**Data model implication:** target/visibility configs should be keyed at the sub-line level even for POS-style single-line brands (e.g. `pos` as its own key with no sibling), so the same lookup logic works for both a two-line brand and a one-line brand without special-casing.

---

## 6. Ready-to-paste prompt for Claude Code

> I'm updating our scorecard tool. First, find where scorecard metric targets and row visibility are currently defined (config file, DB schema, or component) and show me the current shape before changing anything.
>
> Then:
> 1. Load the target/visibility data in the JSON block under "Parsed target data" in this doc, reconciling it with the existing schema (extend the schema if it can't represent ranges, thresholds, and per-row visibility yet).
> 2. Add a bulk hide/show control per the "Task B" spec — three-tier precedence (global default → manager override → scorecard override), with a scope selector defaulting to the narrowest option and a confirmation step before a manager-wide change is applied.
> 3. Add the two-tier scope selector from "Task C" to any target or visibility edit: top-level Menufy/POS/Both, with a required second-level Restaurant/Consumer/Both choice whenever the top-level selection includes Menufy. POS has no sub-lines, so it skips the second level. Block save until all required levels are answered.
> 4. For the Declined Calls filter, look at real Zendesk records for the `##callername##`-style marker used to flag abusive callers/bots/scammers and confirm the exact literal pattern before writing the filter — don't hardcode the literal string from this doc without checking real data first.
>
> Don't guess on pass/fail logic for range or threshold metrics — ask me if the direction (lower/higher-is-better) or range semantics aren't obvious from existing code.
