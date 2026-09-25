import { z } from "zod";
import { fetchCompleteSearch, type SearchExportPage } from "./zendesk-search";
import { FIRST_REPLY_CONTRACT } from "@/lib/domain/metrics/source-context";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const instant = z.iso.datetime({ offset: true });
const duration = z.number().finite().nonnegative().nullable();
const ticketSchema = z.object({
  id,
  assignee_id: id.nullable(),
  group_id: id.nullable(),
  brand_id: id.nullable().optional(),
  created_at: instant,
});
const metricSchema = z.object({
  ticket_id: id,
  reply_time_in_minutes: z.object({ business: duration, calendar: duration }).nullable(),
});
export type FirstReplyTicket = z.infer<typeof ticketSchema>;
export type FirstReplyMetric = z.infer<typeof metricSchema>;
export interface FirstReplyScope {
  periodStart: string;
  periodEnd: string;
  timeZone: string;
  agentId: number;
  groupIds: number[];
  brandIds: number[] | null;
}
function prepare(scope: Omit<FirstReplyScope, "agentId">) {
  const parse = (value: string) => {
    const valid = z.iso.date().safeParse(value);
    if (!valid.success) throw new Error("Invalid first-reply reporting day");
    return new Date(`${value}T00:00:00Z`);
  };
  const first = parse(scope.periodStart),
    last = parse(scope.periodEnd);
  if (first > last || last.getTime() - first.getTime() > 31 * 86400000)
    throw new Error("Invalid first-reply reporting interval");
  for (const ids of [scope.groupIds, ...(scope.brandIds === null ? [] : [scope.brandIds])]) {
    if (
      !ids.length ||
      new Set(ids).size !== ids.length ||
      ids.some((v) => !id.safeParse(v).success)
    )
      throw new Error("First reply requires explicit unique source scopes");
  }
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return { first, last, formatter };
}
/** Native first public agent reply duration, attributed to current assignee; not author effort. */
export function calculateFirstReply(
  tickets: FirstReplyTicket[],
  metrics: FirstReplyMetric[],
  scope: FirstReplyScope
) {
  const { formatter } = prepare(scope);
  if (!id.safeParse(scope.agentId).success)
    throw new Error("Invalid first-reply employee identity");
  const parsedTickets = z.array(ticketSchema).safeParse(tickets),
    parsedMetrics = z.array(metricSchema).safeParse(metrics);
  if (!parsedTickets.success || !parsedMetrics.success)
    throw new Error("Invalid first-reply source snapshot");
  const byMetric = new Map<number, FirstReplyMetric>();
  for (const metric of parsedMetrics.data) {
    if (byMetric.has(metric.ticket_id)) throw new Error("Duplicate first-reply metric set");
    byMetric.set(metric.ticket_id, metric);
  }
  const seen = new Set<number>(),
    cohortIds: number[] = [],
    measuredIds: number[] = [],
    missingIds: number[] = [],
    zeroIds: number[] = [];
  let sumBusinessMinutes = 0;
  for (const ticket of parsedTickets.data) {
    if (seen.has(ticket.id)) throw new Error("Duplicate first-reply ticket");
    seen.add(ticket.id);
    if (scope.brandIds !== null) {
      if (ticket.brand_id === undefined) throw new Error("Missing first-reply brand evidence");
      if (ticket.brand_id === null || !scope.brandIds.includes(ticket.brand_id)) continue;
    }
    if (
      ticket.assignee_id !== scope.agentId ||
      ticket.group_id === null ||
      !scope.groupIds.includes(ticket.group_id)
    )
      continue;
    const parts = formatter.formatToParts(new Date(ticket.created_at));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    const localDay = `${part("year")}-${part("month")}-${part("day")}`;
    if (localDay < scope.periodStart || localDay > scope.periodEnd) continue;
    const metric = byMetric.get(ticket.id);
    if (!metric) throw new Error("Incomplete first-reply metric-set coverage");
    cohortIds.push(ticket.id);
    const value = metric.reply_time_in_minutes?.business ?? null;
    if (value === null) {
      missingIds.push(ticket.id);
      continue;
    }
    measuredIds.push(ticket.id);
    sumBusinessMinutes += value;
    if (value === 0) zeroIds.push(ticket.id);
  }
  if (!Number.isFinite(sumBusinessMinutes)) throw new Error("First-reply duration sum overflow");
  for (const ids of [cohortIds, measuredIds, missingIds, zeroIds]) ids.sort((a, b) => a - b);
  return {
    contract: FIRST_REPLY_CONTRACT,
    cohortIds,
    measuredIds,
    missingIds,
    zeroIds,
    sumBusinessMinutes,
    sampleCount: measuredIds.length,
    meanBusinessMinutes: measuredIds.length ? sumBusinessMinutes / measuredIds.length : null,
  };
}
/** Complete creation census. No last-update, solved-state or satisfaction filter is permitted. */
export async function fetchFirstReplyCandidate(
  scope: Omit<FirstReplyScope, "agentId"> & { agentIds: number[] },
  getPage: (path: string) => Promise<unknown>,
  options: { requestBudget?: number; now?: () => Date } = {}
) {
  const { first, last } = prepare(scope);
  if (
    !scope.agentIds.length ||
    new Set(scope.agentIds).size !== scope.agentIds.length ||
    scope.agentIds.some((v) => !id.safeParse(v).success)
  )
    throw new Error("First reply requires explicit unique employee identities");
  if (scope.groupIds.length + (scope.brandIds?.length ?? 0) + scope.agentIds.length > 60)
    throw new Error("First-reply scope exceeds the search term budget");
  const budget = options.requestBudget ?? 150;
  if (!Number.isInteger(budget) || budget < 1 || budget > 300)
    throw new Error("Invalid first-reply request budget");
  const now = options.now ?? (() => new Date()),
    observationStartedAt = now().toISOString();
  let requests = 0;
  const read = async (path: string) => {
    if (++requests > budget) throw new Error("First-reply source request budget exhausted");
    return getPage(path);
  };
  first.setUTCDate(first.getUTCDate() - 1);
  last.setUTCDate(last.getUTCDate() + 1);
  const query = `type:ticket created>=${first.toISOString().slice(0, 10)} created<=${last.toISOString().slice(0, 10)} ${[...scope.groupIds.map((v) => `group:${v}`), ...(scope.brandIds?.map((v) => `brand:${v}`) ?? []), ...scope.agentIds.map((v) => `assignee:${v}`)].join(" ")}`;
  const pageSchema = z.object({
    results: z.array(ticketSchema),
    meta: z.object({ has_more: z.boolean() }),
    links: z.object({ next: z.string().nullable() }),
  });
  const tickets = await fetchCompleteSearch(
    query,
    async (path): Promise<SearchExportPage<FirstReplyTicket>> => {
      const page = pageSchema.safeParse(await read(path));
      if (!page.success) throw new Error("Invalid first-reply ticket export page");
      return page.data;
    },
    Math.min(budget, 100)
  );
  const metrics: FirstReplyMetric[] = [];
  const metricPage = z.object({ metric_sets: z.array(metricSchema) });
  for (let start = 0; start < tickets.length; start += 100) {
    const ids = tickets.slice(start, start + 100).map((t) => t.id);
    const page = metricPage.safeParse(
      await read(`/tickets/show_many.json?ids=${ids.join(",")}&include=metric_sets`)
    );
    if (!page.success) throw new Error("Invalid first-reply metric-set response");
    const returned = new Set<number>();
    for (const metric of page.data.metric_sets) {
      if (!ids.includes(metric.ticket_id) || returned.has(metric.ticket_id))
        throw new Error("Conflicting first-reply metric-set coverage");
      returned.add(metric.ticket_id);
      metrics.push(metric);
    }
    if (returned.size !== ids.length) throw new Error("Incomplete first-reply metric-set coverage");
  }
  return {
    tickets,
    metrics,
    coverage: {
      complete: true as const,
      population: "all-created-tickets" as const,
      observationStartedAt,
      observationEndedAt: now().toISOString(),
      requests,
      query,
      ...scope,
    },
  };
}
