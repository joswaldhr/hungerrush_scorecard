import { expect, it } from "vitest";
import { prepareZendeskExport, type ExportIntake } from "./zendesk-export-intake";
import { assertMetricPublicationEligible } from "@/lib/domain/metrics/publication-eligibility";
const id = "60000000-0000-4000-8000-000000000001";
const sha = "a".repeat(64);
function fixture(): ExportIntake {
  return {
    organizationId: id,
    teamId: id,
    accountReference: "zendesk:hungerrush",
    periodStart: "2026-09-27",
    periodEnd: "2026-10-03",
    timeZone: "America/Chicago",
    observedAt: "2026-10-08T15:00:00Z",
    archiveSha256: sha,
    viewerEvidenceSha256: sha,
    identities: [{ employeeId: id, sourceName: "Sample Agent" }],
    reports: [
      {
        kind: "menufy-updates",
        fileSha256: sha,
        scopeEvidenceSha256: sha,
        headers: ["Agent", "Agent updates", "Solved", "% Solved"],
        rows: [["Sample Agent", "360.00000000000000000000", "354", "0.9833333333"]],
      },
    ],
  };
}
const now = new Date("2026-10-08T16:00:00Z");
it("maps outbound report counts to their existing keys without forcing a partition", () => {
  const f = fixture();
  f.reports = [
    {
      kind: "menufy-outbound",
      fileSha256: sha,
      scopeEvidenceSha256: sha,
      headers: ["Leg agent name", "Complete", "NA", "Total", "Talk"],
      rows: [["Sample Agent", "3", "1", "5", "100"]],
    },
  ];
  expect(prepareZendeskExport(f, now).values.map((v) => [v.key, v.value])).toEqual([
    ["outbound_calls_completed", 3],
    ["outbound_calls_non_answered", 1],
    ["outbound_calls", 5],
    ["total_talk_time_outbound", 100],
  ]);
});
it("retains report event meaning, dates and evidence without claiming human attribution", () => {
  const result = prepareZendeskExport(fixture(), now);
  expect(result.values.map((v) => [v.key, v.value])).toEqual([
    ["zendesk_agent_update_events", 360],
    ["zendesk_tickets_solved_credits", 354],
  ]);
  expect(result.values[0]).toMatchObject({
    sourceRow: 2,
    fileSha256: sha,
    scopeEvidenceSha256: sha,
  });
  expect(result.periodStart).toBe("2026-09-27");
  expect(result.batchFingerprint).toBe(prepareZendeskExport(fixture(), now).batchFingerprint);
  expect(() => assertMetricPublicationEligible({ ...result, publicationEligible: true })).toThrow(
    "not eligible"
  );
  expect(() => assertMetricPublicationEligible({}, "explore_export_candidate")).toThrow(
    "not eligible"
  );
});
it("keeps zero, blank, absent and unnamed rows distinct", () => {
  const f = fixture();
  f.reports[0]!.rows = [
    ["Sample Agent", "0", "", ""],
    ["\u00a0", "8", "1", ""],
    ["Outside Team", "4", "2", "0.5"],
  ];
  const r = prepareZendeskExport(f, now);
  expect(r.values.map((v) => v.value)).toEqual([0, null]);
  expect(r.coverage[0]).toMatchObject({
    matchedEmployees: 1,
    absentEmployees: 0,
    excludedRows: 1,
    unnamedRows: 1,
  });
  f.reports[0]!.rows = [];
  expect(prepareZendeskExport(f, now).values).toEqual([]);
  expect(prepareZendeskExport(f, now).coverage[0]!.absentEmployees).toBe(1);
});
it.each(["-1", "NaN", "Infinity", "=1+2", "1,234", "1.5", "9007199254740992"])(
  "rejects unsafe count %s",
  (raw) => {
    const f = fixture();
    f.reports[0]!.rows[0]![1] = raw;
    expect(() => prepareZendeskExport(f, now)).toThrow();
  }
);
it("rejects duplicates, fuzzy identity guesses and changed layouts", () => {
  const f = fixture();
  f.identities.push({ ...f.identities[0]! });
  expect(() => prepareZendeskExport(f, now)).toThrow("ambiguous");
  const g = fixture();
  g.reports[0]!.rows.push([...g.reports[0]!.rows[0]!]);
  expect(() => prepareZendeskExport(g, now)).toThrow("Duplicate");
  const h = fixture();
  h.reports[0]!.headers[1] = "Tickets updated";
  expect(() => prepareZendeskExport(h, now)).toThrow("headers");
  const j = fixture();
  j.reports[0]!.rows[0]![0] = "sample agent";
  expect(prepareZendeskExport(j, now).values).toHaveLength(0);
});
it("requires explicit verified period and viewer evidence", () => {
  const f = fixture();
  f.periodStart = "2026-09-28";
  expect(() => prepareZendeskExport(f, now)).toThrow();
  const g = fixture();
  g.viewerEvidenceSha256 = "";
  expect(() => prepareZendeskExport(g, now)).toThrow();
  const h = fixture();
  h.observedAt = "2026-10-09T00:00:00Z";
  expect(() => prepareZendeskExport(h, now)).toThrow();
});
it("preserves state blanks and excludes the total including online", () => {
  const f = fixture();
  f.reports = [
    {
      kind: "menufy-state",
      fileSha256: sha,
      scopeEvidenceSha256: sha,
      headers: ["Agent name", "State", "Total"],
      rows: [
        ["Sample Agent", "Away", ""],
        ["Sample Agent", "Transfers only", "40493"],
        ["Sample Agent", "SUM", "40493"],
      ],
    },
  ];
  expect(prepareZendeskExport(f, now).values.map((v) => [v.key, v.value])).toEqual([
    ["report_state_away", null],
    ["report_state_transfers_only", 40493],
  ]);
});
it("converts source ratios to percentages but never total seconds to averages", () => {
  const f = fixture();
  f.reports = [
    {
      kind: "menufy-inbound",
      fileSha256: sha,
      scopeEvidenceSha256: sha,
      headers: [
        "Name",
        "Offered",
        "Accepted",
        "Declined",
        "Missed",
        "unreachable",
        "% answered",
        "Abandoned on hold",
        "transferred to",
        "Talk time",
        "Max Hold time",
      ],
      rows: [["Sample Agent", "10", "8", "1", "1", "0", "0.8", "0", "1", "1234", "60"]],
    },
  ];
  const r = prepareZendeskExport(f, now);
  expect(r.values.find((v) => v.key === "inbound_calls_answer_rate")?.value).toBe(80);
  expect(r.values.find((v) => v.key === "total_talk_time_inbound")?.value).toBe(1234);
  expect(r.values.some((v) => v.key.includes("avg"))).toBe(false);
  f.reports[0]!.rows[0]![6] = "80";
  expect(() => prepareZendeskExport(f, now)).toThrow("range");
});
