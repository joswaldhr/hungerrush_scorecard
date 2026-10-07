// @vitest-environment node
import { expect, it, vi } from "vitest";
import { joinUpdaterSolvedReport } from "./zendesk-updater-solved-join";
import {
  calculateTicketReportCredits,
  type TicketReportCreditScope,
} from "./zendesk-ticket-report-credits";
const scope: TicketReportCreditScope = {
  periodStart: "2026-09-27",
  periodEnd: "2026-10-03",
  timeZone: "America/Chicago",
  agentIds: [42, 43],
  groupIds: [10],
  brandIds: [20],
  dateBasis: "update-created",
  groupBasis: "current-ticket-group",
  attribution: "updater-account",
};
const time = "2026-09-29T12:00:00Z",
  now = () => new Date("2026-10-07T12:00:00Z");
const event = (id = 1, ticket_id = 100) => ({
  id,
  ticket_id,
  updater_id: 42,
  created_at: time,
  child_events: [{ id: id * 100, event_type: "Change", status: "solved", previous_value: "open" }],
});
const base = (events = [event()]) => ({
  events,
  identities: [
    { id: 42, role: "agent" },
    { id: 43, role: "admin" },
  ],
  coverage: { start: "2026-09-27T05:00:00Z", endExclusive: "2026-10-04T05:00:00Z", complete: true },
});
const parent = { id: 100, status: "closed", group_id: 10, brand_id: 20 };
const joined = { tickets: [parent], metric_sets: [{ ticket_id: 100, solved_at: time }] };
it("joins latest parent/solve evidence and preserves an independently valid zero", async () => {
  const read = vi.fn().mockResolvedValue(joined);
  const snapshot = await joinUpdaterSolvedReport(base(), scope, read, now);
  const result = calculateTicketReportCredits(snapshot, scope);
  expect(result.agents.map((a) => a.ticketsSolvedCredits)).toEqual([1, 0]);
  expect(read).toHaveBeenCalledTimes(1);
  expect(snapshot.observedAt).toBe(now().toISOString());
});
it("requires a real deletion tombstone for missing parents", async () => {
  const read = vi
    .fn()
    .mockResolvedValueOnce({ tickets: [], metric_sets: [] })
    .mockResolvedValueOnce({
      deleted_tickets: [{ id: 100, deleted_at: "2026-10-05T00:00:00Z" }],
      next_page: null,
    });
  const snapshot = await joinUpdaterSolvedReport(base(), scope, read, now);
  expect(snapshot.deletedTickets).toHaveLength(1);
  expect(calculateTicketReportCredits(snapshot, scope).agents[0]?.ticketsSolvedCredits).toBe(0);
  await expect(
    joinUpdaterSolvedReport(
      base(),
      scope,
      vi
        .fn()
        .mockResolvedValueOnce({ tickets: [], metric_sets: [] })
        .mockResolvedValueOnce({ deleted_tickets: [], next_page: null }),
      now
    )
  ).rejects.toThrow("unresolved parents");
});
it("rejects duplicate, extraneous and missing metric joins", async () => {
  for (const response of [
    { ...joined, tickets: [parent, parent] },
    { ...joined, metric_sets: [] },
    { ...joined, metric_sets: [...joined.metric_sets, ...joined.metric_sets] },
    { tickets: [{ ...parent, id: 101 }], metric_sets: [{ ticket_id: 101, solved_at: time }] },
  ])
    await expect(
      joinUpdaterSolvedReport(base(), scope, vi.fn().mockResolvedValue(response), now)
    ).rejects.toThrow("parent metrics");
});
it("fails on missing solve time and unknown transition rather than publishing zero", async () => {
  await expect(
    joinUpdaterSolvedReport(
      base(),
      scope,
      vi.fn().mockResolvedValue({ ...joined, metric_sets: [{ ticket_id: 100 }] }),
      now
    )
  ).rejects.toThrow();
  const uncertain = event();
  uncertain.child_events[0]!.previous_value = "";
  await expect(
    joinUpdaterSolvedReport(base([uncertain]), scope, vi.fn().mockResolvedValue(joined), now)
  ).rejects.toThrow();
});
it("limits deletion pagination and never truncates unresolved coverage", async () => {
  let calls = 0;
  const read = vi.fn(async () =>
    ++calls === 1
      ? { tickets: [], metric_sets: [] }
      : { deleted_tickets: [], next_page: `/deleted_tickets.json?page=${calls}` }
  );
  await expect(joinUpdaterSolvedReport(base(), scope, read, now)).rejects.toThrow(
    "unresolved parents"
  );
  expect(read).toHaveBeenCalledTimes(16);
});
it("needs no parent request when the fully covered identity has no events", async () => {
  const read = vi.fn();
  const snapshot = await joinUpdaterSolvedReport(base([]), scope, read, now);
  expect(
    calculateTicketReportCredits(snapshot, scope).agents.map((a) => a.ticketsSolvedCredits)
  ).toEqual([0, 0]);
  expect(read).not.toHaveBeenCalled();
});
