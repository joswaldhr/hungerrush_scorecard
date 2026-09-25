// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  teams,
  employees,
  externalIdentities,
  dataSources,
  metricDefinitions,
  metricAssignments,
} from "@/lib/db/schema";
vi.mock("@/lib/env", () => ({ env: { ZENDESK_SUBDOMAIN: "synthetic" } }));
import { loadCsatEmployeeBindings } from "@/lib/connectors/zendesk-csat-connector";
import { parseZendeskCsatPolicy } from "@/lib/connectors/zendesk-csat-policy";
const org = randomUUID(),
  team = randomUUID(),
  otherTeam = randomUUID(),
  employee = randomUUID(),
  source = randomUUID(),
  score = randomUUID(),
  response = randomUUID(),
  identity = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const policy = parseZendeskCsatPolicy(
  JSON.stringify({
    schemaVersion: 1,
    ...config,
    accountReference: "zendesk-account:synthetic",
    reportingTimeZone: "America/Chicago",
    effectivePeriodStart: "2026-09-20",
    teams: [
      {
        teamId: team,
        groupIds: [20],
        brandIds: null,
        metricKeys: ["csat_score", "csat_response_rate"],
      },
    ],
  }),
  "synthetic"
)!;
const sourceIdentity = {
  id: identity,
  dataSourceId: source,
  employeeId: employee,
  externalId: "synthetic@example.test",
  externalEntityType: "user",
  matchMethod: "manual",
};
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "CSAT binding fixture" });
  await db.insert(teams).values([
    { id: team, organizationId: org, name: "Synthetic team", slug: team },
    { id: otherTeam, organizationId: org, name: "Another team", slug: otherTeam },
  ]);
  await db.insert(employees).values({
    id: employee,
    organizationId: org,
    primaryTeamId: team,
    displayName: "Synthetic employee",
  });
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "zendesk",
    displayName: "Synthetic source",
    status: "configured",
    configurationReference: "zendesk-account:synthetic",
  });
  await db.insert(externalIdentities).values(sourceIdentity);
  await db.insert(metricDefinitions).values([
    { id: score, organizationId: org, key: "csat_score", name: "Score", sourceStrategy: "zendesk" },
    {
      id: response,
      organizationId: org,
      key: "csat_response_rate",
      name: "Response",
      sourceStrategy: "zendesk",
    },
  ]);
  await db.insert(metricAssignments).values([
    { metricDefinitionId: score, teamId: team },
    { metricDefinitionId: response, teamId: team },
  ]);
});
afterAll(async () => {
  await db
    .delete(metricAssignments)
    .where(inArray(metricAssignments.metricDefinitionId, [score, response]));
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, [score, response]));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(employees).where(eq(employees.id, employee));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(inArray(teams.id, [team, otherTeam]));
  await db.delete(organizations).where(eq(organizations.id, org));
});
it("requires source/account/organization ownership before resolving active employees", async () => {
  expect(await loadCsatEmployeeBindings(policy, config, "2026-09-20")).toEqual([
    { employeeId: employee, teamId: team, externalId: "synthetic@example.test" },
  ]);
  await expect(
    loadCsatEmployeeBindings(policy, { ...config, organizationId: randomUUID() }, "2026-09-20")
  ).rejects.toThrow(/organization/);
  await db
    .update(dataSources)
    .set({ configurationReference: null })
    .where(eq(dataSources.id, source));
  try {
    await expect(loadCsatEmployeeBindings(policy, config, "2026-09-20")).rejects.toThrow(/binding/);
  } finally {
    await db
      .update(dataSources)
      .set({ configurationReference: "zendesk-account:synthetic" })
      .where(eq(dataSources.id, source));
  }
});
it("rejects missing identities and assignments not represented by the policy", async () => {
  await db.delete(externalIdentities).where(eq(externalIdentities.id, identity));
  try {
    await expect(loadCsatEmployeeBindings(policy, config, "2026-09-20")).rejects.toThrow(
      /identity/
    );
  } finally {
    await db.insert(externalIdentities).values(sourceIdentity);
  }
  const [extra] = await db
    .insert(metricAssignments)
    .values({ metricDefinitionId: score, teamId: otherTeam })
    .returning();
  try {
    await expect(loadCsatEmployeeBindings(policy, config, "2026-09-20")).rejects.toThrow(
      /no matching team policy/
    );
  } finally {
    await db.delete(metricAssignments).where(eq(metricAssignments.id, extra!.id));
  }
  const [duplicate] = await db
    .insert(metricAssignments)
    .values({ metricDefinitionId: score, teamId: team })
    .returning();
  try {
    await expect(loadCsatEmployeeBindings(policy, config, "2026-09-20")).rejects.toThrow(
      /ambiguous/
    );
  } finally {
    await db.delete(metricAssignments).where(eq(metricAssignments.id, duplicate!.id));
  }
});
