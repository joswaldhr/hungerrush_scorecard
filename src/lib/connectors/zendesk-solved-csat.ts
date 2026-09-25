import { z } from "zod";
import { fetchCompleteSearch, type SearchExportPage } from "./zendesk-search";

const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const instant = z.iso.datetime({ offset: true });
const ticketSchema = z.object({
  id,
  assignee_id: id.nullable(),
  group_id: id.nullable(),
  brand_id: id.nullable().optional(),
  satisfaction_rating: z
    .object({ score: z.enum(["unoffered", "offered", "good", "bad"]) })
    .nullable(),
});
const metricSchema = z.object({ ticket_id: id, solved_at: instant.nullable() });
export type SolvedCsatTicket = z.infer<typeof ticketSchema>;
export type SolvedCsatMetric = z.infer<typeof metricSchema>;
export interface SolvedCsatScope {
  periodStart: string;
  periodEnd: string;
  timeZone: string;
  agentId: number;
  groupIds: number[];
  brandIds: number[] | null;
}

function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid CSAT reporting day");
  const result = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value)
    throw new Error("Invalid CSAT reporting day");
  return result;
}
function period(start: string, end: string, timeZone: string) {
  const first = day(start),
    last = day(end);
  if (first > last || last.getTime() - first.getTime() > 31 * 86400000)
    throw new Error("Invalid CSAT reporting interval");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return { first, last, formatter };
}
function identifier(value: number) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid CSAT identity or scope");
}

function sourceScope(scope: Pick<SolvedCsatScope, "groupIds" | "brandIds">) {
  scope.groupIds.forEach(identifier);
  scope.brandIds?.forEach(identifier);
  if (!scope.groupIds.length || new Set(scope.groupIds).size !== scope.groupIds.length)
    throw new Error("CSAT requires an explicit unique group scope");
  if (
    scope.brandIds !== null &&
    (!scope.brandIds.length || new Set(scope.brandIds).size !== scope.brandIds.length)
  )
    throw new Error("Invalid CSAT brand scope");
  if (scope.groupIds.length + (scope.brandIds?.length ?? 0) > 60)
    throw new Error("CSAT scope exceeds the search term budget");
}

/**
 * Candidate contract only; no publisher imports this module. Current assignee and
 * latest solved date intentionally match Support: Tickets, not event authorship.
 * The caller must use a completed collector snapshot, not a rated-only subset.
 */
export function calculateSolvedCsatCandidate(
  tickets: SolvedCsatTicket[],
  metrics: SolvedCsatMetric[],
  scope: SolvedCsatScope
) {
  const { formatter } = period(scope.periodStart, scope.periodEnd, scope.timeZone);
  identifier(scope.agentId);
  sourceScope(scope);
  const parsedTickets = z.array(ticketSchema).safeParse(tickets);
  const parsedMetrics = z.array(metricSchema).safeParse(metrics);
  if (!parsedTickets.success || !parsedMetrics.success)
    throw new Error("Invalid CSAT source snapshot");
  const byMetric = new Map<number, SolvedCsatMetric>();
  for (const metric of parsedMetrics.data) {
    if (byMetric.has(metric.ticket_id)) throw new Error("Duplicate CSAT metric set");
    byMetric.set(metric.ticket_id, metric);
  }
  const seen = new Set<number>();
  const goodIds: number[] = [],
    badIds: number[] = [],
    offeredIds: number[] = [],
    cohortIds: number[] = [];
  for (const ticket of parsedTickets.data) {
    if (seen.has(ticket.id)) throw new Error("Duplicate CSAT ticket");
    seen.add(ticket.id);
    if (scope.brandIds !== null) {
      if (ticket.brand_id === undefined) throw new Error("Missing CSAT brand evidence");
      if (ticket.brand_id === null || !scope.brandIds.includes(ticket.brand_id)) continue;
    }
    if (
      ticket.assignee_id !== scope.agentId ||
      ticket.group_id === null ||
      !scope.groupIds.includes(ticket.group_id)
    )
      continue;
    const metric = byMetric.get(ticket.id);
    if (!metric) throw new Error("Incomplete CSAT metric-set coverage");
    if (metric.solved_at === null) continue;
    const parts = formatter.formatToParts(new Date(metric.solved_at));
    const part = (type: string) => parts.find((p) => p.type === type)!.value;
    const solvedDay = `${part("year")}-${part("month")}-${part("day")}`;
    if (solvedDay < scope.periodStart || solvedDay > scope.periodEnd) continue;
    cohortIds.push(ticket.id);
    const score = ticket.satisfaction_rating?.score;
    if (score === "good") goodIds.push(ticket.id);
    if (score === "bad") badIds.push(ticket.id);
    if (score === "offered") offeredIds.push(ticket.id);
  }
  const sorted = (values: number[]) => values.sort((a, b) => a - b);
  const rated = goodIds.length + badIds.length;
  const surveyed = rated + offeredIds.length;
  return {
    contract: "zendesk-solved-current-assignee-csat-v1" as const,
    cohortIds: sorted(cohortIds),
    goodIds: sorted(goodIds),
    badIds: sorted(badIds),
    surveyedIds: sorted([...goodIds, ...badIds, ...offeredIds]),
    score: {
      numerator: goodIds.length,
      denominator: rated,
      value: rated ? (100 * goodIds.length) / rated : null,
    },
    response: {
      numerator: rated,
      denominator: surveyed,
      value: surveyed ? (100 * rated) / surveyed : null,
    },
  };
}

