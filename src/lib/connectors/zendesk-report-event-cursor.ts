import { createHash } from "node:crypto";
import { z } from "zod";
import { parseTicketActionPage } from "./zendesk-ticket-actions";
import { isZendeskAccountReference } from "./zendesk-account-binding";

export const reportEventDigest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(
              Object.keys(item)
                .sort()
                .map((key) => [key, item[key]])
            )
          : item
      )
    )
    .digest("hex");

export const reportEventCursorSchema = z.object({
  accountReference: z.string(),
  bootstrapStart: z.number().int().nonnegative().safe(),
  cycleStart: z.number().int().nonnegative().safe(),
  watermark: z.number().int().nonnegative().safe(),
  path: z.string(),
  pages: z.number().int().min(0).max(10000),
  visited: z.array(z.string().regex(/^[a-f0-9]{64}$/)).max(10000),
  status: z.enum(["pending", "exhausted"]),
});
export type ReportEventCursor = z.infer<typeof reportEventCursorSchema>;

/** Only the account's time-based ticket-event GET endpoint is permitted. */
export function reportEventPath(account: string, path: string) {
  if (!isZendeskAccountReference(account)) throw Error("Invalid report event account");
  const origin = `https://${account.slice("zendesk-account:".length)}.zendesk.com`;
  const url = new URL(path, origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    url.hash ||
    url.pathname !== "/api/v2/incremental/ticket_events.json" ||
    !/^\d+$/.test(url.searchParams.get("start_time") ?? "") ||
    !Number.isSafeInteger(Number(url.searchParams.get("start_time"))) ||
    url.searchParams.getAll("start_time").length !== 1 ||
    url.searchParams.getAll("per_page").length > 1 ||
    (url.searchParams.has("per_page") && url.searchParams.get("per_page") !== "1000") ||
    [...url.searchParams.keys()].some((k) => !["start_time", "per_page"].includes(k))
  )
    throw Error("Report event request outside account allowlist");
  url.searchParams.set("per_page", "1000");
  url.searchParams.sort();
  return url.href;
}

export function initialReportEventCursor(
  account: string,
  bootstrapStart: number,
  cycleStart = bootstrapStart
): ReportEventCursor {
  if (
    !Number.isSafeInteger(bootstrapStart) ||
    bootstrapStart < 0 ||
    !Number.isSafeInteger(cycleStart) ||
    cycleStart < bootstrapStart
  )
    throw Error("Invalid report event start");
  return {
    accountReference: account,
    bootstrapStart,
    cycleStart,
    watermark: cycleStart,
    pages: 0,
    visited: [],
    status: "pending",
    path: reportEventPath(
      account,
      `/api/v2/incremental/ticket_events.json?start_time=${cycleStart}`
    ),
  };
}

export function validateReportEventCursor(input: unknown) {
  const c = reportEventCursorSchema.parse(input);
  const path = reportEventPath(c.accountReference, c.path);
  if (
    c.cycleStart < c.bootstrapStart ||
    c.watermark < c.cycleStart ||
    Number(new URL(path).searchParams.get("start_time")) !== c.watermark ||
    c.visited.length !== c.pages ||
    new Set(c.visited).size !== c.visited.length
  )
    throw Error("Invalid report event cursor chronology");
  return { ...c, path };
}

/** Strip private ticket/comment fields before retaining immutable update evidence. */
export function parseReportEventPage(response: unknown) {
  const page = parseTicketActionPage(response);
  // Time-based exports may legitimately exceed 1,000 at a timestamp boundary.
  // A hard capacity limit fails explicitly; it never truncates a page.
  if (page.count !== page.ticket_events.length || page.count > 10000)
    throw Error("Invalid report event page count or capacity");
  const events = page.ticket_events.map((e) => ({
    id: e.id,
    ticket_id: e.ticket_id,
    updater_id: e.updater_id,
    created_at: e.created_at,
    child_events: e.child_events.map((c) => ({
      id: c.id,
      event_type: c.event_type,
      ...(c.status ? { status: c.status, previous_value: c.previousStatus } : {}),
    })),
  }));
  return { ...page, ticket_events: events };
}
export type ReportEvent = ReturnType<typeof parseReportEventPage>["ticket_events"][number];

export function advanceReportEventCursor(
  input: ReportEventCursor,
  response: unknown,
  now = new Date()
) {
  const before = validateReportEventCursor(input);
  if (before.status !== "pending" || before.pages >= 10000)
    throw Error("Report event cursor exhausted");
  const page = parseReportEventPage(response),
    requestHash = reportEventDigest(before.path);
  if (
    before.visited.includes(requestHash) ||
    page.end_time < before.watermark ||
    page.end_time * 1000 > now.getTime()
  )
    throw Error("Report event cursor stalled or watermark invalid");
  const nextPath =
    page.next_page === null
      ? reportEventPath(
          before.accountReference,
          `/api/v2/incremental/ticket_events.json?start_time=${page.end_time}`
        )
      : reportEventPath(before.accountReference, page.next_page);
  if (
    Number(new URL(nextPath).searchParams.get("start_time")) !== page.end_time ||
    (!page.end_of_stream && (page.next_page === null || page.end_time === before.watermark))
  )
    throw Error("Invalid report event continuation");
  const records = new Map<number, ReportEvent>();
  for (const event of page.ticket_events) {
    const time = Date.parse(event.created_at);
    // Incremental delivery can include older-created events (observed in retained
    // source pages). The cursor tracks delivery; scorecard intervals filter
    // created_at independently. Never discard such records or backdate coverage.
    if (time < 0 || time > page.end_time * 1000)
      throw Error("Report event outside returned coverage");
    const previous = records.get(event.id);
    if (previous && reportEventDigest(previous) !== reportEventDigest(event))
      throw Error("Conflicting report event versions");
    records.set(event.id, event);
  }
  return {
    cursor: {
      ...before,
      path: nextPath,
      watermark: page.end_time,
      pages: before.pages + 1,
      visited: [...before.visited, requestHash],
      status: page.end_of_stream ? ("exhausted" as const) : ("pending" as const),
    },
    records: [...records.values()],
  };
}
