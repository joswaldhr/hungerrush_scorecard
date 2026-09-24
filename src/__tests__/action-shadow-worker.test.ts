// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords, normalizedFacts } from "@/lib/db/schema";
import { nextActionShadowScope, runActionShadowBatch } from "@/lib/connectors/action-shadow-worker";
import { SourceRetryLaterError } from "@/lib/connectors/source-retry";
import { compareActionObservation } from "@/lib/connectors/action-observation-comparison";
import { readTicketActionExport } from "@/lib/connectors/ticket-action-checkpoint";
const organizationId = randomUUID(),
  dataSourceId = randomUUID();
const now = new Date("2026-09-24T12:00:00Z");
const watermark = Date.parse("2026-09-24T00:00:00Z") / 1000;
const get = async (path: string) =>
  path.includes("ticket_events")
    ? {
        ticket_events: [
          {
            id: 1,
            ticket_id: 1,
            updater_id: 42,
            created_at: "2026-09-23T12:00:00Z",
            child_events: [],
          },
        ],
        count: 1,
        end_time: watermark,
        end_of_stream: true,
        next_page: null,
      }
    : {
        legs: [
          {
            id: 1,
            call_id: 1,
            agent_id: 42,
            type: "agent",
            completion_status: "completed",
            created_at: "2026-09-23T12:00:00Z",
            updated_at: "2026-09-24T00:00:00Z",
            talk_time: 10,
            hold_time: 0,
            duration: 10,
          },
        ],
        count: 1,
        end_time: watermark,
        next_page: "/boundary",
      };
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic worker" });
  await db
    .insert(dataSources)
    .values({ id: dataSourceId, organizationId, type: "staging", displayName: "Synthetic worker" });
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db.delete(dataSources).where(eq(dataSources.id, dataSourceId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});
it("resumes an unfinished pair across midnight and catches up without skipping days", async () => {
  const scope = await nextActionShadowScope(organizationId, dataSourceId, now);
  expect(scope.start.toISOString()).toBe("2026-09-23T00:00:00.000Z");
  expect((await runActionShadowBatch(scope, get, { maxPages: 1 })).completed).toBe(false);
  const resumed = await nextActionShadowScope(
    organizationId,
    dataSourceId,
    new Date("2026-09-27T12:00:00Z")
  );
  expect(resumed.start).toEqual(scope.start);
  expect((await runActionShadowBatch(resumed, get, { maxPages: 2 })).completed).toBe(true);
  const next = await nextActionShadowScope(
    organizationId,
    dataSourceId,
    new Date("2026-09-27T12:00:00Z")
  );
  expect(next.start.toISOString()).toBe("2026-09-24T00:00:00.000Z");
  expect(
    await db.select().from(normalizedFacts).where(eq(normalizedFacts.dataSourceId, dataSourceId))
  ).toHaveLength(0);
  const [source] = await db.select().from(dataSources).where(eq(dataSources.id, dataSourceId));
  expect(source?.lastSuccessfulSyncAt).toBeNull();
});
it("allows legs to progress while ticket requests are rate-limited", async () => {
  const scope = await nextActionShadowScope(organizationId, dataSourceId, now);
  const result = await runActionShadowBatch(
    scope,
    async (path) => {
      if (path.includes("ticket_events")) throw new SourceRetryLaterError(60000);
      return get(path);
    },
    { maxPages: 3 }
  );
  expect(result.streams.legs.status).toBe("complete");
  expect(result.streams.tickets.notBefore).not.toBeNull();
  const noFetch = vi.fn();
  expect((await runActionShadowBatch(scope, noFetch)).steps).toBe(0);
  expect(noFetch).not.toHaveBeenCalled();
});
it("keeps the two-minute source lag and rejects invalid budgets", async () => {
  const scope = await nextActionShadowScope(
    organizationId,
    dataSourceId,
    new Date("2026-09-24T00:01:00Z")
  );
  expect(scope.endExclusive.toISOString()).toBe("2026-09-23T00:00:00.000Z");
  await expect(runActionShadowBatch(scope, vi.fn(), { maxDurationMs: NaN })).rejects.toThrow(
    "budget"
  );
});

it("retains the original observation and reports changes only after a separate export completes", async () => {
  const scope = await nextActionShadowScope(organizationId, dataSourceId, now);
  await runActionShadowBatch(scope, get);
  const observationId = randomUUID();
  expect((await compareActionObservation(scope, observationId)).status).toBe("incomplete");
  const revised = { ...scope, observationId };
  const updated = async (path: string) => {
    const result = await get(path);
    if (result.ticket_events)
      return {
        ...result,
        ticket_events: result.ticket_events.map((event) => ({ ...event, id: 2 })),
      };
    return { ...result, legs: result.legs!.map((leg) => ({ ...leg, talk_time: 20 })) };
  };
  await runActionShadowBatch(revised, updated, { maxPages: 1 });
  expect((await compareActionObservation(scope, observationId)).status).toBe("incomplete");
  // An unfinished correction must not replace normal daily catch-up selection.
  expect(
    (
      await nextActionShadowScope(organizationId, dataSourceId, new Date("2026-09-27T12:00:00Z"))
    ).start.toISOString()
  ).toBe("2026-09-24T00:00:00.000Z");
  await runActionShadowBatch(revised, updated);
  expect(await compareActionObservation(scope, observationId)).toEqual({
    status: "review_required",
    tickets: { added: [2], removed: [1], changed: [] },
    legs: { added: [], removed: [], changed: [1] },
  });
  expect((await readTicketActionExport(scope)).cohort?.events.map((event) => event.id)).toEqual([
    1,
  ]);
  expect((await runActionShadowBatch(revised, vi.fn())).steps).toBe(0);
  await expect(readTicketActionExport({ ...scope, observationId: "bad/id" })).rejects.toThrow();
});
