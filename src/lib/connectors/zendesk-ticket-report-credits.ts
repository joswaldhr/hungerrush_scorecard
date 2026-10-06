import { z } from "zod";

export const TICKET_REPORT_CREDIT_CONTRACT = "zendesk-updater-report-credits-v1";
export const ticketReportCreditKeys = [
  "zendesk_agent_update_events",
  "zendesk_tickets_solved_credits",
] as const;

const id = z.number().int().positive().safe();
const instant = z.iso.datetime({ offset: true });
const status = z.enum(["new", "open", "pending", "hold", "solved", "closed", "deleted"]);
const ids = z
  .array(id)
  .min(1)
  .max(500)
  .refine((values) => new Set(values).size === values.length);
const eventSchema = z.object({
  id,
  ticket_id: id,
  updater_id: z.number().int().safe().nullable(),
  created_at: instant,
  child_events: z
    .array(
      z.object({
        id,
        event_type: z.string(),
        status: status.optional(),
        previous_value: status.nullable().optional(),
      })
    )
    .refine((children) => new Set(children.map((child) => child.id)).size === children.length),
});
const ticketSchema = z.object({
  id,
  group_id: id.nullable(),
  brand_id: id.nullable(),
  status,
  solved_at: instant.nullable().optional(),
});
const identitySchema = z.object({ id, role: z.enum(["agent", "admin", "end-user"]).nullable() });
const scopeSchema = z
  .object({
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    timeZone: z.string().min(1),
    agentIds: ids,
    groupIds: ids,
    brandIds: ids.nullable(),
    dateBasis: z.literal("update-created"),
    groupBasis: z.literal("current-ticket-group"),
    attribution: z.literal("updater-account"),
  })
  .strict();
export type TicketReportCreditScope = z.infer<typeof scopeSchema>;

export const ticketReportCreditSnapshotSchema = z.object({
  events: z.array(eventSchema),
  tickets: z.array(ticketSchema),
  // Explicit source tombstones, never inferred from a missing show_many result.
  deletedTickets: z.array(z.object({ id, deleted_at: instant })).default([]),
  identities: z.array(identitySchema),
  // Coverage belongs to the entire event stream, not just selected employees.
  coverage: z.object({ start: instant, endExclusive: instant, complete: z.boolean() }),
  observedAt: instant,
});

type Issue =
  | "incomplete_stream"
  | "missing_ticket"
  | "unknown_updater_role"
  | "missing_solved_time"
  | "unknown_previous_status";
const sorted = (values: Iterable<number>) => [...values].sort((a, b) => a - b);

/**
 * Offline report candidate only: no vendor reads, persistence, targets or activation.
 * One update can change several fields; it still contributes one update ID. Account
 * attribution includes integration activity and never establishes human authorship.
 * Current parent scope/status and latest solved time deliberately follow Explore's
 * Updates history contract, so a later observation can legitimately revise a week.
 */
