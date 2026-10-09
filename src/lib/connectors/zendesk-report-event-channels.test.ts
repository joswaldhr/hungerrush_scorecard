// @vitest-environment node
import { expect, it } from "vitest";
import { parseReportEventPage, reportEventDigest } from "./zendesk-report-event-cursor";
import { reportEventChannels, reportChannelCoverage } from "./zendesk-report-event-channels";

const event = {
  id: 1,
  ticket_id: 2,
  updater_id: 3,
  created_at: "2026-10-04T06:00:00Z",
  child_events: [],
};
const page = (ticket_events: unknown[]) => ({
  ticket_events,
  count: ticket_events.length,
  end_time: 1791093600,
  end_of_stream: true,
  next_page: null,
});

it("retains exact observed labels separately without changing original event hashes", () => {
  const plain = parseReportEventPage(page([event])).ticket_events[0]!;
  const enriched = page([
    { ...event, via: "Phone call inbound", subject: "PRIVATE", other: "PRIVATE" },
  ]);
  expect(parseReportEventPage(enriched).ticket_events[0]).toEqual(plain);
  expect(reportEventChannels(enriched)).toEqual([
    {
      version: 1,
      eventId: 1,
      eventDigest: reportEventDigest(plain),
      channel: "Phone call inbound",
    },
  ]);
  expect(JSON.stringify(reportEventChannels(enriched))).not.toContain("PRIVATE");
});

it("does not infer channels from unknown labels, numbers, or nested private via objects", () => {
  for (const via of [
    undefined,
    null,
    34,
    "34",
    "phone_call_inbound",
    "Phone call inbound ",
    "New Channel",
    { channel: "web", source: { from: { address: "PRIVATE" } } },
  ]) {
    expect(reportEventChannels(page([{ ...event, via }]))).toEqual([]);
  }
  const base = parseReportEventPage(page([event])).ticket_events;
  expect(reportChannelCoverage(base, [])).toEqual({
    complete: false,
    records: [],
    missingEventIds: [1],
  });
});

it("deduplicates identical overlap and rejects changed label or changed bound event", () => {
  const a = { ...event, via: "Phone call outbound" };
  expect(reportEventChannels(page([a, a]))).toHaveLength(1);
  expect(() => reportEventChannels(page([a, { ...a, via: "Web form" }]))).toThrow("Conflicting");
  expect(() => reportEventChannels(page([a, { ...a, updater_id: 4 }]))).toThrow("Conflicting");
});

it("requires matching event digests and reports precise missing coverage", () => {
  const source = page([
    { ...event, via: "Web service" },
    { ...event, id: 2 },
  ]);
  const events = parseReportEventPage(source).ticket_events,
    evidence = reportEventChannels(source);
  expect(reportChannelCoverage(events, evidence)).toMatchObject({
    complete: false,
    missingEventIds: [2],
  });
  expect(reportChannelCoverage(events.slice(0, 1), evidence).complete).toBe(true);
  expect(() => reportChannelCoverage(events, [...evidence, ...evidence])).toThrow("does not match");
  expect(() => reportChannelCoverage([{ ...events[0]!, updater_id: 99 }], evidence)).toThrow(
    "does not match"
  );
  expect(() => reportChannelCoverage([], evidence)).toThrow("does not match");
});
