// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, organizations, sourceRecords } from "@/lib/db/schema";
import { claimActionShadowLease } from "@/lib/connectors/action-shadow-lease";
import {
  advanceTicketActionExport,
  readTicketActionState,
} from "@/lib/connectors/ticket-action-checkpoint";
import { advanceAgentLegExport, readAgentLegState } from "@/lib/connectors/agent-leg-checkpoint";
import { SourceRetryLaterError } from "@/lib/connectors/source-retry";

const organizationId = randomUUID(),
  dataSourceId = randomUUID();
const base = {
  organizationId,
  dataSourceId,
  start: new Date("2026-09-20T00:00:00Z"),
  endExclusive: new Date("2026-09-21T00:00:00Z"),
};
const streams = [
  {
    name: "tickets",
    advance: advanceTicketActionExport,
    read: readTicketActionState,
    page: {
      ticket_events: [
        {
          id: 1,
          ticket_id: 1,
          updater_id: 42,
          created_at: "2026-09-20T12:00:00Z",
          child_events: [],
        },
      ],
      count: 1,
      end_time: base.endExclusive.getTime() / 1000,
      end_of_stream: true,
      next_page: null,
    },
  },
  {
    name: "legs",
    advance: advanceAgentLegExport,
    read: readAgentLegState,
    page: {
      legs: [
        {
          id: 1,
          call_id: 1,
          agent_id: 42,
          type: "agent",
          completion_status: "completed",
          created_at: "2026-09-20T12:00:00Z",
          updated_at: "2026-09-21T00:00:00Z",
          talk_time: 10,
          hold_time: 0,
          duration: 10,
        },
      ],
      count: 1,
      end_time: base.endExclusive.getTime() / 1000,
      next_page: "/boundary",
    },
  },
] as const;
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic write fence" });
  await db.insert(dataSources).values({
    id: dataSourceId,
    organizationId,
    type: "zendesk",
    status: "configured",
    displayName: "Synthetic write fence",
  });
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db
    .update(dataSources)
    .set({ status: "configured", type: "zendesk" })
    .where(eq(dataSources.id, dataSourceId));
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db.delete(dataSources).where(eq(dataSources.id, dataSourceId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});
async function ownedScope() {
  const lease = await claimActionShadowLease(organizationId, dataSourceId);
  if (!lease.acquired) throw new Error("Synthetic lease unavailable");
  return { ...base, workerLeaseToken: lease.token };
}
async function expire() {
  await db
    .update(sourceRecords)
    .set({
      payloadJson: sql`jsonb_set(${sourceRecords.payloadJson}, '{expiresAt}', '"2000-01-01T00:00:00.000Z"'::jsonb)`,
    })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_action_worker_lease_v2_shadow")
      )
    );
}
async function retainedTypes() {
  return (
    await db
      .select({ type: sourceRecords.externalRecordType })
      .from(sourceRecords)
      .where(eq(sourceRecords.dataSourceId, dataSourceId))
  ).map((row) => row.type);
}
for (const stream of streams) {
  it(`${stream.name}: refuses an already disabled source before checkpoint creation or fetch`, async () => {
    const scope = await ownedScope();
    await db
      .update(dataSources)
      .set({ status: "disabled" })
      .where(eq(dataSources.id, dataSourceId));
    const get = vi.fn();
    await expect(stream.advance(scope, get)).rejects.toThrow("no longer enabled");
    expect(get).not.toHaveBeenCalled();
    expect(await retainedTypes()).toEqual(["zendesk_action_worker_lease_v2_shadow"]);
    await expect(claimActionShadowLease(organizationId, dataSourceId)).rejects.toThrow(
      "no longer enabled"
    );
  });
  it.each(["disabled", "type_changed", "expired", "replaced", "rate_limited"] as const)(
    `${stream.name}: rejects %s authority after fetch and retains its durable cursor`,
    async (change) => {
      const scope = await ownedScope();
      await expect(
        stream.advance(scope, async () => {
          if (change === "disabled" || change === "rate_limited")
            await db
              .update(dataSources)
              .set({ status: "disabled" })
              .where(eq(dataSources.id, dataSourceId));
          else if (change === "type_changed")
            await db
              .update(dataSources)
              .set({ type: "staging" })
              .where(eq(dataSources.id, dataSourceId));
          else {
            await expire();
            if (change === "replaced") await ownedScope();
          }
          if (change === "rate_limited") throw new SourceRetryLaterError(60_000);
          return stream.page;
        })
      ).rejects.toThrow(/no longer (enabled|owned)/);
      expect(await stream.read(base)).toMatchObject({
        pages: 0,
        status: "pending",
        notBefore: null,
      });
      expect(
        (await retainedTypes()).every(
          (type) => type.includes("checkpoint") || type.includes("lease")
        )
      ).toBe(true);
    }
  );
  it(`${stream.name}: commits a valid owner and allows a successor to resume without duplication`, async () => {
    const scope = await ownedScope();
    expect((await stream.advance(scope, async () => stream.page)).advanced).toBe(true);
    expect((await stream.read(base)).pages).toBe(1);
    await expire();
    const next = await ownedScope();
    const noFetch = vi.fn(async () => stream.page);
    await stream.advance(next, noFetch);
    const eventType =
      stream.name === "tickets"
        ? "zendesk_ticket_action_event_v2_shadow"
        : "zendesk_agent_leg_record_v2_shadow";
    expect((await retainedTypes()).filter((type) => type === eventType)).toHaveLength(1);
  });
}
