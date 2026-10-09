import { z } from "zod";
import {
  parseReportEventPage,
  reportEventDigest,
  type ReportEvent,
} from "./zendesk-report-event-cursor";

// Exact account-observed incremental-event labels (retained October 6 capture).
// No numeric-via mapping, fuzzy matching, or inference from ticket creation channel.
// Unrecognized labels remain missing evidence instead of being treated as non-phone.
const channel = z.enum([
  "Rule",
  "Web service",
  "Merge",
  "Web form",
  "Phone call inbound",
  "Mail",
  "Intelligent Triage",
  "User Merge",
  "SLA",
  "Closed Ticket",
  "Web Widget",
  "Phone call outbound",
  "Sms",
]);
export const reportEventChannelSchema = z.object({
  version: z.literal(1),
  eventId: z.number().int().positive().safe(),
  eventDigest: z.string().regex(/^[a-f0-9]{64}$/),
  channel,
});
export type ReportEventChannel = z.infer<typeof reportEventChannelSchema>;

/** Additive evidence only: do not change the existing immutable event schema/hash. */
export function reportEventChannels(response: unknown) {
  const page = parseReportEventPage(response);
  const raw = z
    .object({ ticket_events: z.array(z.object({ via: z.unknown().optional() })) })
    .parse(response);
  const records = new Map<number, ReportEventChannel>();
  page.ticket_events.forEach((event, index) => {
    const parsed = channel.safeParse(raw.ticket_events[index]!.via);
    if (!parsed.success) return;
    const record: ReportEventChannel = {
      version: 1,
      eventId: event.id,
      eventDigest: reportEventDigest(event),
      channel: parsed.data,
    };
    const previous = records.get(event.id);
    if (previous && reportEventDigest(previous) !== reportEventDigest(record))
      throw Error("Conflicting report event channel evidence");
    records.set(event.id, record);
  });
  return [...records.values()];
}

/** An exhausted base stream is insufficient when a channel-filtered report is used. */
export function reportChannelCoverage(events: ReportEvent[], evidence: unknown[]) {
  const byEvent = new Map(events.map((event) => [event.id, reportEventDigest(event)]));
  if (byEvent.size !== events.length) throw Error("Duplicate report events in channel coverage");
  const channels = new Map<number, ReportEventChannel>();
  for (const input of evidence) {
    const record = reportEventChannelSchema.parse(input);
    if (channels.has(record.eventId) || byEvent.get(record.eventId) !== record.eventDigest)
      throw Error("Report channel evidence does not match retained event");
    channels.set(record.eventId, record);
  }
  const missingEventIds = events
    .filter((event) => !channels.has(event.id))
    .map((event) => event.id);
  return {
    complete: missingEventIds.length === 0,
    records: [...channels.values()],
    missingEventIds,
  };
}
