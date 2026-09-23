// @vitest-environment node
import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, employees, dataSources, externalIdentities } from "@/lib/db/schema";
vi.mock("@/lib/connectors/zendesk-shared", () => ({
  zendeskGet: async () => ({ users: [{ id: 7, email: "synthetic-shared@example.test" }] }),
}));
import { ZendeskConnector } from "@/lib/connectors/zendesk";

it("resolves a repeated external email only within the configured source", async () => {
  const orgs = [randomUUID(), randomUUID()];
  const sources = [randomUUID(), randomUUID()];
  const people = [randomUUID(), randomUUID()];
  try {
    await db
      .insert(organizations)
      .values(orgs.map((id) => ({ id, name: "Synthetic identity scope" })));
    await db
      .insert(employees)
      .values(
        people.map((id, i) => ({ id, organizationId: orgs[i]!, displayName: "Synthetic employee" }))
      );
    await db
      .insert(dataSources)
      .values(
        sources.map((id, i) => ({
          id,
          organizationId: orgs[i]!,
          type: "zendesk",
          displayName: "Synthetic source",
        }))
      );
    await db
      .insert(externalIdentities)
      .values(
        sources.map((id, i) => ({
          dataSourceId: id,
          employeeId: people[i]!,
          externalId: "synthetic-shared@example.test",
          externalEntityType: "user",
          matchMethod: "manual",
        }))
      );
    const connector = new ZendeskConnector();
    for (let i = 0; i < 2; i++) {
      const result = await connector.resolveIdentities(
        { organizationId: orgs[i]!, dataSourceId: sources[i]! },
        ["synthetic-shared@example.test"]
      );
      expect(result.map((match) => match.employeeId)).toEqual([people[i]]);
    }
  } finally {
    await db.delete(externalIdentities).where(inArray(externalIdentities.dataSourceId, sources));
    await db.delete(dataSources).where(inArray(dataSources.id, sources));
    await db.delete(employees).where(inArray(employees.id, people));
    await db.delete(organizations).where(inArray(organizations.id, orgs));
  }
});
