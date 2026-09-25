// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import { averageEvidence, sourceIds } from "./source-evidence";
const email = "synthetic@example.test";
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({ where: async () => [{ externalId: "synthetic@example.test" }] }),
      }),
    }),
  },
}));
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
const get = vi.hoisted(() => vi.fn());
vi.mock("./zendesk-shared", () => ({ zendeskGet: get }));
import { ZendeskConnector } from "./zendesk";
afterEach(() => {
  vi.useRealTimers();
  get.mockReset();
});

it("retains evidence and includes reported business zeros despite positive calendar time", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  const ticket = (id: number, status: string) => ({
    id,
    status,
    assignee_id: 7,
    created_at: "2026-09-21T12:00:00Z",
    updated_at: "2026-09-22T12:00:00Z",
    tags: [],
  });
  const call = (id: number, talk_time: number) => ({
    id,
    agent_id: 7,
    direction: "inbound",
    completion_status: "completed",
    duration: 60,
    talk_time,
    hold_time: 0,
    consultation_time: 0,
    created_at: "2026-09-21T12:00:00Z",
    updated_at: "2026-09-22T12:00:00Z",
  });
  get.mockImplementation(async (path: string) => {
    if (path.startsWith("/satisfaction_ratings"))
      return {
        satisfaction_ratings: [
          { id: 31, assignee_id: 7, score: "good" },
          { id: 32, assignee_id: 7, score: "bad" },
        ],
        next_page: null,
      };
    if (path.startsWith("/channels/voice"))
      return {
        calls: [call(91, 20), call(92, 40)],
        count: 2,
        end_time: 1790078400,
        next_page: "/talk-last",
      };
    if (path === "/talk-last")
      return { calls: [call(92, 40)], count: 1, end_time: 1790078400, next_page: "/talk-last" };
    if (path.startsWith("/search/export"))
      return {
        results: path.includes("status")
          ? [ticket(2, "open")]
          : [ticket(1, "solved"), ticket(2, "open")],
        meta: { has_more: false },
        links: { next: null },
      };
    if (path.startsWith("/tickets/show_many"))
      return {
        metric_sets: [
          {
            ticket_id: 1,
            full_resolution_time_in_minutes: { calendar: 10, business: 0 },
            reply_time_in_minutes: { calendar: 10, business: 0 },
          },
          {
            ticket_id: 2,
            full_resolution_time_in_minutes: null,
            reply_time_in_minutes: { calendar: 20, business: 20 },
          },
        ],
      };
    if (path.startsWith("/users/search")) return { users: [{ id: 7, email }] };
    throw new Error("Unexpected fixture endpoint");
  });
  const connector = new ZendeskConnector();
  const result = await connector.fetchRecords(
    { dataSourceId: "source", organizationId: "org" },
    { dataSourceId: "source", organizationId: "org", syncRunId: "run", cursor: "0" }
  );
  const tickets = result.records.find(
    (record) => record.externalRecordType === "agent_stats"
  )!.payload;
  expect(tickets).toMatchObject({
    ticketsResolved: 1,
    ticketsUpdated: 2,
    avgHandleTimeMinutes: 0,
    avgResponseTimeMinutes: 10,
    backlogCount: 1,
    sourceEvidence: {
      durationPolicy: "include_reported_business_zero",
      ticketIds: [1, 2],
      resolvedTicketIds: [1],
      backlogTicketIds: [2],
      fullResolutionBusinessMinutes: { numerator: 0, denominator: 1 },
      firstReplyBusinessMinutes: { numerator: 20, denominator: 2 },
    },
  });
  expect(
    result.records.find((record) => record.externalRecordType === "call_stats")!.payload
  ).toMatchObject({
    avgTalkTimeInbound: 30,
    inboundOffered: 2,
    sourceEvidence: { callIds: [91, 92], inboundTalk: { numerator: 60, denominator: 2 } },
  });
  expect(
    result.records.find((record) => record.externalRecordType === "csat_summary")!.payload
  ).toMatchObject({
    csatScore: 50,
    sourceEvidence: { ratingIds: [31, 32], numerator: 1, denominator: 2 },
  });
  const facts = connector.normalizeRecords(
    result.records.map((record) => ({
      sourceRecordId: record.externalRecordId,
      payload: record.payload,
    })),
    "employee",
    null,
    "2026-09-20",
    "2026-09-26"
  );
  expect(facts.find((fact) => fact.factType === "avg_handle_time")?.numericValue).toBe(0);
  expect(facts.find((fact) => fact.factType === "csat_score")?.numericValue).toBe(50);
});

it("distinguishes missing samples from confirmed zero", () => {
  expect(averageEvidence([null])).toEqual({ numerator: null, denominator: 0 });
  expect(averageEvidence([null, 0])).toEqual({ numerator: 0, denominator: 1 });
  expect(() => averageEvidence([NaN])).toThrow("Invalid numeric");
});
it("produces stable evidence ID ordering and rejects invalid IDs", () => {
  expect(sourceIds([{ id: 2 }, { id: 1 }])).toEqual([1, 2]);
  expect(() => sourceIds([{ id: 0 }])).toThrow("Invalid source evidence");
  expect(() => sourceIds([{ id: 1 }, { id: 1 }])).toThrow("Repeated source evidence");
});

it("rejects duplicate ratings before they can inflate CSAT denominators", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  const rating = { id: 31, assignee_id: 7, score: "good" };
  get.mockResolvedValue({ satisfaction_ratings: [rating, rating], next_page: null });
  await expect(
    new ZendeskConnector().fetchRecords(
      { dataSourceId: "source", organizationId: "org" },
      { dataSourceId: "source", organizationId: "org", syncRunId: "run", cursor: "0" }
    )
  ).rejects.toThrow("repeated rating ID");
  expect(get).toHaveBeenCalledTimes(1);
});

it("rejects cyclic rating pagination", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-23T12:00:00Z"));
  let id = 0;
  get.mockImplementation(async () => ({
    satisfaction_ratings: [{ id: ++id, assignee_id: 7, score: "good" }],
    next_page: "/same",
  }));
  await expect(
    new ZendeskConnector().fetchRecords(
      { dataSourceId: "source", organizationId: "org" },
      { dataSourceId: "source", organizationId: "org", syncRunId: "run", cursor: "0" }
    )
  ).rejects.toThrow("pagination stalled");
  expect(get).toHaveBeenCalledTimes(2);
});
