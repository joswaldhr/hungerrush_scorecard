import { z } from "zod";
import {
  ticketReportCreditSnapshotSchema,
  calculateTicketReportCredits,
  type TicketReportCreditScope,
} from "./zendesk-ticket-report-credits";
type Snapshot = z.infer<typeof ticketReportCreditSnapshotSchema>;
const id = z.number().int().positive().safe();
const joinSchema = z.object({
  tickets: ticketReportCreditSnapshotSchema.shape.tickets,
  metric_sets: z.array(
    z.object({ ticket_id: id, solved_at: z.iso.datetime({ offset: true }).nullable() })
  ),
});
const deletionSchema = z.object({
  deleted_tickets: z.array(z.object({ id, deleted_at: z.iso.datetime({ offset: true }) })),
  next_page: z.string().nullable(),
});

/** Fresh parent attributes and explicit tombstones; a missing parent is never zero. */
export async function joinUpdaterSolvedReport(
  input: unknown,
  scope: TicketReportCreditScope,
  read: (path: string) => Promise<unknown>,
  now: () => Date = () => new Date()
) {
  const base = ticketReportCreditSnapshotSchema
    .pick({ events: true, identities: true, coverage: true })
    .parse(input);
  const ids = [...new Set(base.events.map((e) => e.ticket_id))].sort((a, b) => a - b);
  if (ids.length > 5000) throw Error("Updater parent join capacity exceeded");
  const tickets: Snapshot["tickets"] = [],
    deletedTickets: Snapshot["deletedTickets"] = [],
    missing = new Set<number>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const batch = ids.slice(offset, offset + 100),
      wanted = new Set(batch);
    const joined = joinSchema.parse(
      await read(`/tickets/show_many.json?ids=${batch.join(",")}&include=metric_sets`)
    );
    const parents = new Set(joined.tickets.map((t) => t.id)),
      metrics = new Map(joined.metric_sets.map((m) => [m.ticket_id, m.solved_at]));
    if (
      parents.size !== joined.tickets.length ||
      metrics.size !== joined.metric_sets.length ||
      [...parents].some((id) => !wanted.has(id)) ||
      [...metrics.keys()].some((id) => !parents.has(id)) ||
      [...parents].some((id) => !metrics.has(id))
    )
      throw Error("Incomplete or conflicting updater parent metrics");
    for (const ticket of joined.tickets)
      tickets.push({ ...ticket, solved_at: metrics.get(ticket.id)! });
    for (const id of batch) if (!parents.has(id)) missing.add(id);
  }
  let path: string | null = "/deleted_tickets.json?per_page=100&sort_by=deleted_at&sort_order=desc";
  const visited = new Set<string>(),
    deletedIds = new Set<number>();
  for (let page = 0; missing.size && path && page < 15; page++) {
    if (visited.has(path)) throw Error("Updater deletion census stalled");
    visited.add(path);
    const response = deletionSchema.parse(await read(path));
    for (const ticket of response.deleted_tickets) {
      if (deletedIds.has(ticket.id)) throw Error("Updater deletion census duplicated a ticket");
      deletedIds.add(ticket.id);
      if (missing.delete(ticket.id)) deletedTickets.push(ticket);
    }
    path = response.next_page;
  }
  if (missing.size)
    throw Error("Updater report has unresolved parents; preserve prior publication");
  const snapshot = ticketReportCreditSnapshotSchema.parse({
    ...base,
    tickets,
    deletedTickets,
    observedAt: now().toISOString(),
  });
  const candidate = calculateTicketReportCredits(snapshot, scope);
  if (candidate.agents.some((a) => a.ticketsSolvedCredits === null))
    throw Error("Updater solved report lacks complete qualified evidence");
  return snapshot;
}
