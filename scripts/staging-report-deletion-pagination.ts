/** Synthetic read-only join rehearsal; no database access or vendor network. */
import assert from "node:assert/strict";
import { createReportJoinReader } from "../src/lib/connectors/zendesk-report-join-reader";
import { joinUpdaterSolvedReport } from "../src/lib/connectors/zendesk-updater-solved-join";
import { calculateTicketReportCredits } from "../src/lib/connectors/zendesk-ticket-report-credits";

async function main() {
  await import("./assert-main-preview.mjs");
  globalThis.fetch = async () => {
    throw Error("Vendor network forbidden in rehearsal");
  };
  let requests = 0;
  const reader = createReportJoinReader(
    { subdomain: "synthetic", email: "source@example.invalid", apiKey: "synthetic-no-access" },
    "zendesk-account:synthetic",
    {
      spacingMs: 0,
      requestBudget: 3,
      request: async (input, init) => {
        requests++;
        const url = new URL(String(input));
        assert.equal(url.origin, "https://synthetic.zendesk.com");
        assert.equal(init?.method, "GET");
        assert.equal(init?.redirect, "error");
        if (requests === 1) {
          assert.equal(url.pathname, "/api/v2/tickets/show_many.json");
          return Response.json({
            tickets: [{ id: 100, group_id: 10, brand_id: 20, status: "solved" }],
            metric_sets: [{ ticket_id: 100, solved_at: "2026-09-29T12:00:00Z" }],
          });
        }
        assert.equal(url.pathname, "/api/v2/deleted_tickets.json");
        assert.equal(url.searchParams.get("per_page"), "100");
        assert.equal(url.searchParams.get("sort_order"), "desc");
        return requests === 2
          ? Response.json({
              deleted_tickets: [{ id: 999, deleted_at: "2026-10-05T00:00:00Z" }],
              next_page:
                "https://synthetic.zendesk.com/api/v2/deleted_tickets.json?page=2&sort_by=deleted_at&sort_order=desc",
            })
          : Response.json({
              deleted_tickets: [{ id: 101, deleted_at: "2026-10-04T00:00:00Z" }],
              next_page: null,
            });
      },
    }
  );
  const scope = {
    periodStart: "2026-09-27",
    periodEnd: "2026-10-03",
    timeZone: "America/Chicago",
    agentIds: [42, 43],
    groupIds: [10],
    brandIds: [20],
    dateBasis: "update-created" as const,
    groupBasis: "current-ticket-group" as const,
    attribution: "updater-account" as const,
  };
  const snapshot = await joinUpdaterSolvedReport(
    {
      events: [100, 101].map((ticket_id, i) => ({
        id: i + 1,
        ticket_id,
        updater_id: 42,
        created_at: "2026-09-29T12:00:00Z",
        child_events: [
          { id: i + 10, event_type: "Change", status: "solved", previous_value: "open" },
        ],
      })),
      identities: [42, 43].map((id) => ({ id, role: "agent" })),
      coverage: {
        start: "2026-09-27T05:00:00Z",
        endExclusive: "2026-10-04T05:00:00Z",
        complete: true,
      },
    },
    scope,
    reader,
    () => new Date("2026-10-08T12:00:00Z")
  );
  assert.equal(snapshot.deletedTickets.length, 1);
  const calculated = calculateTicketReportCredits(snapshot, scope);
  assert.deepEqual(
    calculated.agents.map((a) => [a.agentUpdateEvents, a.ticketsSolvedCredits]),
    [
      [1, 1],
      [0, 0],
    ]
  );
  assert.equal(requests, 3);
  console.log(
    JSON.stringify({
      verified: true,
      synthetic: true,
      simulatedRequests: requests,
      vendorRequests: 0,
      databaseWrites: 0,
      verifiedValues: 4,
      explicitDeletionTombstones: 1,
      unknownParentsDiscarded: 0,
    })
  );
}
main().catch(() => {
  console.error("Synthetic deletion continuation rehearsal failed");
  process.exitCode = 1;
});
