/** Read-only shadow calculation. No database imports or writes; output contains no source IDs. */
import { writeFile } from "node:fs/promises";
import { z } from "zod";
import {
  fetchTicketActions,
  summarizeTicketActions,
} from "../src/lib/connectors/zendesk-ticket-actions";
import { fetchAgentLegs, summarizeAgentLegs } from "../src/lib/connectors/zendesk-agent-legs";
import { zendeskGet, type RequestStats } from "../src/lib/connectors/zendesk-shared";

let stage = "arguments";
const stats: RequestStats = { requests: 0, retries429: 0, backoffWaitMs: 0 };
function enterStage(next: string, counts?: Record<string, number>) {
  stage = next;
  console.log(JSON.stringify({ stage, ...counts, requests: stats.requests }));
}

async function main() {
  const day = process.argv[2];
  const output = process.argv[3];
  const endDay = process.argv[4] ?? day;
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !output) {
    throw new Error(
      "Usage: tsx --env-file=.env scripts/probe-action-contracts.ts YYYY-MM-DD output.json [inclusive-end-date]"
    );
  }
  const start = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day)
    throw new Error("Invalid day");
  if (!z.iso.date().safeParse(endDay).success) throw new Error("Invalid end date");
  const end = new Date(`${endDay}T00:00:00Z`);
  const days = (end.getTime() - start.getTime()) / 86_400_000 + 1;
  if (days < 1 || days > 7) throw new Error("Probe interval must contain one to seven days");
  const periodEnd = end.getTime() + 86_400_000;
  const cutoff = new Date(Math.min(periodEnd, Date.now() - 120_000));
  if (cutoff <= start) throw new Error("Interval must be older than two minutes");
  const get = (path: string) => zendeskGet<unknown>(path, stats);
  enterStage("ticket_export");
  const tickets = await fetchTicketActions(start, cutoff, get, 50 * days);
  if (tickets.coverage !== "complete") throw new Error("Probe requires complete source coverage");
  enterStage("call_legs", { ticketEvents: tickets.events.length, ticketPages: tickets.pages });
  const calls = await fetchAgentLegs(day, endDay!, get, 50 * days);
  enterStage("actor_lookup", { callLegs: calls.legs.length, callPages: calls.pages });
  // Verify actor roles at the source. These are Zendesk agents, not a claim of Cadence identity mapping.
  const ids = [
    ...new Set(
      [
        ...tickets.events.map((event) => event.updater_id),
        ...calls.legs.filter((leg) => leg.type === "agent").map((leg) => leg.agent_id),
      ].filter((id): id is number => id !== null && id > 0)
    ),
  ];
  const agents = new Set<number>();
  for (let i = 0; i < ids.length; i += 100) {
    const result = z
      .object({
        users: z.array(
          z.object({
            id: z.number().int().positive().safe(),
            role: z.enum(["agent", "admin", "end-user"]),
          })
        ),
      })
      .parse(
        await zendeskGet<unknown>(
          `/users/show_many.json?ids=${ids.slice(i, i + 100).join(",")}`,
          stats
        )
      );
    const requested = new Set(ids.slice(i, i + 100));
    const received = new Set(result.users.map((user) => user.id));
    if (
      result.users.length !== requested.size ||
      received.size !== requested.size ||
      [...received].some((id) => !requested.has(id))
    )
      throw new Error("Actor lookup incomplete or inconsistent");
    for (const user of result.users)
      if (user.role === "agent" || user.role === "admin") agents.add(user.id);
  }
  const ticketSummary = summarizeTicketActions(tickets, agents);
  const legSummary = summarizeAgentLegs(calls.legs, agents);
  const witnesses = tickets.events
    .filter(
      (event) =>
        event.updater_id !== null &&
        agents.has(event.updater_id) &&
        event.child_events.some(
          (child) =>
            child.event_type === "Change" &&
            child.status === "solved" &&
            child.previousStatus !== null &&
            ["new", "open", "pending", "hold"].includes(child.previousStatus)
        )
    )
    .slice(0, 3);
  let matchedAudits = 0;
  enterStage("audit_spot_check", { eligibleActors: agents.size });
  for (const witness of witnesses) {
    const { audit } = await zendeskGet<{
      audit: {
        id: number;
        author_id: number;
        created_at: string;
        events: Array<{
          id: number;
          type: string;
          field_name?: string;
          value?: unknown;
          previous_value?: unknown;
        }>;
      };
    }>(`/tickets/${witness.ticket_id}/audits/${witness.id}.json`, stats);
    const changes = witness.child_events.filter(
      (child) => child.event_type === "Change" && child.status === "solved"
    );
    if (
      audit.id === witness.id &&
      audit.author_id === witness.updater_id &&
      Date.parse(audit.created_at) === Date.parse(witness.created_at) &&
      changes.every((child) =>
        audit.events.some(
          (event) =>
            event.id === child.id &&
            event.type === "Change" &&
            event.field_name === "status" &&
            event.value === "solved" &&
            event.previous_value === child.previousStatus
        )
      )
    )
      matchedAudits++;
  }
  const report = {
    observedAt: new Date().toISOString(),
    mode: "read-only shadow; no metric publication or target evaluation",
    day,
    inclusiveEndDay: endDay,
    intervalDays: days,
    agentScope: "source-verified current agent/admin roles; not Cadence employee identity mapping",
    ticketWindow: {
      start: start.toISOString(),
      endExclusive: cutoff.toISOString(),
      coverage: tickets.coverage,
      pages: tickets.pages,
      observedThrough: tickets.observedThrough,
    },
    ticketActions: {
      contract: ticketSummary.contract,
      events: tickets.events.length,
      excludedEvents: ticketSummary.excludedEvents,
      sumOfAgentDistinctUpdatedTickets: ticketSummary.agents.reduce(
        (sum: number | null, a) =>
          sum === null || a.ticketsUpdated === null ? null : sum + a.ticketsUpdated,
        0 as number | null
      ),
      sumOfAgentDistinctResolvedTickets: ticketSummary.agents.reduce(
        (sum: number | null, a) =>
          sum === null || a.ticketsResolved === null ? null : sum + a.ticketsResolved,
        0 as number | null
      ),
      humanAttribution:
        "No reviewed child-level attribution supplied; uncertainty remains unavailable",
      agentsWithUnavailableUpdatedCount: ticketSummary.agents.filter(
        (a) => a.ticketsUpdated === null
      ).length,
      agentsWithUnavailableResolvedCount: ticketSummary.agents.filter(
        (a) => a.ticketsResolved === null
      ).length,
      uncertainResolutionEvents: ticketSummary.agents.reduce(
        (sum, a) => sum + a.uncertainResolutions,
        0
      ),
      auditSpotCheck: {
        sampled: witnesses.length,
        matched: matchedAudits,
        scope: "separate per-ticket audit endpoint; not full independent reconciliation",
      },
    },
    callLegs: {
      contract: legSummary.contract,
      pages: calls.pages,
      records: calls.legs.length,
      window: "UTC created-date cohort through fetch; current day remains provisional",
      completed: legSummary.agents.reduce((sum, a) => sum + a.completedLegs, 0),
      missed: legSummary.agents.reduce((sum, a) => sum + a.missedLegs, 0),
      declined: legSummary.agents.reduce((sum, a) => sum + a.declinedLegs, 0),
      transferDeclined: legSummary.agents.reduce((sum, a) => sum + a.transferDeclinedLegs, 0),
      unreachable: legSummary.agents.reduce((sum, a) => sum + a.unreachableLegs, 0),
    },
    requests: stats,
  };
  await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}
main().catch(async (error: unknown) => {
  // Avoid source response bodies and request URLs in a probe failure report.
  const message = error instanceof Error ? error.message : "";
  const knownReason =
    ["Actor lookup incomplete or inconsistent", "Probe requires complete source coverage"].includes(
      message
    ) ||
    message.startsWith("Zendesk Talk incomplete:") ||
    message.startsWith("Ticket action export")
      ? message
      : "See failure stage; raw error omitted";
  const failure = {
    observedAt: new Date().toISOString(),
    status: "failed",
    stage,
    reason: knownReason,
    errorType: error instanceof Error ? error.name : "Unknown",
    requests: stats,
  };
  if (process.argv[3])
    await writeFile(`${process.argv[3]}.failure.json`, JSON.stringify(failure, null, 2) + "\n");
  console.error(JSON.stringify(failure));
  process.exitCode = 1;
});
