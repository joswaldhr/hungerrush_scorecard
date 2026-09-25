/**
 * Diagnostic reference only. Deliberately imports no connector, normalization,
 * attribution or publication code. Results describe the supplied snapshot;
 * callers must establish source completeness and observation alignment separately.
 */
export interface ReferenceTicket {
  id: number;
  assignee_id: number | null;
  group_id: number | null;
  created_at: string;
  satisfaction_rating?: { score: string } | null;
}

export interface ReferenceTicketMetric {
  ticket_id: number;
  solved_at: string | null;
  reply_time_in_minutes: { business: number | null; calendar: number | null } | null;
}

export interface ReferenceScope {
  startDay: string;
  endDay: string;
  timeZone: string;
  assigneeId: number;
  /** null explicitly means all groups; [] explicitly selects no groups. */
  groupIds: number[] | null;
}

function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid reference day");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error("Invalid reference day");
}

function timestamp(value: string) {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new Error("Reference timestamps must include an offset");
  return new Date(value);
}

function prepare(
  tickets: ReferenceTicket[],
  metrics: ReferenceTicketMetric[],
  scope: ReferenceScope
) {
  validDay(scope.startDay);
  validDay(scope.endDay);
  if (scope.startDay > scope.endDay) throw new Error("Reversed reference interval");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: scope.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const inPeriod = (value: string) => {
    const parts = formatter.formatToParts(timestamp(value));
    const part = (name: string) => parts.find((p) => p.type === name)!.value;
    const day = `${part("year")}-${part("month")}-${part("day")}`;
    return day >= scope.startDay && day <= scope.endDay;
  };
  const ticketIds = new Set<number>();
  for (const ticket of tickets) {
    if (!Number.isSafeInteger(ticket.id) || ticket.id <= 0 || ticketIds.has(ticket.id))
      throw new Error("Invalid or duplicate reference ticket ID");
    ticketIds.add(ticket.id);
  }
  const byTicket = new Map<number, ReferenceTicketMetric>();
  for (const metric of metrics) {
    if (
      !Number.isSafeInteger(metric.ticket_id) ||
      metric.ticket_id <= 0 ||
      byTicket.has(metric.ticket_id)
    )
      throw new Error("Invalid or duplicate reference metric ID");
    byTicket.set(metric.ticket_id, metric);
  }
  const selected = tickets.filter(
    (t) =>
      t.assignee_id === scope.assigneeId &&
      (scope.groupIds === null || (t.group_id !== null && scope.groupIds.includes(t.group_id)))
  );
  for (const ticket of selected)
    if (!byTicket.has(ticket.id)) throw new Error("Incomplete reference metric-set coverage");
  return { selected, byTicket, inPeriod };
}

/** Created-ticket cohort, current assignee, explicit timezone; no last-update filter. */
export function referenceFirstReply(
  tickets: ReferenceTicket[],
  metrics: ReferenceTicketMetric[],
  scope: ReferenceScope,
  clock: "business" | "calendar"
) {
  const { selected, byTicket, inPeriod } = prepare(tickets, metrics, scope);
  const cohort = selected.filter((t) => inPeriod(t.created_at));
  const samples: Array<{ ticketId: number; minutes: number }> = [];
  for (const ticket of cohort) {
    const pair = byTicket.get(ticket.id)!.reply_time_in_minutes;
    const value = pair === null ? null : pair[clock];
    if (value === null) continue;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
      throw new Error("Invalid reference reply duration");
    samples.push({ ticketId: ticket.id, minutes: value });
  }
  const numerator = samples.reduce((sum, sample) => sum + sample.minutes, 0);
  const sorted = samples.map((s) => s.minutes).sort((a, b) => a - b);
  return {
    cohortIds: cohort.map((t) => t.id).sort((a, b) => a - b),
    measuredIds: samples.map((s) => s.ticketId).sort((a, b) => a - b),
    numerator,
    denominator: samples.length,
    missingDurationCount: cohort.length - samples.length,
    meanMinutes: samples.length ? numerator / samples.length : null,
    medianMinutes: samples.length
      ? (sorted[Math.floor((sorted.length - 1) / 2)]! +
          sorted[Math.ceil((sorted.length - 1) / 2)]!) /
        2
      : null,
    zeroCount: samples.filter((s) => s.minutes === 0).length,
  };
}

/** Explore Support: Tickets semantics; offered is not delivery confirmation. */
export function referenceSolvedCsat(
  tickets: ReferenceTicket[],
  metrics: ReferenceTicketMetric[],
  scope: ReferenceScope
) {
  const { selected, byTicket, inPeriod } = prepare(tickets, metrics, scope);
  const cohort = selected.filter((t) => {
    const solved = byTicket.get(t.id)!.solved_at;
    if (solved === null) return false;
    if (typeof solved !== "string") throw new Error("Missing reference solved timestamp");
    return inPeriod(solved);
  });
  const goodIds: number[] = [];
  const badIds: number[] = [];
  const surveyedIds: number[] = [];
  for (const ticket of cohort) {
    const score = ticket.satisfaction_rating?.score ?? null;
    if (score === null || score === "unoffered") continue;
    if (!["offered", "good", "bad"].includes(score))
      throw new Error("Unknown reference satisfaction score");
    surveyedIds.push(ticket.id);
    if (score === "good") goodIds.push(ticket.id);
    if (score === "bad") badIds.push(ticket.id);
  }
  const rated = goodIds.length + badIds.length;
  return {
    cohortIds: cohort.map((t) => t.id).sort((a, b) => a - b),
    goodIds: goodIds.sort((a, b) => a - b),
    badIds: badIds.sort((a, b) => a - b),
    surveyedIds: surveyedIds.sort((a, b) => a - b),
    good: goodIds.length,
    bad: badIds.length,
    rated,
    surveyed: surveyedIds.length,
    satisfactionPercent: rated ? (100 * goodIds.length) / rated : null,
    responsePercent: surveyedIds.length ? (100 * rated) / surveyedIds.length : null,
  };
}