export function calculateTicketReportCredits(input: unknown, scopeInput: TicketReportCreditScope) {
  const source = ticketReportCreditSnapshotSchema.parse(input);
  const scope = scopeSchema.parse(scopeInput);
  if (
    scope.periodStart > scope.periodEnd ||
    Date.parse(scope.periodEnd) - Date.parse(scope.periodStart) > 31 * 86400000
  )
    throw Error("Invalid ticket-credit reporting interval");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dayAt = (time: number) => {
    const parts = formatter.formatToParts(new Date(time));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    return `${part("year")}-${part("month")}-${part("day")}`;
  };
  const start = Date.parse(source.coverage.start),
    end = Date.parse(source.coverage.endExclusive);
  if (start >= end || end > Date.parse(source.observedAt))
    throw Error("Invalid ticket-credit observation chronology");
  const covered =
    source.coverage.complete &&
    dayAt(start) <= scope.periodStart &&
    dayAt(start - 1) < scope.periodStart &&
    dayAt(end) > scope.periodEnd;

  const tickets = new Map<number, z.infer<typeof ticketSchema>>();
  for (const ticket of source.tickets) {
    if (tickets.has(ticket.id)) throw Error("Duplicate ticket-credit parent");
    tickets.set(ticket.id, ticket);
  }
  const deleted = new Set<number>();
  for (const ticket of source.deletedTickets) {
    if (tickets.has(ticket.id) || deleted.has(ticket.id))
      throw Error("Conflicting ticket-credit deletion evidence");
    if (Date.parse(ticket.deleted_at) > Date.parse(source.observedAt))
      throw Error("Ticket-credit deletion is newer than its observation");
    deleted.add(ticket.id);
  }
  const identities = new Map<number, z.infer<typeof identitySchema>>();
  for (const identity of source.identities) {
    if (identities.has(identity.id)) throw Error("Duplicate ticket-credit identity");
    identities.set(identity.id, identity);
  }
  const agents = new Map(
    scope.agentIds.map((agentId) => [
      agentId,
      {
        updates: new Set<number>(),
        solved: new Set<number>(),
        tickets: new Set<number>(),
        updateIssues: new Set<Issue>(covered ? [] : ["incomplete_stream"]),
        solvedIssues: new Set<Issue>(covered ? [] : ["incomplete_stream"]),
      },
    ])
  );
  for (const [agentId, agent] of agents) {
    if (!identities.get(agentId)?.role) agent.updateIssues.add("unknown_updater_role");
  }
  const events = new Map<number, z.infer<typeof eventSchema>>();
  for (const event of source.events) {
    const previous = events.get(event.id);
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(event))
        throw Error("Conflicting ticket-credit event versions");
      continue;
    }
    events.set(event.id, event);
    const time = Date.parse(event.created_at);
    if (time < start || time >= end) throw Error("Ticket-credit event outside captured interval");
    const day = dayAt(time);
    if (day < scope.periodStart || day > scope.periodEnd) continue;
    const agent = event.updater_id === null ? undefined : agents.get(event.updater_id);
    if (!agent) continue;
    // Deleted parent attributes cannot satisfy this contract's explicit group scope.
    // Updates history can retain deletion events; this is not a general exclusion
    // rule for unfiltered deletion reports.
    if (deleted.has(event.ticket_id)) continue;
    const ticket = tickets.get(event.ticket_id);
    if (!ticket) {
      agent.updateIssues.add("missing_ticket");
      agent.solvedIssues.add("missing_ticket");
      continue;
    }
    if (
      ticket.group_id === null ||
      !scope.groupIds.includes(ticket.group_id) ||
      (scope.brandIds !== null &&
        (ticket.brand_id === null || !scope.brandIds.includes(ticket.brand_id)))
    )
      continue;
    agent.tickets.add(ticket.id);
    const role = identities.get(event.updater_id!)?.role;
    if (role === "agent" || role === "admin") agent.updates.add(event.id);
    if (ticket.status !== "solved" && ticket.status !== "closed") continue;
    const possible = event.child_events.filter(
      (child) =>
        (child.status === "solved" || child.status === "closed") &&
        child.previous_value !== "solved"
    );
    if (!possible.length) continue;
    if (ticket.solved_at === undefined) {
      agent.solvedIssues.add("missing_solved_time");
      continue;
    }
    if (ticket.solved_at === null || Date.parse(ticket.solved_at) !== time) continue;
    if (
      possible.some(
        (child) =>
          (child.previous_value !== null && child.previous_value !== undefined) ||
          child.event_type === "Create"
      )
    )
      agent.solved.add(event.id);
    else agent.solvedIssues.add("unknown_previous_status");
  }
  return {
    contract: TICKET_REPORT_CREDIT_CONTRACT,
    qualification: "candidate" as const,
    attribution: scope.attribution,
    observedAt: source.observedAt,
    scope,
    agents: [...agents].map(([agentId, agent]) => ({
      agentId,
      agentUpdateEvents: agent.updateIssues.size ? null : agent.updates.size,
      ticketsSolvedCredits: agent.solvedIssues.size ? null : agent.solved.size,
      updateEventIds: sorted(agent.updates),
      solvedEventIds: sorted(agent.solved),
      ticketIds: sorted(agent.tickets),
      updateIssues: [...agent.updateIssues].sort(),
      solvedIssues: [...agent.solvedIssues].sort(),
    })),
  };
}
