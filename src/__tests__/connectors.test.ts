import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/db/schema", () => ({ externalIdentities: {}, employees: {} }));
vi.mock("drizzle-orm", () => ({ eq: vi.fn() }));

import { ZendeskMockConnector } from "@/lib/connectors/zendesk-mock";
import type { ConnectorConfig } from "@/lib/connectors/types";

const mockConfig: ConnectorConfig = {
  dataSourceId: "50000000-0000-4000-8000-000000000001",
  organizationId: "10000000-0000-4000-8000-000000000001",
};

describe("ZendeskMockConnector", () => {
  const connector = new ZendeskMockConnector();

  it("has sourceType zendesk", () => {
    expect(connector.sourceType).toBe("zendesk");
  });

  it("healthCheck returns connected", async () => {
    const health = await connector.healthCheck(mockConfig);
    expect(health.connected).toBe(true);
  });

  it("normalizeRecords produces tickets_resolved from agent_stats", () => {
    const facts = connector.normalizeRecords(
      [
        {
          sourceRecordId: "sr-1",
          payload: {
            agentId: "zd-1",
            ticketsResolved: 42,
            avgHandleTimeMinutes: 12.5,
            firstContactResolutionPct: 78,
            backlogCount: 5,
          },
        },
      ],
      "emp-1",
      "team-1",
      "2026-08-17",
      "2026-08-23"
    );

    expect(facts.length).toBe(4);
    expect(facts.map((f) => f.factType).sort()).toEqual([
      "avg_handle_time",
      "backlog_count",
      "first_contact_resolution",
      "tickets_resolved",
    ]);

    const tickets = facts.find((f) => f.factType === "tickets_resolved")!;
    expect(tickets.numericValue).toBe(42);
    expect(tickets.employeeId).toBe("emp-1");
    expect(tickets.periodStart).toBe("2026-08-17");
  });

  it("normalizeRecords produces csat_score from csat_summary", () => {
    const facts = connector.normalizeRecords(
      [{ sourceRecordId: "sr-2", payload: { csatScore: 92.5, totalRatings: 30 } }],
      "emp-1",
      null,
      "2026-08-17",
      "2026-08-23"
    );

    expect(facts.length).toBe(1);
    expect(facts[0]!.factType).toBe("csat_score");
    expect(facts[0]!.numericValue).toBe(92.5);
  });

  it("normalizeRecords preserves employee and period", () => {
    const facts = connector.normalizeRecords(
      [{ sourceRecordId: "sr-3", payload: { ticketsResolved: 10, avgHandleTimeMinutes: 8 } }],
      "emp-99",
      "team-5",
      "2026-01-01",
      "2026-01-07"
    );

    for (const fact of facts) {
      expect(fact.employeeId).toBe("emp-99");
      expect(fact.teamId).toBe("team-5");
      expect(fact.periodStart).toBe("2026-01-01");
      expect(fact.periodEnd).toBe("2026-01-07");
    }
  });
});

describe("Connector interface contract", () => {
  const connector = new ZendeskMockConnector();

  it("ZendeskMockConnector implements full interface", () => {
    expect(typeof connector.healthCheck).toBe("function");
    expect(typeof connector.fetchRecords).toBe("function");
    expect(typeof connector.normalizeRecords).toBe("function");
    expect(typeof connector.resolveIdentities).toBe("function");
    expect(typeof connector.sourceType).toBe("string");
  });
});
