"""Offline, independent outbound reconciliation. No environment, DB or network access.

python scripts/verify_retained_outbound.py --manifest /private/manifest.json
Manifest paths: candidates, snapshot, tickets, optional reportChecks. Snapshot may
wrap its calls/legs in `snapshot`; candidates uses the qualification `cases` shape.
reportChecks uses retained {employeeId, column, expected} rows. Only aggregate
evidence goes to stdout. Source files and any discrepancies remain private.
"""

import argparse
import hashlib
import json
import math
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo


def require(condition, code):
    if not condition:
        raise ValueError(code)


def keyed(rows):
    result = {}
    for row in rows:
        key = row["id"]
        require(type(key) is int and 0 < key <= 2**53 - 1 and key not in result, "invalid_or_duplicate_source_id")
        result[key] = row
    return result


def seconds(value):
    require(value is None or (type(value) in (int, float) and math.isfinite(value) and value >= 0),
            "invalid_duration")
    return value


def timestamp(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.tzinfo is not None, "missing_source_timezone")
    return parsed


def rebuild(calls, legs, tickets, scope):
    """Independent source-set reconstruction; does not import app calculation code."""
    start, end = date.fromisoformat(scope["periodStart"]), date.fromisoformat(scope["periodEnd"])
    require(0 <= (end - start).days <= 31, "invalid_period")
    zone = ZoneInfo(scope["timeZone"])
    groups = set(scope["ticketGroupIds"])
    require(groups and len(groups) == len(scope["ticketGroupIds"]), "invalid_group_scope")
    require(all(type(value) is int and 0 < value <= 2**53 - 1 for value in [scope["agentId"], *groups]),
            "invalid_identity_or_group_scope")
    by_call, by_ticket, by_leg = keyed(calls), keyed(tickets), keyed(legs)
    cohort = {}
    for call in by_call.values():
        created = timestamp(call["created_at"])
        require(timestamp(call["updated_at"]) >= created, "invalid_call_chronology")
        if call["direction"] != "outbound" or not start <= created.astimezone(zone).date() <= end:
            continue
        if call["ticket_id"] is None:
            continue
        require(call["ticket_id"] in by_ticket, "missing_linked_ticket")
        if by_ticket[call["ticket_id"]]["group_id"] in groups:
            cohort[call["id"]] = call
    selected = []
    for leg in by_leg.values():
        require(timestamp(leg["updated_at"]) >= timestamp(leg["created_at"]), "invalid_leg_chronology")
        if leg["agent_id"] != scope["agentId"] or leg["type"] not in ("agent", "supervisor"):
            continue
        require(leg["call_id"] in by_call, "missing_parent_call")
        if leg["call_id"] in cohort:
            selected.append(leg)
    attempted = sorted({leg["call_id"] for leg in selected})
    categories = {name: [] for name in ("completed", "nonAnswered", "abandonedOnHold", "unclassified")}
    for call_id in attempted:
        call = cohort[call_id]
        talk = seconds(call["talk_time"])
        require(type(call["voicemail"]) is bool, "invalid_voicemail_flag")
        status = call["completion_status"]
        category = "unclassified"
        if status == "abandoned_on_hold":
            category = "abandonedOnHold"
        elif status == "failed" and talk in (None, 0):
            category = "nonAnswered"
        elif status == "completed" and talk is not None:
            if talk > 0:
                category = "completed"
            elif not call["voicemail"]:
                category = "nonAnswered"
        categories[category].append(call_id)
    result = {"attemptedCallIds": attempted, "selectedLegIds": sorted(leg["id"] for leg in selected),
              "attempted": len(attempted)}
    result.update({name + "CallIds": values for name, values in categories.items()})
    for name in ("completed", "nonAnswered"):
        result[name] = None if categories["unclassified"] else len(categories[name])
    for name in ("talk", "hold"):
        field = name + "_time"
        measured = [leg for leg in selected if seconds(leg[field]) is not None]
        total = sum(leg[field] for leg in measured)
        require(math.isfinite(total), "duration_overflow")
        result[name] = {
            "sumSeconds": total, "sampleCount": len(measured),
            "meanSeconds": total / len(measured) if measured else None,
            "measuredLegIds": sorted(leg["id"] for leg in measured),
            "missingLegIds": sorted(leg["id"] for leg in selected if leg[field] is None),
            "zeroLegIds": sorted(leg["id"] for leg in measured if leg[field] == 0),
        }
    return result


