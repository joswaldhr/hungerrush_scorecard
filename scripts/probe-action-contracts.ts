/** Read-only shadow calculation. No database imports or writes; output contains no source IDs. */
import { writeFile } from "node:fs/promises";
import {
  fetchTicketActions,
  summarizeTicketActions,
} from "../src/lib/connectors/zendesk-ticket-actions";
import { fetchAgentLegs, summarizeAgentLegs } from "../src/lib/connectors/zendesk-agent-legs";
import { zendeskGet, type RequestStats } from "../src/lib/connectors/zendesk-shared";

async function main() {
  const day = process.argv[2];
  const output = process.argv[3];
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !output) {
    throw new Error(
      "Usage: tsx --env-file=.env scripts/probe-action-contracts.ts YYYY-MM-DD output.json"
    );
  }
  const start = new Date(`${day}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== day)
    throw new Error("Invalid day");
  const periodEnd = start.getTime() + 86_400_000;
  const cutoff = new Date(Math.min(periodEnd, Date.now() - 120_000));
  if (cutoff <= start) throw new Error("Interval must be older than two minutes");
  const stats: RequestStats = { requests: 0, retries429: 0, backoffWaitMs: 0 };
  const get = (path: string) => zendeskGet<unknown>(path, stats);
  const tickets = await fetchTicketActions(start, cutoff, get, 50);
  const calls = await fetchAgentLegs(day, day, get, 50);
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
    const result = await zendeskGet<{ users: Array<{ id: number; role: string }> }>(
      `/users/show_many.json?ids=${ids.slice(i, i + 100).join(",")}`,
      stats
    );
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
        (sum, a) => sum + (a.ticketsUpdated ?? 0),
        0
      ),
      sumOfKnownAgentDistinctResolvedTickets: ticketSummary.agents.reduce(
        (sum, a) => sum + (a.ticketsResolved ?? 0),
        0
      ),
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
main().catch((error: unknown) => {
  // Avoid source response bodies and request URLs in a probe failure report.
  console.error(error instanceof Error ? error.name : "Action probe failed");
  process.exitCode = 1;
});
