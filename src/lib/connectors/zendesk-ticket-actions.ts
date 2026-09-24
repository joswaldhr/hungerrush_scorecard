import { z } from "zod";

// Strip subjects, custom fields, comment bodies, and unrelated audit metadata.
const eventSchema = z.object({
  id: z.number().int().positive().safe(),
  ticket_id: z.number().int().positive().safe(),
  updater_id: z.number().int().safe().nullable(),
  created_at: z.string().datetime({ offset: true }),
  child_events: z
    .array(
      z
        .object({
          id: z.number().int().positive().safe(),
          event_type: z.string(),
          status: z
            .enum(["new", "open", "pending", "hold", "solved", "closed", "deleted"])
            .optional(),
          previous_value: z.unknown().optional(),
          comment_present: z.boolean().optional(),
        })
        .transform(({ previous_value, ...event }) => ({
          ...event,
          // Previous values of unrelated fields can contain private content.
          previousStatus:
            event.status &&
            typeof previous_value === "string" &&
            ["new", "open", "pending", "hold", "solved", "closed", "deleted"].includes(
              previous_value
            )
              ? previous_value
              : null,
        }))
    )
    .refine(
      (children) => new Set(children.map((child) => child.id)).size === children.length,
      "Duplicate ticket action child IDs"
    ),
});
export type TicketActionEvent = z.output<typeof eventSchema>;

const pageSchema = z.object({
  ticket_events: z.array(eventSchema),
  count: z.number().int().nonnegative(),
  end_time: z.number().int().nonnegative().safe(),
  end_of_stream: z.boolean(),
  next_page: z.string().nullable(),
});

export function parseTicketActionPage(value: unknown) {
  return pageSchema.parse(value);
}

export async function fetchTicketActions(
  start: Date,
  endExclusive: Date,
  getPage: (path: string) => Promise<unknown>,
  pageBudget = 50
) {
  const from = start.getTime();
  const until = endExclusive.getTime();
  if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until) {
    throw new Error("Invalid ticket action interval");
  }
  let path = `/incremental/ticket_events.json?start_time=${Math.floor(from / 1000)}&per_page=1000`;
  let watermark = Math.floor(from / 1000);
  const visited = new Set<string>();
  const events = new Map<number, TicketActionEvent>();
  for (let pages = 1; pages <= pageBudget; pages++) {
    if (visited.has(path)) throw new Error("Ticket action export stalled");
    visited.add(path);
    const page = parseTicketActionPage(await getPage(path));
    if (page.count !== page.ticket_events.length || page.end_time < watermark) {
      throw new Error("Ticket action export has inconsistent count or watermark");
    }
    watermark = page.end_time;
    for (const event of page.ticket_events) {
      const previous = events.get(event.id);
      if (previous && JSON.stringify(previous) !== JSON.stringify(event)) {
        throw new Error("Conflicting ticket action event versions");
      }
      events.set(event.id, event);
    }
    if (watermark * 1000 >= until || page.end_of_stream) {
      return {
        events: [...events.values()].filter((event) => {
          const time = Date.parse(event.created_at);
          return time >= from && time < until;
        }),
        pages,
        observedThrough: new Date(watermark * 1000).toISOString(),
        coverage: watermark * 1000 >= until ? ("complete" as const) : ("partial" as const),
      };
    }
    if (!page.next_page) throw new Error("Ticket action export missing continuation");
    path = page.next_page;
  }
  throw new Error("Ticket action export page budget exhausted");
}

const reviewedAttributionSchema = z.object({
  reviewId: z.string().uuid(),
  eventId: z.number().int().positive().safe(),
  ticketId: z.number().int().positive().safe(),
  childEventId: z.number().int().positive().safe(),
  actorId: z.number().int().positive().safe(),
  attribution: z.enum(["verified_human", "verified_nonhuman"]),
});
export type ReviewedTicketAttribution = z.infer<typeof reviewedAttributionSchema>;

/**
 * Shadow only. Reviewed evidence is a trusted offline input, never inferred from
 * role, channel, updater ID, or comment author. Missing child-level proof is unknown.
 * Callers must bind reviews to the same source and immutable observation.
 */