/** Bounded complete solved-ticket census, including unoffered and commented ratings. */
export async function fetchSolvedCsatCandidate(
  scope: Pick<
    SolvedCsatScope,
    "periodStart" | "periodEnd" | "timeZone" | "groupIds" | "brandIds"
  > & { agentIds: number[] },
  getPage: (path: string) => Promise<unknown>,
  options: { requestBudget?: number; now?: () => Date } = {}
) {
  const { first, last } = period(scope.periodStart, scope.periodEnd, scope.timeZone);
  sourceScope(scope);
  scope.agentIds.forEach(identifier);
  if (!scope.agentIds.length || new Set(scope.agentIds).size !== scope.agentIds.length)
    throw new Error("CSAT requires explicit unique employee identities");
  if (scope.groupIds.length + (scope.brandIds?.length ?? 0) + scope.agentIds.length > 60)
    throw new Error("CSAT employee scope exceeds the search term budget");
  const budget = options.requestBudget ?? 150;
  if (!Number.isInteger(budget) || budget < 1 || budget > 300)
    throw new Error("Invalid CSAT request budget");
  const now = options.now ?? (() => new Date());
  const observationStartedAt = now().toISOString();
  let requests = 0;
  const read = async (path: string) => {
    if (++requests > budget) throw new Error("CSAT source request budget exhausted");
    // Existing Zendesk transport enforces account origin. This collector never retries
    // or converts a failed page into a partial successful snapshot.
    return getPage(path);
  };
  // Pad UTC search dates; the final cohort uses the configured local solved day.
  first.setUTCDate(first.getUTCDate() - 1);
  last.setUTCDate(last.getUTCDate() + 1);
  const query = `type:ticket solved>=${first.toISOString().slice(0, 10)} solved<=${last.toISOString().slice(0, 10)} ${[...scope.groupIds.map((group) => `group:${group}`), ...(scope.brandIds?.map((brand) => `brand:${brand}`) ?? []), ...scope.agentIds.map((agent) => `assignee:${agent}`)].join(" ")}`;
  const pageSchema = z.object({
    results: z.array(ticketSchema),
    meta: z.object({ has_more: z.boolean() }),
    links: z.object({ next: z.string().nullable() }),
  });
  const tickets = await fetchCompleteSearch(
    query,
    async (path): Promise<SearchExportPage<SolvedCsatTicket>> => {
      const result = pageSchema.safeParse(await read(path));
      if (!result.success) throw new Error("Invalid CSAT ticket export page");
      return result.data;
    },
    Math.min(budget, 100)
  );
  const metrics: SolvedCsatMetric[] = [];
  const metricPageSchema = z.object({ metric_sets: z.array(metricSchema) });
  for (let start = 0; start < tickets.length; start += 100) {
    const batch = tickets.slice(start, start + 100).map((ticket) => ticket.id);
    const result = metricPageSchema.safeParse(
      await read(`/tickets/show_many.json?ids=${batch.join(",")}&include=metric_sets`)
    );
    if (!result.success) throw new Error("Invalid CSAT metric-set response");
    const returned = new Set<number>();
    for (const metric of result.data.metric_sets) {
      if (!batch.includes(metric.ticket_id) || returned.has(metric.ticket_id))
        throw new Error("Conflicting CSAT metric-set coverage");
      returned.add(metric.ticket_id);
      metrics.push(metric);
    }
    if (returned.size !== batch.length) throw new Error("Incomplete CSAT metric-set coverage");
  }
  return {
    tickets,
    metrics,
    coverage: {
      complete: true as const,
      observationStartedAt,
      observationEndedAt: now().toISOString(),
      requests,
      population: "all-solved-satisfaction-states" as const,
      query,
      timeZone: scope.timeZone,
      periodStart: scope.periodStart,
      periodEnd: scope.periodEnd,
      groupIds: [...scope.groupIds],
      brandIds: scope.brandIds === null ? null : [...scope.brandIds],
      agentIds: [...scope.agentIds],
    },
  };
}
