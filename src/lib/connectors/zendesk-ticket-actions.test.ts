// @vitest-environment node
import { expect, it, vi } from "vitest";
import {
  fetchTicketActions,
  summarizeTicketActions,
  type ReviewedTicketAttribution,
} from "./zendesk-ticket-actions";

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
const review = (
  eventId = 1,
  actorId = 42,
  attribution: ReviewedTicketAttribution["attribution"] = "verified_human"
): ReviewedTicketAttribution => ({
  reviewId: "26dcac84-19b4-4809-907d-cc771fdb795a",
  eventId,
  ticketId: 10,
  childEventId: eventId + 100,
  actorId,
  attribution,
});

it("attributes distinct resolved/updated tickets to actors and deduplicates repeated events", async () => {
  const cohort = await fetchTicketActions(start, end, async () =>
    page([event(), event(), event(2), event(3, 84), event(4, null)])
  );
  const summary = summarizeTicketActions(cohort, new Set([42, 84, 99]), [
    review(),
    review(2),
    review(3, 84),
  ]);
  expect(summary.agents.map((a) => [a.agentId, a.ticketsResolved, a.ticketsUpdated])).toEqual([
    [42, 1, 1],
    [84, 1, 1],
    [99, 0, 0],
  ]);
  expect(summary.agents[0]?.eventIds).toEqual([1, 2]);
  expect(summary.agents[0]?.reviewIds).toEqual([review().reviewId]);
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
  const summary = summarizeTicketActions(cohort, new Set([42, 84]), [
    review(),
    review(2),
    review(3, 84),
  ]);
  expect(summary.agents[0]?.ticketsResolved).toBe(0);
  expect(summary.agents[1]?.ticketsResolved).toBeNull();
});

it("does not infer human activity from an eligible actor, web channel, or comment author", async () => {
  const cohort = await fetchTicketActions(start, end, async () =>
    page([{ ...event(), via: { channel: "web" }, author_id: 42 }])
  );
  const result = summarizeTicketActions(cohort, new Set([42])).agents[0];
  expect(result).toMatchObject({
    ticketsUpdated: null,
    ticketsResolved: null,
    uncertainUpdates: 1,
    uncertainResolutions: 1,
    updatedTicketIds: [],
    resolvedTicketIds: [],
    eventIds: [],
  });
});

it("excludes verified automation even when a human made another change in the same audit", async () => {
  const mixed = event();
  const cohort = await fetchTicketActions(start, end, async () =>
    page([
      {
        ...mixed,
        child_events: [
          ...mixed.child_events,
          { id: 999, event_type: "Comment", comment_present: true },
        ],
      },
    ])
  );
  const summary = summarizeTicketActions(cohort, new Set([42]), [
    review(1, 42, "verified_nonhuman"),
    { ...review(), childEventId: 999 },
  ]);
  expect(summary.agents[0]).toMatchObject({
    ticketsUpdated: 1,
    ticketsResolved: 0,
    excludedNonhumanChanges: 1,
    reviewIds: [review().reviewId],
  });
  expect(
    summarizeTicketActions(cohort, new Set([42]), [{ ...review(), childEventId: 999 }]).agents[0]
  ).toMatchObject({ ticketsUpdated: null, ticketsResolved: null });
});

it("rejects duplicate child IDs so one review cannot certify two different changes", async () => {
  const row = event();
  await expect(
    fetchTicketActions(start, end, async () =>
      page([
        {
          ...row,
          child_events: [
            ...row.child_events,
            { ...row.child_events[0], previous_value: "pending" },
          ],
        },
      ])
    )
  ).rejects.toThrow("Duplicate ticket action child IDs");
});

it("keeps resolution available when only an unrelated update has unknown attribution", async () => {
  const cohort = await fetchTicketActions(start, end, async () =>
    page([
      event(),
      { ...event(2), child_events: [{ id: 102, event_type: "Comment", comment_present: true }] },
    ])
  );
  expect(summarizeTicketActions(cohort, new Set([42]), [review()]).agents[0]).toMatchObject({
    ticketsUpdated: null,
    ticketsResolved: 1,
    uncertainUpdates: 1,
  });
});

it("rejects reviews for another actor, ticket, event, child, or duplicate review", async () => {
  const cohort = await fetchTicketActions(start, end, async () => page([event()]));
  for (const invalid of [
    { ...review(), actorId: 84 },
    { ...review(), ticketId: 99 },
    { ...review(), eventId: 99 },
    { ...review(), childEventId: 99 },
  ])
    expect(() => summarizeTicketActions(cohort, new Set([42]), [invalid])).toThrow("match");
  expect(() => summarizeTicketActions(cohort, new Set([42]), [review(), review()])).toThrow(
    "Duplicate"
  );
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