export function summarizeTicketActions(
  cohort: Awaited<ReturnType<typeof fetchTicketActions>>,
  eligibleAgentIds: ReadonlySet<number>,
  reviewedAttributions: readonly ReviewedTicketAttribution[] = []
) {
  const events = new Map(cohort.events.map((event) => [event.id, event]));
  const reviews = new Map<string, ReviewedTicketAttribution>();
  for (const input of reviewedAttributions) {
    const review = reviewedAttributionSchema.parse(input);
    const event = events.get(review.eventId);
    if (
      !event ||
      event.ticket_id !== review.ticketId ||
      event.updater_id !== review.actorId ||
      !event.child_events.some((child) => child.id === review.childEventId)
    )
      throw new Error("Attribution review does not match ticket action evidence");
    const key = `${review.eventId}:${review.childEventId}`;
    if (reviews.has(key)) throw new Error("Duplicate ticket action attribution review");
    reviews.set(key, review);
  }
  const byAgent = new Map<
    number,
    {
      updated: Set<number>;
      resolved: Set<number>;
      eventIds: number[];
      uncertainResolutions: number;
      uncertainUpdates: number;
      excludedNonhumanChanges: number;
      reviewIds: Set<string>;
    }
  >();
  for (const agentId of eligibleAgentIds) {
    if (!Number.isSafeInteger(agentId) || agentId <= 0)
      throw new Error("Invalid eligible agent ID");
    byAgent.set(agentId, {
      updated: new Set(),
      resolved: new Set(),
      eventIds: [],
      uncertainResolutions: 0,
      uncertainUpdates: 0,
      excludedNonhumanChanges: 0,
      reviewIds: new Set(),
    });
  }
  let excludedEvents = 0;
  for (const event of cohort.events) {
    const agent = event.updater_id === null ? undefined : byAgent.get(event.updater_id);
    if (!agent) {
      excludedEvents++;
      continue;
    }
    let hasVerifiedHumanChange = false;
    for (const child of event.child_events) {
      if (child.event_type !== "Change" && child.comment_present !== true) continue;
      const review = reviews.get(`${event.id}:${child.id}`);
      const attribution = review?.attribution;
      if (review) agent.reviewIds.add(review.reviewId);
      if (attribution === "verified_nonhuman") {
        agent.excludedNonhumanChanges++;
        continue;
      }
      if (attribution !== "verified_human") {
        agent.uncertainUpdates++;
        if (
          child.event_type === "Change" &&
          child.status === "solved" &&
          (child.previousStatus === null ||
            ["new", "open", "pending", "hold"].includes(child.previousStatus))
        )
          agent.uncertainResolutions++;
        continue;
      }
      hasVerifiedHumanChange = true;
      agent.updated.add(event.ticket_id);
      if (child.event_type !== "Change" || child.status !== "solved") continue;
      if (child.previousStatus === null) agent.uncertainResolutions++;
      else if (["new", "open", "pending", "hold"].includes(child.previousStatus)) {
        agent.resolved.add(event.ticket_id);
      }
    }
    if (hasVerifiedHumanChange) agent.eventIds.push(event.id);
  }
  return {
    contract: "zendesk-ticket-actions-v2-human-only-shadow" as const,
    coverage: cohort.coverage,
    excludedEvents,
    agents: [...byAgent].map(([agentId, evidence]) => ({
      agentId,
      ticketsUpdated:
        cohort.coverage === "complete" && evidence.uncertainUpdates === 0
          ? evidence.updated.size
          : null,
      ticketsResolved:
        cohort.coverage === "complete" && evidence.uncertainResolutions === 0
          ? evidence.resolved.size
          : null,
      uncertainResolutions: evidence.uncertainResolutions,
      uncertainUpdates: evidence.uncertainUpdates,
      excludedNonhumanChanges: evidence.excludedNonhumanChanges,
      reviewIds: [...evidence.reviewIds].sort(),
      updatedTicketIds: [...evidence.updated].sort((a, b) => a - b),
      resolvedTicketIds: [...evidence.resolved].sort((a, b) => a - b),
      eventIds: [...evidence.eventIds].sort((a, b) => a - b),
    })),
  };
}
