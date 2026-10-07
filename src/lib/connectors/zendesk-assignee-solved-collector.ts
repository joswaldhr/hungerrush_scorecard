import { z } from "zod";
import {
  assigneeSolvedReportScopeSchema,
  assigneeSolvedReportSnapshotSchema,
  calculateAssigneeSolvedReport,
  type AssigneeSolvedReportScope,
} from "./zendesk-assignee-solved-report";
import { fetchCompleteSearch } from "./zendesk-search";

const id = z.number().int().positive().safe();
const pageSchema = z.object({
  results: z.array(z.object({ id })),
  meta: z.object({ has_more: z.boolean() }),
  links: z.object({ next: z.string().nullable() }),
});
const joinSchema = z.object({
  tickets: assigneeSolvedReportSnapshotSchema.shape.tickets,
  metric_sets: z.array(
    z.object({ ticket_id: id, solved_at: z.iso.datetime({ offset: true }).nullable() })
  ),
});

/**
 * Inactive closed-period collector. Supply the existing bounded account-bound GET
 * transport (createBoundedCsatReader); this function cannot extend its time/quota budget.
 * Search gives a complete ID census. Refresh all parent attributes and solved times
 * together so the calculation does not combine old search fields with newer metrics.
 */
export async function fetchAssigneeSolvedReportCandidate(
  scopeInput: AssigneeSolvedReportScope,
  getPage: (path: string) => Promise<unknown>,
  options: { requestBudget?: number; now?: () => Date } = {}
) {
  const scope = assigneeSolvedReportScopeSchema.parse(scopeInput);
  const budget = options.requestBudget ?? 80;
  if (!Number.isInteger(budget) || budget < 1 || budget > 150)
    throw new Error("Invalid assignee-solved collection budget");
  if (scope.agentIds.length + (scope.groupIds?.length ?? 0) + (scope.brandIds?.length ?? 0) > 60)
    throw new Error("Assignee-solved scope exceeds search term budget");
  const first = new Date(`${scope.periodStart}T00:00:00Z`);
  const last = new Date(`${scope.periodEnd}T00:00:00Z`);
  first.setUTCDate(first.getUTCDate() - 1);
  last.setUTCDate(last.getUTCDate() + 2);
  const now = options.now ?? (() => new Date());
  const observationStartedAt = now().toISOString();
  // The padded search is a superset of local dates, including DST and UTC offsets.
  // Only a closed interval is supported in this candidate; progress needs a distinct
  // as-of coverage contract rather than a false full-week completeness assertion.
  const coverage = {
    complete: true,
    start: first.toISOString(),
    endExclusive: new Date(
      Math.min(last.getTime(), Date.parse(observationStartedAt) - 60000)
    ).toISOString(),
  };
  const empty = calculateAssigneeSolvedReport(
    { tickets: [], coverage, observedAt: observationStartedAt },
    scope
  );
  if (empty.agents.some((a) => a.assigneeSolvedTickets === null))
    throw new Error("Assignee-solved collector requires a closed reporting period");
  const searchEnd = new Date(last.getTime() - 86400000).toISOString().slice(0, 10);
  const query = `type:ticket solved>=${first.toISOString().slice(0, 10)} solved<=${searchEnd} ${[
    ...scope.agentIds.map((value) => `assignee:${value}`),
    ...(scope.groupIds?.map((value) => `group:${value}`) ?? []),
    ...(scope.brandIds?.map((value) => `brand:${value}`) ?? []),
  ].join(" ")}`;
  let requests = 0;
  const read = (path: string) => {
    if (++requests > budget) throw new Error("Assignee-solved collection request budget exhausted");
    return getPage(path);
  };
  const census = await fetchCompleteSearch(
    query,
    async (path) => pageSchema.parse(await read(path)),
    budget
  );
  const tickets: z.infer<typeof joinSchema>["tickets"] = [];
  for (let offset = 0; offset < census.length; offset += 100) {
    const batch = census.slice(offset, offset + 100).map((t) => t.id);
    const joined = joinSchema.parse(
      await read(`/tickets/show_many.json?ids=${batch.join(",")}&include=metric_sets`)
    );
    const parents = new Set(joined.tickets.map((t) => t.id));
    const metrics = new Map(joined.metric_sets.map((m) => [m.ticket_id, m.solved_at]));
    if (
      parents.size !== batch.length ||
      joined.tickets.length !== batch.length ||
      metrics.size !== batch.length ||
      joined.metric_sets.length !== batch.length ||
      batch.some((id) => !parents.has(id) || !metrics.has(id))
    )
      throw new Error("Incomplete or conflicting assignee-solved parent coverage");
    tickets.push(...joined.tickets.map((t) => ({ ...t, solved_at: metrics.get(t.id)! })));
  }
  const observedAt = now().toISOString();
  if (Date.parse(observedAt) < Date.parse(observationStartedAt))
    throw new Error("Assignee-solved observation clock moved backwards");
  const snapshot = { tickets, coverage, observedAt, observationStartedAt, scope, requests };
  calculateAssigneeSolvedReport(snapshot, scope);
  return snapshot;
}
