// @vitest-environment node
import { expect, it, vi } from "vitest";
import { fetchTicketActions, summarizeTicketActions } from "./zendesk-ticket-actions";

const start = new Date("2026-09-23T00:00:00Z");
const end = new Date("2026-09-24T00:00:00Z");
const event = (id = 1, updater_id: number | null = 42, ticket_id = 10) => ({
  id,
  updater_id,
  ticket_id,
  created_at: "2026-09-23T12:00:00Z",
  child_events: [
    {
      id: id + 100,
      event_type: "Change",
      status: "solved",
      previous_value: "open",
      subject: "private subject",
    },
  ],
});
const page = (events: unknown[], complete = true) => ({
  ticket_events: events,
  count: events.length,
  end_time: end.getTime() / 1000,
  end_of_stream: complete,
  next_page: null,
});

it("attributes distinct resolved/updated tickets to actors and deduplicates repeated events", async () => {
  const cohort = await fetchTicketActions(start, end, async () =>
    page([event(), event(), event(2), event(3, 84), event(4, null)])
  );
  const summary = summarizeTicketActions(cohort, new Set([42, 84, 99]));
  expect(summary.agents.map((a) => [a.agentId, a.ticketsResolved, a.ticketsUpdated])).toEqual([
    [42, 1, 1],
    [84, 1, 1],
    [99, 0, 0],
  ]);
  expect(summary.agents[0]?.eventIds).toEqual([1, 2]);
  expect(summary.excludedEvents).toBe(1);
  expect(JSON.stringify(cohort)).not.toContain("private subject");
});

it("uses half-open event time boundaries and rejects contradictory event copies", async () => {
  const cohort = await fetchTicketActions(start, end, async () =>
    page([
      { ...event(), created_at: start.toISOString() },
      { ...event(2), created_at: end.toISOString() },
    ])
  );
  expect(cohort.events).toHaveLength(1);
  await expect(
    fetchTicketActions(start, end, async () => page([event(), event(1, 84)]))
  ).rejects.toThrow("Conflicting");
});

it("leaves partial coverage unavailable and cannot complete from a short page", async () => {
  const short = { ...page([event()]), end_time: end.getTime() / 1000 - 60 };
  const cohort = await fetchTicketActions(start, end, async () => short);
  expect(summarizeTicketActions(cohort, new Set([42])).agents[0]?.ticketsResolved).toBeNull();
  await expect(
    fetchTicketActions(start, end, async () => ({ ...short, end_of_stream: false }))
  ).rejects.toThrow("continuation");
});

it("requires a verified prior status and does not count closing or unchanged solved status", async () => {
  const rows = [
    {
      ...event(),
      child_events: [{ id: 101, event_type: "Change", status: "closed", previous_value: "solved" }],
    },
    {
      ...event(2),
      child_events: [{ id: 102, event_type: "Change", status: "solved", previous_value: "solved" }],
    },
    { ...event(3, 84), child_events: [{ id: 103, event_type: "Change", status: "solved" }] },
  ];
  const cohort = await fetchTicketActions(start, end, async () => page(rows));
  const summary = summarizeTicketActions(cohort, new Set([42, 84]));
  expect(summary.agents[0]?.ticketsResolved).toBe(0);
  expect(summary.agents[1]?.ticketsResolved).toBeNull();
});

it("fails closed on stalled pagination, missing completion markers, and budget exhaustion", async () => {
  const incomplete = {
    ...page([event()], false),
    end_time: start.getTime() / 1000 + 1,
    next_page: "/next",
  };
  const get = vi.fn().mockResolvedValue(incomplete);
  await expect(fetchTicketActions(start, end, get, 2)).rejects.toThrow("budget");
  await expect(fetchTicketActions(start, end, get, 3)).rejects.toThrow("stalled");
  await expect(
    fetchTicketActions(start, end, async () => ({ ...incomplete, end_of_stream: undefined }))
  ).rejects.toThrow();
});
