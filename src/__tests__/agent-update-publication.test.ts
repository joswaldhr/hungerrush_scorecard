// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
import { createAgentUpdatePublisher } from "@/lib/connectors/zendesk-agent-update-publisher";
import { solvedPublicationFixture } from "./fixtures/solved-publication";
const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID(),
  employee = randomUUID();
const config = { organizationId: org, dataSourceId: source };
const defs = [
  "zendesk_agent_update_events",
  "zendesk_tickets_solved_credits",
  "tickets_updated",
].map((key) => ({ id: randomUUID(), key }));
const ids = defs.map((d) => d.id),
  subdomain = `updates-${randomUUID()}`;
function fixture() {
  const f = solvedPublicationFixture(config, employee, team);
  return {
    ...f,
    policy: {
      ...f.policy,
      kind: "agent-updates" as const,
      groupIds: [10],
      subdomain,
      accountReference: `zendesk-account:${subdomain}`,
    },
  };
}
function publisher(f = fixture(), duringFetch?: () => Promise<void>, now?: () => Date) {
  return createAgentUpdatePublisher(
    f.policy,
    async () => {
      await duringFetch?.();
      return {
        snapshot: f.snapshot,
        identities: new Map([["agent", 42]]),
        observationStartedAt: f.identity.observationStartedAt,
      };
    },
    now
  );
}
const values = () =>
  db
    .select()
    .from(metricValues)
    .where(inArray(metricValues.metricDefinitionId, ids))
    .orderBy(metricValues.id);
beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Synthetic update publication" });
  await db
    .insert(teams)
    .values({ id: team, organizationId: org, name: "Synthetic team", slug: team });
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
    configurationReference: `zendesk-account:${subdomain}`,
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
      sourceStrategy: "zendesk" as const,
      unit: d.key === "zendesk_agent_update_events" ? "updates" : "tickets",
      valueType: "count" as const,
      calculationType: "sum" as const,
    }))
  );
  await db
    .insert(metricAssignments)
    .values(ids.map((metricDefinitionId) => ({ metricDefinitionId, teamId: team })));
  const f = fixture();
  await db.insert(metricValues).values(
    defs.slice(1).map((d, i) => ({
      metricDefinitionId: d.id,
      employeeId: employee,
      teamId: team,
      periodStart: f.periodStart,
      periodEnd: f.periodEnd,
      numericValue: i === 0 ? 5 : null,
      qualityStatus: i === 0 ? "complete" : "unverified_attribution",
    }))
  );
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
describe.sequential("agent-update atomic publication", () => {
  it("writes only update counts; retains solved and human-only values", async () => {
    const before = await values(),
      f = fixture();
    f.snapshot.events.push({ ...f.snapshot.events[0]!, id: 3, child_events: [] });
    const result = await runSync(publisher(f), config, {
      period: { periodStart: f.periodStart, periodEnd: f.periodEnd },
    });
    expect(result).toMatchObject({ success: true, valuesWritten: 1 });
    const after = await values();
    expect(after.filter((v) => v.metricDefinitionId !== ids[0])).toEqual(before);
    expect(after.find((v) => v.metricDefinitionId === ids[0])).toMatchObject({
      numericValue: 2,
      calculationVersion: 1,
      qualityStatus: "complete",
      provenanceJson: { sourceContract: "zendesk-qualified-agent-update-events-v1" },
    });
  });
  it("preserves the previous publication when source-role evidence is unavailable", async () => {
    const before = await values(),
      f = fixture();
    f.snapshot.identities = [];
    const result = await runSync(publisher(f), config, { weekOffset: 1 });
    expect(result.success).toBe(false);
    expect(await values()).toEqual(before);
    expect(
      await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
    ).toHaveLength(0);
  });
  it("replaces a nonzero count with a verified zero and retains its revision", async () => {
    const f = fixture();
    f.snapshot.events = [];
    const result = await runSync(publisher(f), config, { weekOffset: 1 });
    expect(result.success).toBe(true);
    expect((await values()).find((v) => v.metricDefinitionId === ids[0])?.numericValue).toBe(0);
    expect(
      (await db.select().from(syncRevisions).where(eq(syncRevisions.syncRunId, result.syncRunId)))
        .length
    ).toBeGreaterThan(0);
    expect((await runSync(publisher(f), config, { weekOffset: 1 })).success).toBe(true);
    expect((await values()).filter((v) => v.metricDefinitionId === ids[0])).toHaveLength(1);
  });
  it("rechecks metric units at commit and rolls back if the assignment changed", async () => {
    const before = await values();
    try {
      const result = await runSync(
        publisher(fixture(), async () => {
          await db
            .update(metricDefinitions)
            .set({ unit: "tickets" })
            .where(eq(metricDefinitions.id, ids[0]!));
        }),
        config,
        { weekOffset: 1 }
      );
      expect(result.success).toBe(false);
      expect(await values()).toEqual(before);
      expect(
        await db.select().from(sourceRecords).where(eq(sourceRecords.syncRunId, result.syncRunId))
      ).toHaveLength(0);
    } finally {
      await db
        .update(metricDefinitions)
        .set({ unit: "updates" })
        .where(eq(metricDefinitions.id, ids[0]!));
    }
  });
  it("rejects employee departure after fetching without changing historical values", async () => {
    const before = await values();
    try {
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
      expect(result.success).toBe(false);
      expect(await values()).toEqual(before);
    } finally {
      await db
        .update(employees)
        .set({ employmentStatus: "active" })
        .where(eq(employees.id, employee));
    }
  });
  it("rejects data that ages while waiting to commit", async () => {
    const before = await values();
    let calls = 0;
    const result = await runSync(
      publisher(fixture(), undefined, () => new Date(Date.now() + (calls++ ? 3600000 : 0))),
      config,
      { weekOffset: 1 }
    );
    expect(result.success).toBe(false);
    expect(await values()).toEqual(before);
  });
  it("commits a bounded assignment and normal publication together", async () => {
    const cache = globalThis as unknown as { _cadenceDb: typeof db };
    const connection = cache._cadenceDb;
    const f = fixture();
    const endExclusive = new Date(Date.parse(f.periodStart) + 7 * 86400000)
      .toISOString()
      .slice(0, 10);
    try {
      await connection.transaction(async (tx) => {
        cache._cadenceDb = tx;
        await tx
          .update(metricAssignments)
          .set({
            effectiveFrom: f.periodStart,
            effectiveTo: endExclusive,
          })
          .where(eq(metricAssignments.metricDefinitionId, ids[0]!));
        const result = await runSync(publisher(f), config, {
          period: { periodStart: f.periodStart, periodEnd: f.periodEnd },
        });
        expect(result.success).toBe(true);
        expect(result.valuesWritten).toBe(1);
      });
    } finally {
      cache._cadenceDb = connection;
    }
    expect((await values()).find((v) => v.metricDefinitionId === ids[0])?.numericValue).toBe(1);
    expect(
      (
        await db
          .select()
          .from(metricAssignments)
          .where(eq(metricAssignments.metricDefinitionId, ids[0]!))
      )[0]
    ).toMatchObject({ effectiveFrom: f.periodStart, effectiveTo: endExclusive });
  });
  it("rolls catalog, successful publication and run evidence back when final verification fails", async () => {
    const cache = globalThis as unknown as { _cadenceDb: typeof db };
    const connection = cache._cadenceDb;
    const before = await values();
    const assignmentsBefore = await db
      .select()
      .from(metricAssignments)
      .where(inArray(metricAssignments.metricDefinitionId, ids))
      .orderBy(metricAssignments.id);
    const runsBefore = await db
      .select()
      .from(syncRuns)
      .where(eq(syncRuns.dataSourceId, source))
      .orderBy(syncRuns.id);
    const f = fixture();
    f.snapshot.events.push({ ...f.snapshot.events[0]!, id: 99, child_events: [] });
    try {
      await expect(
        connection.transaction(async (tx) => {
          cache._cadenceDb = tx;
          await tx
            .update(metricAssignments)
            .set({ displayOrder: 99 })
            .where(eq(metricAssignments.metricDefinitionId, ids[0]!));
          const result = await runSync(publisher(f), config, {
            period: { periodStart: f.periodStart, periodEnd: f.periodEnd },
          });
          expect(result.success).toBe(true);
          expect((await values()).find((v) => v.metricDefinitionId === ids[0])?.numericValue).toBe(
            2
          );
          throw Error("Final independent verification rejected synthetic publication");
        })
      ).rejects.toThrow("Final independent verification rejected synthetic publication");
    } finally {
      cache._cadenceDb = connection;
    }
    expect(await values()).toEqual(before);
    expect(
      await db
        .select()
        .from(metricAssignments)
        .where(inArray(metricAssignments.metricDefinitionId, ids))
        .orderBy(metricAssignments.id)
    ).toEqual(assignmentsBefore);
    expect(
      await db.select().from(syncRuns).where(eq(syncRuns.dataSourceId, source)).orderBy(syncRuns.id)
    ).toEqual(runsBefore);
  });
});
