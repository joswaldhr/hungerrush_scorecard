import { createHash } from "node:crypto";
import { z } from "zod";
import { isZendeskAccountReference } from "./zendesk-account-binding";
import { outboundCallSchema, type OutboundCall } from "./zendesk-outbound";

export const outboundTicketMetadataSchema = z.object({
  id: z.number().int().positive().safe(),
  group_id: z.number().int().positive().safe().nullable(),
  updated_at: z.iso.datetime({ offset: true }),
});
const scopeSchema = z.object({
  accountReference: z.string().refine(isZendeskAccountReference),
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  timeZone: z.string().min(1),
});
/** Bind ticket metadata to the exact call observation, not only an equal-sized ID set. */
export function outboundTicketCohort(calls: OutboundCall[], input: z.infer<typeof scopeSchema>) {
  const parsed = scopeSchema.safeParse(input),
    parsedCalls = z.array(outboundCallSchema).safeParse(calls);
  if (!parsed.success || !parsedCalls.success)
    throw Error("Invalid outbound ticket collection scope");
  const scope = parsed.data;
  if (
    scope.periodStart > scope.periodEnd ||
    Date.parse(scope.periodEnd) - Date.parse(scope.periodStart) > 31 * 86400000
  )
    throw Error("Invalid outbound ticket interval");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const seen = new Set<number>(),
    ticketIds = new Set<number>();
  const cohort: OutboundCall[] = [];
  let unlinkedCalls = 0;
  for (const call of parsedCalls.data) {
    if (seen.has(call.id)) throw Error("Duplicate outbound source call");
    seen.add(call.id);
    if (Date.parse(call.updated_at) < Date.parse(call.created_at))
      throw Error("Invalid outbound source call chronology");
    if (call.direction !== "outbound") continue;
    const parts = formatter.formatToParts(new Date(call.created_at)),
      part = (name: string) => parts.find((p) => p.type === name)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    if (day < scope.periodStart || day > scope.periodEnd) continue;
    cohort.push(call);
    if (call.ticket_id === null) {
      unlinkedCalls++;
      continue;
    }
    ticketIds.add(call.ticket_id);
  }
  // Protect a single invocation from an unexpectedly large cohort; no truncation or partial success.
  if (ticketIds.size > 10000) throw Error("Outbound ticket cohort exceeds collection capacity");
  return {
    ticketIds: [...ticketIds].sort((a, b) => a - b),
    unlinkedCalls,
    callPopulationDigest: createHash("sha256")
      .update(JSON.stringify(cohort.sort((a, b) => a.id - b.id)))
      .digest("hex"),
  };
}

/** Complete linked-ticket metadata for a call-created cohort. Use an account-bound, bounded GET reader. */
export async function collectOutboundTicketGroups(
  calls: OutboundCall[],
  scope: z.infer<typeof scopeSchema>,
  read: (path: string) => Promise<unknown>
) {
  const cohort = outboundTicketCohort(calls, scope);
  const started = new Date().toISOString(),
    ids = cohort.ticketIds,
    tickets: z.infer<typeof outboundTicketMetadataSchema>[] = [];
  let requests = 0;
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100),
      expected = new Set(batch);
    const response = z
      .object({ tickets: z.array(outboundTicketMetadataSchema).max(100) })
      .safeParse(await read(`/tickets/show_many.json?ids=${batch.join(",")}`));
    requests++;
    if (!response.success) throw Error("Invalid outbound linked-ticket response");
    const received = new Set<number>();
    for (const ticket of response.data.tickets) {
      if (!expected.has(ticket.id) || received.has(ticket.id))
        throw Error("Foreign or duplicate outbound linked-ticket response");
      received.add(ticket.id);
      tickets.push(ticket);
    }
    if (received.size !== expected.size) throw Error("Incomplete outbound linked-ticket coverage");
  }
  return {
    tickets,
    coverage: {
      complete: true as const,
      accountReference: scope.accountReference,
      periodStart: scope.periodStart,
      periodEnd: scope.periodEnd,
      timeZone: scope.timeZone,
      observationStartedAt: started,
      observationEndedAt: new Date().toISOString(),
      requestedTickets: ids.length,
      returnedTickets: tickets.length,
      unlinkedCalls: cohort.unlinkedCalls,
      callPopulationDigest: cohort.callPopulationDigest,
      requests,
      scopeMeaning: "current-linked-ticket-group" as const,
    },
  };
}
