// @vitest-environment node
import { expect, it } from "vitest";
import { collectFirstReplyRecords } from "./zendesk-first-reply-collection";
import { parseZendeskFirstReplyPolicy } from "./zendesk-first-reply-policy";
import { normalizeFirstReplyRecord } from "./zendesk-first-reply-record";
const teamA = "00000000-0000-4000-8000-000000000003",
  teamB = "00000000-0000-4000-8000-000000000004";
const policy = parseZendeskFirstReplyPolicy(
  JSON.stringify({
    schemaVersion: 1,
    dataSourceId: "00000000-0000-4000-8000-000000000001",
    organizationId: "00000000-0000-4000-8000-000000000002",
    accountReference: "zendesk-account:synthetic",
    reportingTimeZone: "America/Chicago",
    effectivePeriodStart: "2026-09-20",
    teams: [
      {
        teamId: teamA,
        groupIds: [20],
        brandIds: null,
        metricKeys: ["avg_response_time"],
      },
      { teamId: teamB, groupIds: [30], brandIds: [40], metricKeys: ["avg_response_time"] },
    ],
  }),
  "synthetic"
)!;
const employees = [
  { employeeId: "employee-a", teamId: teamA, externalId: "a@example.test" },
  { employeeId: "employee-b", teamId: teamB, externalId: "b@example.test" },
];
const ticket = (agentId: number) => ({
  id: agentId,
  assignee_id: agentId,
  group_id: agentId === 7 ? 20 : 30,
  brand_id: 40,
  created_at: "2026-09-21T12:00:00Z",
});
function reader(failSecond = false) {
  return async (path: string) => {
    const url = new URL(path, "https://synthetic.zendesk.com/api/v2/");
    if (url.pathname === "/users.json")
      return {
        users: employees.map((e, i) => ({
          id: i + 7,
          email: e.externalId,
          role: "agent",
          active: true,
          suspended: false,
        })),
        meta: { has_more: false },
        links: { next: null },
      };
    if (url.pathname === "/search/export.json") {
      const agentId = url.searchParams.get("query")!.includes("assignee:7") ? 7 : 8;
      if (failSecond && agentId === 8) throw new Error("second source collection unavailable");
      return { results: [ticket(agentId)], meta: { has_more: false }, links: { next: null } };
    }
    if (url.pathname === "/tickets/show_many.json")
      return {
        metric_sets: [
          {
            ticket_id: Number(url.searchParams.get("ids")),
            reply_time_in_minutes: { business: 0, calendar: 0 },
          },
        ],
      };
    throw new Error("Unexpected source path");
  };
}
it("collects both scoped teams and preserves each team's publication selection", async () => {
  const result = await collectFirstReplyRecords(
    policy,
    "2026-09-20",
    "2026-09-26",
    employees,
    reader()
  );
  expect(result.records).toHaveLength(2);
  expect(result.diagnostics).toMatchObject({
    activeEmployees: 2,
    staffPages: 1,
    collections: 2,
    paddedTickets: 2,
  });
  expect(
    result.records.map((r, i) =>
      normalizeFirstReplyRecord(
        r.payload,
        employees[i]!.employeeId,
        employees[i]!.teamId,
        "2026-09-20",
        "2026-09-26"
      ).map((f) => f.factType)
    )
  ).toEqual([["avg_response_time"], ["avg_response_time"]]);
});
it("returns no partial result on a later failure or an invalid interval", async () => {
  await expect(
    collectFirstReplyRecords(policy, "2026-09-20", "2026-09-26", employees, reader(true))
  ).rejects.toThrow(/second source/);
  await expect(
    collectFirstReplyRecords(policy, "2026-09-13", "2026-09-19", employees, reader())
  ).rejects.toThrow(/prospective/);
  await expect(
    collectFirstReplyRecords(policy, "2026-09-20", "2026-09-27", employees, reader())
  ).rejects.toThrow(/interval/);
  await expect(
    collectFirstReplyRecords(
      policy,
      "2026-09-20",
      "2026-09-26",
      [employees[0]!, employees[0]!],
      reader()
    )
  ).rejects.toThrow(/unique/);
});
