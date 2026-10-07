// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  teams,
  employees,
  dataSources,
  externalIdentities,
  metricDefinitions,
  metricAssignments,
  metricValues,
  normalizedFacts,
  sourceRecords,
  syncRuns,
  syncErrors,
  syncRevisions,
} from "@/lib/db/schema";
import { runSync } from "@/lib/connectors/sync-engine";
import { createSolvedPublisher } from "@/lib/connectors/zendesk-solved-publisher";
import { solvedPublicationFixture } from "./fixtures/solved-publication";

const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID(),
  employee = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const defs = [
  "zendesk_tickets_solved_credits",
  "zendesk_assignee_solved_tickets",
  "tickets_resolved",
].map((key) => ({ id: randomUUID(), key }));
const ids = defs.map((d) => d.id);
const fixture = () => solvedPublicationFixture(config, employee, team);
const values = () =>
  db.select().from(metricValues).where(inArray(metricValues.metricDefinitionId, ids));
const current = async (index = 0) =>
  (await values()).find((v) => v.metricDefinitionId === ids[index]);
function publisher(f = fixture(), mutate?: () => Promise<void>, now?: () => Date) {
  return createSolvedPublisher(
    f.policy,
    async () => {
      await mutate?.();
      return {
        snapshot: f.snapshot,
        observationStartedAt: f.identity.observationStartedAt,
        identities: new Map([["agent", 42]]),
      };
    },
    now
  );
}
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Synthetic solved publication" });
  await db
    .insert(teams)
    .values({ id: team, organizationId: org, name: "Synthetic team", slug: team });
  await db.insert(employees).values({
    id: employee,
    organizationId: org,
    primaryTeamId: team,
    displayName: "Synthetic staff",
  });
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "zendesk",
    displayName: "Synthetic source",
    status: "configured",
    configurationReference: "zendesk-account:synthetic",
  });
  await db.insert(externalIdentities).values({
    employeeId: employee,
    dataSourceId: source,
    externalId: "agent",
    externalEntityType: "agent",
    matchMethod: "manual",
  });
  await db.insert(metricDefinitions).values(
    defs.map((d) => ({
      ...d,
      organizationId: org,
      name: d.key,
      sourceStrategy: "zendesk",
      unit: "tickets",
      valueType: "count",
      calculationType: "sum",
    }))
  );
  await db
    .insert(metricAssignments)
    .values(ids.map((metricDefinitionId) => ({ metricDefinitionId, teamId: team })));
  const f = fixture();
  await db.insert(metricValues).values({
    metricDefinitionId: ids[2]!,
    employeeId: employee,
    teamId: team,
    periodStart: f.periodStart,
    periodEnd: f.periodEnd,
    numericValue: null,
    qualityStatus: "unverified_attribution",
  });
});
afterAll(async () => {
  await db.delete(metricValues).where(inArray(metricValues.metricDefinitionId, ids));
  await db.delete(normalizedFacts).where(eq(normalizedFacts.organizationId, org));
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  const runs = db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(eq(syncRuns.dataSourceId, source));
  await db.delete(syncRevisions).where(inArray(syncRevisions.syncRunId, runs));
  await db.delete(syncErrors).where(inArray(syncErrors.syncRunId, runs));
  await db.delete(syncRuns).where(eq(syncRuns.dataSourceId, source));
  await db.delete(metricAssignments).where(inArray(metricAssignments.metricDefinitionId, ids));
  await db.delete(metricDefinitions).where(inArray(metricDefinitions.id, ids));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, source));
  await db.delete(employees).where(eq(employees.id, employee));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(teams).where(eq(teams.id, team));
  await db.delete(organizations).where(eq(organizations.id, org));
});
describe.sequential("solved-only publication through PostgreSQL", () => {
  it("publishes a recomputed solved count without touching legacy human-only values", async () => {
    const legacy = await current(2);
    const result = await runSync(publisher(), config, { weekOffset: 1 });
    expect(result.success).toBe(true);
    expect(result.valuesWritten).toBe(1);
    expect(await current()).toMatchObject({
      numericValue: 1,
      qualityStatus: "complete",
      calculationVersion: 1,
      provenanceJson: { sourceContract: "zendesk-qualified-updater-solved-credits-v1" },
    });
    expect(await current(2)).toEqual(legacy);
    const facts = await db
      .select()
      .from(normalizedFacts)
      .where(eq(normalizedFacts.organizationId, org));
    expect(facts.map((f) => f.factType)).toEqual(["zendesk_tickets_solved_credits"]);
  });
  it("retains the previous value and all publication rows when evidence is incomplete", async () => {
    const before = await values(),
      f = fixture();
    f.snapshot.coverage.complete = false;
    const result = await runSync(publisher(f), config, { weekOffset: 1 });
    expect(result.success).toBe(false);
    expect(await values()).toEqual(before);
    expect(
      await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
    ).toHaveLength(0);
  });
  it("publishes numeric zero as a correction and retains predecessor revisions", async () => {
    const f = fixture();
    f.snapshot.events = [];
    const result = await runSync(publisher(f), config, { weekOffset: 1 });
    expect(result.success).toBe(true);
    expect(await current()).toMatchObject({ numericValue: 0, qualityStatus: "complete" });
    expect(
      (await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId)))
        .length
    ).toBeGreaterThan(0);
  });
  it("keeps assignee solved contributions distinct and does not double-count refreshes", async () => {
    const f = fixture();
    f.policy = { ...f.policy, kind: "assignee-solved", groupIds: null, brandIds: null };
    expect((await runSync(publisher(f), config, { weekOffset: 1 })).success).toBe(true);
    expect((await runSync(publisher(f), config, { weekOffset: 1 })).success).toBe(true);
    expect(await current(1)).toMatchObject({
      numericValue: 1,
      provenanceJson: { sourceContract: "zendesk-qualified-assignee-solved-tickets-v1" },
    });
    expect(await current()).toMatchObject({ numericValue: 0 });
  });
  it("rechecks assignments after collection and rolls back incompatible publication", async () => {
    const before = await values();
    const result = await runSync(
      publisher(fixture(), async () => {
        await db
          .update(metricDefinitions)
          .set({ unit: "wrong" })
          .where(eq(metricDefinitions.id, ids[0]!));
      }),
      config,
      { weekOffset: 1 }
    );
    try {
      expect(result.success).toBe(false);
      expect(await values()).toEqual(before);
      expect(
        await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
      ).toHaveLength(0);
    } finally {
      await db
        .update(metricDefinitions)
        .set({ unit: "tickets" })
        .where(eq(metricDefinitions.id, ids[0]!));
    }
  });
  it("rejects staff departures between collection and commit", async () => {
    const before = await values();
    const result = await runSync(
      publisher(fixture(), async () => {
        await db
          .update(employees)
          .set({ employmentStatus: "inactive" })
          .where(eq(employees.id, employee));
      }),
      config,
      { weekOffset: 1 }
    );
    try {
      expect(result.success).toBe(false);
      expect(await values()).toEqual(before);
    } finally {
      await db
        .update(employees)
        .set({ employmentStatus: "active" })
        .where(eq(employees.id, employee));
    }
  });
  it("rejects modified records and captures that expire before commit", async () => {
    const before = await values();
    const tampered = publisher();
    const fetch = tampered.fetchRecords.bind(tampered);
    tampered.fetchRecords = async (config, ctx) => {
      const result = await fetch(config, ctx);
      result.records[0]!.payload.periodEnd = "2099-01-01";
      return result;
    };
    expect((await runSync(tampered, config, { weekOffset: 1 })).success).toBe(false);
    let calls = 0;
    const expiring = publisher(
      fixture(),
      undefined,
      () => new Date(Date.now() + (calls++ ? 3600000 : 0))
    );
    expect((await runSync(expiring, config, { weekOffset: 1 })).success).toBe(false);
    expect(await values()).toEqual(before);
  });
});