def verify(candidates, snapshot, tickets, report_checks=()):
    cases = candidates["cases"]
    require(cases, "empty_candidate_cohort")
    employees = {}
    values, sets, durations = 0, 0, 0
    for case in cases:
        employee = case["employeeId"]
        require(employee not in employees and case.get("record"), "duplicate_or_unqualified_candidate")
        result = rebuild(snapshot["calls"], snapshot["legs"], tickets, case["scope"])
        for key, expected in result.items():
            require(key in case["result"] and case["result"][key] == expected, "candidate_source_replay_mismatch")
        evidence = case["record"]["payload"]["sourceEvidence"]
        require(case["record"]["payload"]["employeeContext"]["employeeId"] == employee,
                "record_employee_mismatch")
        require(all(evidence["scope"].get(k) == v for k, v in case["scope"].items() if k != "accountReference"),
                "record_scope_mismatch")
        if "accountReference" in case["scope"]:
            require(evidence["accountReference"] == case["scope"]["accountReference"], "record_account_mismatch")
        require(sorted(keyed(evidence["calls"])) == result["attemptedCallIds"], "record_call_set_mismatch")
        require(sorted(keyed(evidence["legs"])) == result["selectedLegIds"], "record_leg_set_mismatch")
        require(set(keyed(evidence["tickets"])) == {call["ticket_id"] for call in evidence["calls"]},
                "record_ticket_set_mismatch")
        # Compare retained record contents, not only their IDs. Same IDs with changed
        # durations, parents or group observations must not pass qualification.
        for kind, source in (("calls", snapshot["calls"]), ("legs", snapshot["legs"]), ("tickets", tickets)):
            original = keyed(source)
            for row in evidence[kind]:
                # The record intentionally removes line numbers and call-group IDs;
                # this contract uses linked-ticket groups, never call-group scope.
                omitted = {"phone_number", "call_group_id"} if kind == "calls" else set()
                require(all(row.get(k) is None for k in omitted), "record_retains_unneeded_call_metadata")
                require(row["id"] in original and all(original[row["id"]].get(k) == v for k, v in row.items() if k not in omitted),
                        "record_source_content_mismatch")
        employees[employee] = result
        values += 5
        sets += 14
        durations += 6
    seen, mismatches = set(), set()
    difference_count = 0
    for check in report_checks:
        key = (check["employeeId"], check["column"])
        require(key not in seen and key[0] in employees, "duplicate_or_unmapped_report_cell")
        seen.add(key)
        r = employees[key[0]]
        columns = {"Outbound calls": r["attempted"], "Completed outbound calls": r["completed"],
                   "Non-answered outbound calls": r["nonAnswered"], "Leg talk time / seconds": r["talk"]["sumSeconds"],
                   "Leg hold time / seconds": r["hold"]["sumSeconds"], "Total": r["attempted"],
                   "Complete": r["completed"], "NA": r["nonAnswered"], "Talk": r["talk"]["sumSeconds"]}
        require(key[1] in columns, "unknown_report_column")
        expected = check["expected"]
        seconds(expected)
        if columns[key[1]] != expected:
            difference_count += 1
            mismatches.add(key[0])
    return {"employees": len(employees), "independentValueChecks": values,
            "sourceSetChecks": sets, "durationNumeratorDenominatorMeanChecks": durations,
            "sourceReplayDifferences": 0, "reportCellsCompared": len(seen),
            "reportEmployeesCompared": len({key[0] for key in seen}),
            "reportCellDifferences": difference_count, "reportEmployeeDifferences": len(mismatches),
            "reportContributingIdsVerified": False, "sourceFreshnessVerified": False,
            "publicationAuthorized": False, "vendorRequests": 0, "databaseWrites": 0}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8-sig"))
        inputs, digests = {}, {}
        for name in ("candidates", "snapshot", "tickets", "reportChecks"):
            if name not in manifest:
                require(name == "reportChecks", "missing_input")
                continue
            path = Path(manifest[name])
            if not path.is_absolute():
                path = args.manifest.parent / path
            raw = path.read_bytes()
            digests[name] = hashlib.sha256(raw).hexdigest()
            inputs[name] = json.loads(raw.decode("utf-8-sig"))
        snapshot = inputs["snapshot"].get("snapshot", inputs["snapshot"])
        result = verify(inputs["candidates"], snapshot, inputs["tickets"]["tickets"], inputs.get("reportChecks", []))
        result["inputSha256"] = digests
        print(json.dumps(result, indent=2, allow_nan=False))
        return 0
    except Exception:
        # Never echo paths, employee IDs, source rows or parser contents to logs.
        print(json.dumps({"verified": False, "error": "retained_evidence_verification_failed"}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
