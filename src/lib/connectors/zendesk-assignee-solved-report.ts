import { z } from "zod";
import { ticketReportCoverage, ticketReportCoverageSchema } from "./zendesk-ticket-report-coverage";

export const ASSIGNEE_SOLVED_REPORT_CONTRACT = "zendesk-assignee-solved-report-v1";
export const ASSIGNEE_SOLVED_REPORT_KEY = "zendesk_assignee_solved_tickets";
const id = z.number().int().positive().safe();
const ids = z
  .array(id)
  .min(1)
  .max(500)
  .refine((values) => new Set(values).size === values.length);
const instant = z.iso.datetime({ offset: true });
export const assigneeSolvedReportScopeSchema = z
  .object({
    periodStart: z.iso.date(),
    periodEnd: z.iso.date(),
    timeZone: z.string().min(1),
    agentIds: ids,
    groupIds: ids.nullable(),
    brandIds: ids.nullable(),
    dateBasis: z.literal("latest-solved"),
    attribution: z.literal("current-assignee"),
  })
  .strict();
export type AssigneeSolvedReportScope = z.infer<typeof assigneeSolvedReportScopeSchema>;
export const assigneeSolvedReportSnapshotSchema = z.object({
  tickets: z.array(
    z.object({
      id,
      assignee_id: id.nullable(),
      group_id: id.nullable(),
      brand_id: id.nullable(),
      status: z.enum(["new", "open", "pending", "hold", "solved", "closed", "deleted"]),
      solved_at: instant.nullable().optional(),
    })
  ),
  coverage: ticketReportCoverageSchema,
  observedAt: instant,
});

/** Offline Tickets-dataset candidate. Assignee ownership is not updater authorship. */
export function calculateAssigneeSolvedReport(
  input: unknown,
  scopeInput: AssigneeSolvedReportScope
) {
  const source = assigneeSolvedReportSnapshotSchema.parse(input),
    scope = assigneeSolvedReportScopeSchema.parse(scopeInput);
  if (
    scope.periodStart > scope.periodEnd ||
    Date.parse(scope.periodEnd) - Date.parse(scope.periodStart) > 31 * 86400000
  )
    throw Error("Invalid assignee-solved reporting interval");
  const { dayAt, covered, cutoff } = ticketReportCoverage(
    source.coverage,
    source.observedAt,
    scope
  );
  const agents = new Map(
    scope.agentIds.map((agentId) => [
      agentId,
      { ticketIds: [] as number[], issues: new Set<string>(covered ? [] : ["incomplete_census"]) },
    ])
  );
  const seen = new Set<number>();
  for (const ticket of source.tickets) {
    if (seen.has(ticket.id)) throw Error("Duplicate assignee-solved ticket");
    seen.add(ticket.id);
    const agent = ticket.assignee_id === null ? undefined : agents.get(ticket.assignee_id);
    if (!agent || (ticket.status !== "solved" && ticket.status !== "closed")) continue;
    if (
      scope.groupIds !== null &&
      (ticket.group_id === null || !scope.groupIds.includes(ticket.group_id))
    )
      continue;
    if (
      scope.brandIds !== null &&
      (ticket.brand_id === null || !scope.brandIds.includes(ticket.brand_id))
    )
      continue;
    if (ticket.solved_at === undefined) {
      agent.issues.add("missing_solved_time");
      continue;
    }
    if (ticket.solved_at === null) continue;
    const time = Date.parse(ticket.solved_at);
    if (time > Date.parse(source.observedAt))
      throw Error("Solved ticket is newer than its observation");
    if (cutoff !== null && time >= cutoff) continue;
    const day = dayAt(time);
    if (day >= scope.periodStart && day <= scope.periodEnd) agent.ticketIds.push(ticket.id);
  }
  return {
    contract: ASSIGNEE_SOLVED_REPORT_CONTRACT,
    qualification: "candidate" as const,
    scope,
    observedAt: source.observedAt,
    agents: [...agents].map(([agentId, a]) => ({
      agentId,
      assigneeSolvedTickets: a.issues.size ? null : a.ticketIds.length,
      ticketIds: a.ticketIds.sort((a, b) => a - b),
      issues: [...a.issues].sort(),
    })),
  };
}
