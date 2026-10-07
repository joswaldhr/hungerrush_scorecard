// @vitest-environment node
import { randomUUID } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
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
import { weekDates } from "@/lib/utils";
import * as reportingWeeks from "@/lib/utils";
import { runReportEventBatch } from "@/lib/connectors/zendesk-report-event-worker";
import { createLiveUpdaterSolvedPublisher } from "@/lib/connectors/zendesk-updater-solved-publisher";

const org = randomUUID(),
  source = randomUUID(),
  team = randomUUID(),
  employee = randomUUID();
const config = { organizationId: org, dataSourceId: source };
// Account-level leases must be isolated across concurrently running test files.
const subdomain = `solved-${randomUUID()}`;
const accountReference = `zendesk-account:${subdomain}`;
const defs = [
  "zendesk_tickets_solved_credits",
  "zendesk_assignee_solved_tickets",
  "tickets_resolved",
].map((key) => ({ id: randomUUID(), key }));
const ids = defs.map((d) => d.id);
const fixture = () => {
  const result = solvedPublicationFixture(config, employee, team);
  result.policy = { ...result.policy, subdomain, accountReference };
  return result;
};
const values = () =>
  db.select().from(metricValues).where(inArray(metricValues.metricDefinitionId, ids));
const current = async (index = 0) =>
  (await values()).find(
    (v) => v.metricDefinitionId === ids[index] && v.periodStart === weekDates(1).periodStart
  );
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
    configurationReference: accountReference,
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
  it("persists a current-week cutoff without changing the closed-week value", async () => {
    const before = await values(),
      base = fixture();
    const { periodStart, periodEnd } = weekDates(0);
    const asOf = new Date(Date.now() - 1).toISOString();
    const progress = {
      ...base,
      periodStart,
      periodEnd,
      snapshot: {
        ...base.snapshot,
        observedAt: new Date().toISOString(),
        events: [],
        tickets: [],
        coverage: { start: `${periodStart}T00:00:00Z`, endExclusive: asOf, asOf, complete: true },
      },
    };
    expect((await runSync(publisher(progress), config, { weekOffset: 0 })).success).toBe(true);
    const after = await values();
    expect(
      after.find((v) => v.periodStart === periodStart && v.metricDefinitionId === ids[0])
    ).toMatchObject({
      numericValue: 0,
      qualityStatus: "complete",
      provenanceJson: { reportingAsOf: asOf },
    });
    expect(after.filter((v) => v.periodStart === base.periodStart)).toEqual(before);
  });
  it("publishes the exact persisted recovery period and records it in the completed run", async () => {
    const f = fixture();
    const period = { periodStart: f.periodStart, periodEnd: f.periodEnd };
    const result = await runSync(
      publisher({
        ...f,
        snapshot: { ...f.snapshot, events: [], tickets: [] },
      }),
      config,
      { period }
    );
    expect(result.success).toBe(true);
    const [run] = await db.select().from(syncRuns).where(eq(syncRuns.id, result.syncRunId));
    expect(run?.metadataJson).toMatchObject({ period });
    expect(await current()).toMatchObject({ ...period, numericValue: 0 });
  });
  it("pins offset-selected dates before fetching even if the relative calendar advances", async () => {
    const f = fixture(),
      next = weekDates(0);
    const connector = publisher({ ...f, snapshot: { ...f.snapshot, events: [], tickets: [] } });
    const fetch = connector.fetchRecords.bind(connector);
    connector.fetchRecords = async (config, ctx) => {
      const calendar = vi.spyOn(reportingWeeks, "weekDates").mockReturnValue(next);
      try {
        return await fetch(config, ctx);
      } finally {
        calendar.mockRestore();
      }
    };
    const result = await runSync(connector, config, { weekOffset: 1 });
    expect(result.success).toBe(true);
    expect(await current()).toMatchObject({ periodStart: f.periodStart, numericValue: 0 });
  });
  it("rejects conflicting dates and unsupported fixed-period connectors before creating a run", async () => {
    const f = fixture(),
      period = { periodStart: f.periodStart, periodEnd: f.periodEnd };
    const before = await db.select().from(syncRuns).where(eq(syncRuns.dataSourceId, source));
    await expect(runSync(publisher(f), config, { period, weekOffset: 0 })).rejects.toThrow(
      "not both"
    );
    const legacy = publisher(f);
    Object.assign(legacy, { supportsFixedPeriod: false });
    await expect(runSync(legacy, config, { period })).rejects.toThrow("does not support");
    expect(await db.select().from(syncRuns).where(eq(syncRuns.dataSourceId, source))).toEqual(
      before
    );
  });
  it("publishes through durable collection, live join transport and the atomic service end to end", async () => {
    const f = fixture(),
      legacy = await current(2),
      cutoff = Math.floor(Date.now() / 1000) - 120;
    const collection = await runReportEventBatch(
      { ...config, accountReference: f.policy.accountReference },
      Date.parse(f.periodStart) / 1000,
      async () => ({
        rateLimited: false,
        quotaDelayMs: 0,
        page: {
          ticket_events: f.snapshot.events,
          count: f.snapshot.events.length,
          end_time: cutoff,
          end_of_stream: true,
          next_page: null,
        },
      })
    );
    expect(collection).toMatchObject({
      status: "collected",
      streamExhausted: true,
      newEvents: 1,
      joinedMetricCoverageCertified: false,
    });
    expect((await current())?.numericValue).toBe(0);
    await db
      .update(externalIdentities)
      .set({ externalId: "staff@example.invalid" })
      .where(eq(externalIdentities.dataSourceId, source));
    const request = vi.fn<typeof fetch>(async (input, options) => {
      expect(options).toMatchObject({ method: "GET", redirect: "error" });
      const url = new URL(String(input));
      expect(url.origin).toBe(`https://${subdomain}.zendesk.com`);
      if (url.pathname === "/api/v2/users.json")
        return Response.json({
          users: [
            {
              id: 42,
              email: "staff@example.invalid",
              role: "agent",
              active: true,
              suspended: false,
            },
          ],
          meta: { has_more: false },
          links: { next: null },
        });
      if (url.pathname === "/api/v2/tickets/show_many.json")
        return Response.json({
          tickets: f.snapshot.tickets,
          metric_sets: [{ ticket_id: 100, solved_at: f.snapshot.tickets[0]!.solved_at }],
        });
      throw Error("Unexpected synthetic request");
    });
    vi.stubGlobal("fetch", request);
    try {
      const credentials = {
        subdomain,
        email: "source@example.invalid",
        apiKey: "synthetic-token",
      };
      const deferred = await runSync(
        createLiveUpdaterSolvedPublisher(f.policy, credentials),
        config,
        { weekOffset: 1 }
      );
      expect(deferred.success).toBe(false);
      expect(request).not.toHaveBeenCalled();
      expect((await current())?.numericValue).toBe(0);
      // Exercise real database-time expiry, not a bypass of production pacing.
      await wait(20100);
      const closed = await runSync(
        createLiveUpdaterSolvedPublisher(f.policy, credentials),
        config,
        { weekOffset: 1 }
      );
      expect(closed.success).toBe(true);
      expect(await current()).toMatchObject({ numericValue: 1, qualityStatus: "complete" });
      expect(
        (
          await runSync(createLiveUpdaterSolvedPublisher(f.policy, credentials), config, {
            weekOffset: 0,
          })
        ).success
      ).toBe(true);
      const progress = (await values()).find(
        (v) => v.metricDefinitionId === ids[0] && v.periodStart === weekDates(0).periodStart
      );
      expect(progress).toMatchObject({
        numericValue: 0,
        provenanceJson: { reportingAsOf: new Date(cutoff * 1000).toISOString() },
      });
      expect(await current(2)).toEqual(legacy);
      expect(request).toHaveBeenCalledTimes(3);
    } finally {
      vi.unstubAllGlobals();
      await db
        .update(externalIdentities)
        .set({ externalId: "agent" })
        .where(eq(externalIdentities.dataSourceId, source));
    }
  }, 40000);
});
