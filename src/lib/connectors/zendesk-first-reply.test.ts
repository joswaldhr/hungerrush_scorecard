// @vitest-environment node
import { expect, it, vi } from "vitest";
import {
  calculateFirstReply,
  fetchFirstReplyCandidate,
  type FirstReplyMetric,
  type FirstReplyTicket,
} from "./zendesk-first-reply";

const scope = {
  periodStart: "2026-09-13",
  periodEnd: "2026-09-19",
  timeZone: "America/Chicago",
  agentId: 7,
  groupIds: [20],
  brandIds: [30],
};
const ticket = (id: number, created_at = "2026-09-14T12:00:00Z"): FirstReplyTicket => ({
  id,
  created_at,
  assignee_id: 7,
  group_id: 20,
  brand_id: 30,
});
const metric = (ticket_id: number, business: number | null): FirstReplyMetric => ({
  ticket_id,
  reply_time_in_minutes: { business, calendar: 5000 },
});
it("uses local creation boundaries, valid zeros and unrounded means regardless of later updates", () => {
  const tickets = [
    ticket(1, "2026-09-13T04:59:59Z"),
    ticket(2, "2026-09-13T05:00:00Z"),
    ticket(3, "2026-09-20T05:00:00Z"),
    { ...ticket(4), updated_at: "2026-09-25T00:00:00Z" },
    ticket(5),
    { ...ticket(6), group_id: 21 },
    { ...ticket(7), assignee_id: 8 },
    ticket(8, "2026-09-12T12:00:00Z"),
    ticket(9),
  ];
  const result = calculateFirstReply(
    tickets,
    [
      metric(1, 99),
      metric(2, 0),
      metric(3, 99),
      metric(4, 10),
      metric(5, null),
      metric(6, 20),
      metric(7, 30),
      metric(8, 99),
      metric(9, 2160),
    ],
    scope
  );
  expect(result).toMatchObject({
    cohortIds: [2, 4, 5, 9],
    measuredIds: [2, 4, 9],
    missingIds: [5],
    zeroIds: [2],
    sumBusinessMinutes: 2170,
    sampleCount: 3,
    meanBusinessMinutes: 2170 / 3,
  });
});
it("distinguishes no observations from a genuine zero and missing measurements", () => {
  expect(calculateFirstReply([], [], scope).meanBusinessMinutes).toBeNull();
  expect(calculateFirstReply([ticket(1)], [metric(1, null)], scope)).toMatchObject({
    cohortIds: [1],
    missingIds: [1],
    meanBusinessMinutes: null,
  });
  expect(calculateFirstReply([ticket(1)], [metric(1, 0)], scope).meanBusinessMinutes).toBe(0);
});
it("rejects incomplete, duplicated, invalid duration and ambiguous source evidence", () => {
  expect(() => calculateFirstReply([ticket(1)], [], scope)).toThrow("Incomplete");
  expect(() => calculateFirstReply([ticket(1), ticket(1)], [metric(1, 1)], scope)).toThrow(
    "Duplicate"
  );
  expect(() => calculateFirstReply([ticket(1)], [metric(1, 1), metric(1, 1)], scope)).toThrow(
    "Duplicate"
  );
  expect(() => calculateFirstReply([ticket(1)], [metric(1, -1)], scope)).toThrow("Invalid");
  expect(() => calculateFirstReply([ticket(1)], [metric(1, Infinity)], scope)).toThrow("Invalid");
  expect(() =>
    calculateFirstReply([{ ...ticket(1), brand_id: undefined }], [metric(1, 1)], scope)
  ).toThrow("brand");
  expect(() => calculateFirstReply([], [], { ...scope, groupIds: [] })).toThrow("scope");
  expect(() => calculateFirstReply([], [], { ...scope, periodStart: "2026-02-30" })).toThrow("day");
});
it("preserves local boundaries across the daylight-saving transition", () => {
  const changed = { ...scope, periodStart: "2026-11-01", periodEnd: "2026-11-07" };
  const rows = [
    ticket(1, "2026-11-01T04:59:59Z"),
    ticket(2, "2026-11-01T05:00:00Z"),
    ticket(3, "2026-11-08T05:59:59Z"),
    ticket(4, "2026-11-08T06:00:00Z"),
  ];
  expect(
    calculateFirstReply(
      rows,
      rows.map((t) => metric(t.id, 1)),
      changed
    ).cohortIds
  ).toEqual([2, 3]);
});
it("fetches all creation states through cursor export with exact metric-set coverage", async () => {
  const read = vi.fn(async (path: string): Promise<unknown> => {
    if (path.startsWith("/search/export.json"))
      return {
        results: [{ ...ticket(1), status: "open", satisfaction_rating: null }],
        meta: { has_more: false },
        links: { next: null },
      };
    return { metric_sets: [metric(1, 0)] };
  });
  const result = await fetchFirstReplyCandidate({ ...scope, agentIds: [7] }, read);
  expect(result.coverage).toMatchObject({
    complete: true,
    population: "all-created-tickets",
    requests: 2,
  });
  expect(result.coverage.query).toContain("created>=2026-09-12 created<=2026-09-20");
  expect(result.coverage.query).not.toMatch(/updated|solved|satisfaction|status/);
  expect(result.tickets[0]).not.toHaveProperty("status");
  expect(calculateFirstReply(result.tickets, result.metrics, scope).meanBusinessMinutes).toBe(0);
});
it("fails on partial metric coverage, source errors and request exhaustion", async () => {
  const page = { results: [ticket(1)], meta: { has_more: false }, links: { next: null } };
  const partial = vi.fn().mockResolvedValueOnce(page).mockResolvedValueOnce({ metric_sets: [] });
  await expect(fetchFirstReplyCandidate({ ...scope, agentIds: [7] }, partial)).rejects.toThrow(
    "Incomplete"
  );
  await expect(
    fetchFirstReplyCandidate({ ...scope, agentIds: [7] }, async () => {
      throw new Error("source unavailable");
    })
  ).rejects.toThrow("unavailable");
  await expect(
    fetchFirstReplyCandidate({ ...scope, agentIds: [7] }, async () => page, { requestBudget: 1 })
  ).rejects.toThrow("budget");
  await expect(
    fetchFirstReplyCandidate({ ...scope, agentIds: [] }, async () => page)
  ).rejects.toThrow("employee");
});
