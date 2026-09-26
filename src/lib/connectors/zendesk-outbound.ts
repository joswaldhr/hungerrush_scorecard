import { z } from "zod";
import {
  talkParticipationCallSchema,
  talkParticipationLegSchema,
} from "./zendesk-talk-participation";

const id = z.number().int().positive().safe();
const seconds = z.number().finite().nonnegative().nullable();
export const outboundCallSchema = talkParticipationCallSchema.extend({
  ticket_id: id.nullable(),
  talk_time: seconds,
  voicemail: z.boolean(),
});
const ticketSchema = z.object({ id, group_id: id.nullable() });
export type OutboundCall = z.infer<typeof outboundCallSchema>;
export type OutboundTicket = z.infer<typeof ticketSchema>;
type Leg = z.infer<typeof talkParticipationLegSchema>;
const scopeSchema = z.object({
  periodStart: z.iso.date(),
  periodEnd: z.iso.date(),
  timeZone: z.string().min(1),
  agentId: id,
  ticketGroupIds: z.array(id).min(1),
});
export type OutboundScope = z.infer<typeof scopeSchema>;

/**
 * Account-observed Explore mapping, NOT a universal interpretation of API status.
 * Qualification found API-completed zero-talk calls in Explore's non-answered set.
 * Contradictory/missing evidence remains unclassified. Completed includes connection
 * to a destination; it is not proof of a human customer answering.
 */
export function classifyOutboundCall(call: OutboundCall) {
  const c = outboundCallSchema.safeParse(call);
  if (!c.success || c.data.direction !== "outbound")
    throw new Error("Invalid outbound call evidence");
  if (c.data.completion_status === "abandoned_on_hold") return "abandoned-on-hold" as const;
  if (
    c.data.completion_status === "failed" &&
    (c.data.talk_time === null || c.data.talk_time === 0)
  )
    return "non-answered" as const;
  if (c.data.completion_status === "completed" && c.data.talk_time !== null) {
    if (c.data.talk_time > 0) return "completed" as const;
    if (!c.data.voicemail) return "non-answered" as const;
  }
  return "unclassified" as const;
}
const ids = (values: Iterable<number>) => [...new Set(values)].sort((a, b) => a - b);
function duration(legs: Leg[], field: "talk_time" | "hold_time") {
  const measured = legs.filter((leg) => leg[field] !== null);
  const sumSeconds = measured.reduce((sum, leg) => sum + leg[field]!, 0);
  if (!Number.isFinite(sumSeconds)) throw new Error("Outbound duration sum overflow");
  return {
    measuredLegIds: ids(measured.map((leg) => leg.id)),
    missingLegIds: ids(legs.filter((leg) => leg[field] === null).map((leg) => leg.id)),
    zeroLegIds: ids(legs.filter((leg) => leg[field] === 0).map((leg) => leg.id)),
    sumSeconds,
    sampleCount: measured.length,
    meanSeconds: measured.length ? sumSeconds / measured.length : null,
  };
}

/** Qualification candidate: caller must establish complete calls, tickets and related legs. */
export function calculateOutboundParticipation(
  calls: OutboundCall[],
  tickets: OutboundTicket[],
  legs: Leg[],
  input: OutboundScope
) {
  const scope = scopeSchema.safeParse(input),
    sourceCalls = z.array(outboundCallSchema).safeParse(calls),
    sourceTickets = z.array(ticketSchema).safeParse(tickets),
    sourceLegs = z.array(talkParticipationLegSchema).safeParse(legs);
  if (!scope.success || !sourceCalls.success || !sourceTickets.success || !sourceLegs.success)
    throw new Error("Invalid outbound source population");
  const s = scope.data;
  if (
    s.periodStart > s.periodEnd ||
    Date.parse(s.periodEnd) - Date.parse(s.periodStart) > 31 * 86400000 ||
    new Set(s.ticketGroupIds).size !== s.ticketGroupIds.length
  )
    throw new Error("Invalid outbound reporting scope");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: s.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const byTicket = new Map<number, OutboundTicket>();
  for (const ticket of sourceTickets.data) {
    if (byTicket.has(ticket.id)) throw new Error("Duplicate outbound ticket");
    byTicket.set(ticket.id, ticket);
  }
  const seenCalls = new Set<number>(),
    cohort = new Map<number, OutboundCall>();
  for (const call of sourceCalls.data) {
    if (seenCalls.has(call.id)) throw new Error("Duplicate outbound call");
    seenCalls.add(call.id);
    if (Date.parse(call.updated_at) < Date.parse(call.created_at))
      throw new Error("Invalid outbound call chronology");
    if (call.direction !== "outbound") continue;
    const parts = formatter.formatToParts(new Date(call.created_at));
    const part = (name: string) => parts.find((p) => p.type === name)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    if (day < s.periodStart || day > s.periodEnd || call.ticket_id === null) continue;
    const ticket = byTicket.get(call.ticket_id);
    if (!ticket) throw new Error("Incomplete outbound linked-ticket coverage");
    if (ticket.group_id !== null && s.ticketGroupIds.includes(ticket.group_id))
      cohort.set(call.id, call);
  }
  const seenLegs = new Set<number>(),
    selected: Leg[] = [];
  for (const leg of sourceLegs.data) {
    if (seenLegs.has(leg.id)) throw new Error("Duplicate outbound leg");
    seenLegs.add(leg.id);
    if (Date.parse(leg.updated_at) < Date.parse(leg.created_at))
      throw new Error("Invalid outbound leg chronology");
    if (
      leg.agent_id === s.agentId &&
      ["agent", "supervisor"].includes(leg.type) &&
      !seenCalls.has(leg.call_id)
    )
      throw new Error("Incomplete outbound parent-call coverage");
    if (
      leg.agent_id === s.agentId &&
      ["agent", "supervisor"].includes(leg.type) &&
      cohort.has(leg.call_id)
    )
      selected.push(leg);
  }
  const attemptedCallIds = ids(selected.map((leg) => leg.call_id));
  const classified = attemptedCallIds.map((callId) => ({
    id: callId,
    outcome: classifyOutboundCall(cohort.get(callId)!),
  }));
  const matching = (outcome: ReturnType<typeof classifyOutboundCall>) =>
    ids(classified.filter((c) => c.outcome === outcome).map((c) => c.id));
  const completedCallIds = matching("completed"),
    nonAnsweredCallIds = matching("non-answered"),
    abandonedOnHoldCallIds = matching("abandoned-on-hold"),
    unclassifiedCallIds = matching("unclassified");
  return {
    contract: "zendesk-outbound-call-participation-candidate-v1" as const,
    attemptedCallIds,
    completedCallIds,
    nonAnsweredCallIds,
    abandonedOnHoldCallIds,
    unclassifiedCallIds,
    selectedLegIds: ids(selected.map((leg) => leg.id)),
    attempted: attemptedCallIds.length,
    completed: unclassifiedCallIds.length ? null : completedCallIds.length,
    nonAnswered: unclassifiedCallIds.length ? null : nonAnsweredCallIds.length,
    talk: duration(selected, "talk_time"),
    hold: duration(selected, "hold_time"),
  };
}
