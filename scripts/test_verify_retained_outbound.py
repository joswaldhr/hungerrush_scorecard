"""Synthetic regressions for the independent retained-evidence verifier."""

import copy
import unittest

from verify_retained_outbound import rebuild, verify


def fixture():
    scope = {"periodStart": "2026-09-27", "periodEnd": "2026-10-03",
             "timeZone": "America/Chicago", "agentId": 7, "ticketGroupIds": [2]}
    call = {"id": 1, "created_at": "2026-09-27T05:00:00Z", "updated_at": "2026-09-27T06:00:00Z",
            "direction": "outbound", "ticket_id": 3, "completion_status": "completed",
            "talk_time": 30, "voicemail": False}
    leg = {"id": 4, "call_id": 1, "created_at": call["created_at"], "updated_at": call["updated_at"],
           "agent_id": 7, "type": "agent", "talk_time": 0, "hold_time": None}
    tickets = [{"id": 3, "group_id": 2}]
    return {"calls": [call], "legs": [leg]}, tickets, scope


def candidates(snapshot, tickets, scope):
    evidence = {**copy.deepcopy(snapshot), "tickets": copy.deepcopy(tickets), "scope": copy.deepcopy(scope)}
    return {"cases": [{"employeeId": "fictional-employee", "scope": scope,
                       "result": rebuild(snapshot["calls"], snapshot["legs"], tickets, scope),
                       "record": {"payload": {"employeeContext": {"employeeId": "fictional-employee"},
                                              "sourceEvidence": evidence}}}]}


class OutboundVerifierTests(unittest.TestCase):
    def test_zero_measured_leg_and_missing_leg_duration_are_distinct(self):
        s, tickets, scope = fixture()
        r = rebuild(s["calls"], s["legs"], tickets, scope)
        self.assertEqual(r["talk"], {"sumSeconds": 0, "sampleCount": 1, "meanSeconds": 0,
                                      "measuredLegIds": [4], "missingLegIds": [], "zeroLegIds": [4]})
        self.assertIsNone(r["hold"]["meanSeconds"])
        self.assertEqual(r["completed"], 1)  # Classification uses call talk, not leg talk.

    def test_group_observation_exclusion_and_local_period_boundary(self):
        s, tickets, scope = fixture()
        for time, group in [("2026-09-27T04:59:59Z", 2), ("2026-09-27T05:00:00Z", 9)]:
            s["calls"][0]["created_at"] = time
            tickets[0]["group_id"] = group
            self.assertEqual(rebuild(s["calls"], s["legs"], tickets, scope)["attempted"], 0)
        s["calls"][0]["created_at"] = "2026-10-04T04:59:59Z"
        s["calls"][0]["updated_at"] = "2026-10-04T05:00:00Z"
        tickets[0]["group_id"] = 2
        self.assertEqual(rebuild(s["calls"], s["legs"], tickets, scope)["attempted"], 1)

    def test_multiple_legs_count_one_call_but_two_duration_samples(self):
        s, tickets, scope = fixture()
        s["legs"].append({**s["legs"][0], "id": 5, "talk_time": 10})
        r = rebuild(s["calls"], s["legs"], tickets, scope)
        self.assertEqual(r["attempted"], 1)
        self.assertEqual(r["talk"]["sampleCount"], 2)
        self.assertEqual(r["talk"]["meanSeconds"], 5)

    def test_unknown_completion_is_unavailable_not_zero(self):
        s, tickets, scope = fixture()
        s["calls"][0]["talk_time"] = None
        r = rebuild(s["calls"], s["legs"], tickets, scope)
        self.assertIsNone(r["completed"])
        self.assertIsNone(r["nonAnswered"])
        self.assertEqual(r["unclassifiedCallIds"], [1])

    def test_missing_parent_or_ticket_and_duplicate_sources_fail(self):
        s, tickets, scope = fixture()
        for calls, legs, ts in [([], s["legs"], tickets), (s["calls"], s["legs"], []),
                                (s["calls"] * 2, s["legs"], tickets),
                                (s["calls"], s["legs"] * 2, tickets),
                                (s["calls"], s["legs"], tickets * 2)]:
            with self.assertRaises(ValueError):
                rebuild(calls, legs, ts, scope)

    def test_invalid_duration_is_rejected(self):
        s, tickets, scope = fixture()
        for value in [-1, float("nan"), float("inf"), True, "10"]:
            s["legs"][0]["talk_time"] = value
            with self.assertRaises(ValueError):
                rebuild(s["calls"], s["legs"], tickets, scope)

    def test_verifies_source_content_not_only_matching_ids(self):
        s, tickets, scope = fixture()
        c = candidates(s, tickets, scope)
        self.assertEqual(verify(c, s, tickets)["sourceReplayDifferences"], 0)
        c["cases"][0]["record"]["payload"]["sourceEvidence"]["legs"][0]["talk_time"] = 99
        with self.assertRaisesRegex(ValueError, "record_source_content_mismatch"):
            verify(c, s, tickets)

    def test_rejects_wrong_employee_scope_and_foreign_record_ticket(self):
        s, tickets, scope = fixture()
        for field in ["employee", "scope", "ticket"]:
            c = candidates(s, tickets, scope)
            p = c["cases"][0]["record"]["payload"]
            if field == "employee":
                p["employeeContext"]["employeeId"] = "other-fictional-employee"
            elif field == "scope":
                p["sourceEvidence"]["scope"]["agentId"] = 8
            else:
                p["sourceEvidence"]["tickets"].append({"id": 99, "group_id": 2})
            with self.assertRaises(ValueError):
                verify(c, s, tickets)

    def test_report_difference_does_not_claim_source_failure_or_certification(self):
        s, tickets, scope = fixture()
        checks = [{"employeeId": "fictional-employee", "column": "Outbound calls", "expected": 2}]
        result = verify(candidates(s, tickets, scope), s, tickets, checks)
        self.assertEqual(result["sourceReplayDifferences"], 0)
        self.assertEqual(result["reportCellDifferences"], 1)
        self.assertFalse(result["reportContributingIdsVerified"])
        self.assertFalse(result["publicationAuthorized"])
        with self.assertRaises(ValueError):
            verify(candidates(s, tickets, scope), s, tickets, checks * 2)


if __name__ == "__main__":
    unittest.main()
