// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  advanceReportEventCursor,
  initialReportEventCursor,
  reportEventPath,
  parseReportEventPage,
} from "./zendesk-report-event-cursor";
const account = "zendesk-account:synthetic";
const start = Date.parse("2026-10-04T00:00:00Z") / 1000;
const now = new Date("2026-10-05T00:00:00Z");
const event = (id = 1) => ({
  id,
  ticket_id: 100,
  updater_id: 42,
  created_at: new Date((start + 60) * 1000).toISOString(),
  subject: "PRIVATE",
  child_events: [
    {
      id: 1000 + id,
      event_type: "Change",
      status: "solved",
      previous_value: "open",
      body: "PRIVATE",
    },
  ],
});
const page = (overrides = {}) => ({
  ticket_events: [event()],
  count: 1,
  end_time: start + 120,
  end_of_stream: false,
  next_page: `https://synthetic.zendesk.com/api/v2/incremental/ticket_events.json?start_time=${start + 120}`,
  ...overrides,
});
describe("report event cursor", () => {
  it("retains a resumable boundary and only finishes on the explicit source end", () => {
    const first = advanceReportEventCursor(initialReportEventCursor(account, start), page(), now);
    expect(first.cursor).toMatchObject({ status: "pending", pages: 1, watermark: start + 120 });
    const done = advanceReportEventCursor(
      first.cursor,
      page({
        ticket_events: [],
        count: 0,
        end_time: start + 180,
        end_of_stream: true,
        next_page: null,
      }),
      now
    );
    expect(done.cursor.status).toBe("exhausted");
    expect(new URL(done.cursor.path).searchParams.get("start_time")).toBe(String(start + 180));
  });
  it("removes unrelated private fields without losing the solve transition", () => {
    const parsed = parseReportEventPage(page());
    expect(JSON.stringify(parsed.ticket_events)).not.toContain("PRIVATE");
    expect(parsed.ticket_events[0]?.child_events[0]).toMatchObject({
      status: "solved",
      previous_value: "open",
    });
  });
  it("deduplicates identical boundaries and rejects conflicting update IDs", () => {
    expect(
      advanceReportEventCursor(
        initialReportEventCursor(account, start),
        page({ ticket_events: [event(), event()], count: 2 }),
        now
      ).records
    ).toHaveLength(1);
    expect(() =>
      advanceReportEventCursor(
        initialReportEventCursor(account, start),
        page({ ticket_events: [event(), { ...event(), updater_id: 43 }], count: 2 }),
        now
      )
    ).toThrow(/Conflicting/);
  });
  it("accepts more than 1,000 events sharing a time boundary without truncation", () => {
    expect(
      advanceReportEventCursor(
        initialReportEventCursor(account, start),
        page({ ticket_events: Array.from({ length: 1001 }, (_, i) => event(i + 1)), count: 1001 }),
        now
      ).records
    ).toHaveLength(1001);
  });
  it("rejects changed accounts, endpoints and ambiguous query parameters", () => {
    for (const path of [
      "https://other.zendesk.com/api/v2/incremental/ticket_events.json?start_time=1",
      "/api/v2/tickets.json?start_time=1",
      "/api/v2/incremental/ticket_events.json?start_time=1&start_time=2",
      "/api/v2/incremental/ticket_events.json?start_time=1&include=comments",
      "/api/v2/incremental/ticket_events.json?start_time=1#x",
    ])
      expect(() => reportEventPath(account, path)).toThrow();
  });
  it("rejects incomplete, looping, regressing, foreign and future pages", () => {
    for (const response of [
      page({ count: 2 }),
      page({ end_time: start }),
      page({ next_page: null }),
      page({ end_time: start - 1 }),
      page({ end_time: Math.floor(now.getTime() / 1000) + 1 }),
      page({
        next_page:
          "https://other.zendesk.com/api/v2/incremental/ticket_events.json?start_time=" +
          String(start + 120),
      }),
      page({
        ticket_events: [{ ...event(), created_at: new Date((start + 121) * 1000).toISOString() }],
      }),
    ])
      expect(() =>
        advanceReportEventCursor(initialReportEventCursor(account, start), response, now)
      ).toThrow();
  });
  it("retains older-created events without expanding the collection coverage start", () => {
    const older = { ...event(), created_at: new Date((start - 86400) * 1000).toISOString() };
    const result = advanceReportEventCursor(
      initialReportEventCursor(account, start),
      page({ ticket_events: [older] }),
      now
    );
    expect(result.records[0]?.created_at).toBe(older.created_at);
    expect(result.cursor.bootstrapStart).toBe(start);
  });
});
