// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import {
  beginReportEventCycle,
  claimReportEventCollection,
  commitReportEventPage,
  deferReportEventRequests,
  releaseReportEventCollection,
  readReportEventSnapshot,
  reserveReportEventRequest,
} from "@/lib/connectors/zendesk-report-event-store";

const organizationId = randomUUID(),
  dataSourceId = randomUUID(),
  secondSourceId = randomUUID();
const accountReference = `zendesk-account:test-${randomUUID()}`;
const scope = { organizationId, dataSourceId, accountReference };
const start = 100;
const event = (id = 1) => ({
  id,
  ticket_id: 100,
  updater_id: 42,
  created_at: new Date(150000).toISOString(),
  child_events: [{ id: 1000 + id, event_type: "Change", status: "solved", previous_value: "open" }],
});
const page = (events = [event()], end_time = 200, done = false) => ({
  ticket_events: events,
  count: events.length,
  end_time,
  end_of_stream: done,
  next_page: done
    ? null
    : `https://${accountReference.slice(16)}.zendesk.com/api/v2/incremental/ticket_events.json?start_time=${end_time}`,
});
async function own() {
  const lease = await claimReportEventCollection(scope);
  if (!lease.acquired) throw Error("Expected lease");
  return { ...scope, token: lease.token };
}
const records = () =>
  db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, dataSourceId))
    .orderBy(sourceRecords.externalRecordType, sourceRecords.externalRecordId);
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic report events" });
  await db.insert(dataSources).values(
    [dataSourceId, secondSourceId].map((id) => ({
      id,
      organizationId,
      type: "zendesk",
      displayName: "Synthetic report events",
      status: "configured",
      configurationReference: accountReference,
    }))
  );
});
beforeEach(async () => {
  delete env.ZENDESK_REPORT_EVENT_CHANNEL_RETENTION;
  await db
    .delete(sourceRecords)
    .where(inArray(sourceRecords.dataSourceId, [dataSourceId, secondSourceId]));
  await db
    .update(dataSources)
    .set({ configurationReference: accountReference })
    .where(inArray(dataSources.id, [dataSourceId, secondSourceId]));
});
afterAll(async () => {
  delete env.ZENDESK_REPORT_EVENT_CHANNEL_RETENTION;
  await db
    .delete(sourceRecords)
    .where(inArray(sourceRecords.dataSourceId, [dataSourceId, secondSourceId]));
  await db.delete(dataSources).where(inArray(dataSources.id, [dataSourceId, secondSourceId]));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});
it("excludes concurrent collectors even across two sources for the same account", async () => {
  const results = await Promise.all([
    claimReportEventCollection(scope),
    claimReportEventCollection({ ...scope, dataSourceId: secondSourceId }),
  ]);
  expect(results.filter((r) => r.acquired)).toHaveLength(1);
});
it("resumes after handoff, deduplicates boundary events, and preserves zero-event coverage", async () => {
  const worker = await own();
  const begun = await beginReportEventCycle(worker, start);
  const first = await commitReportEventPage(worker, begun.expectedHash, page());
  expect(first.newEvents).toBe(1);
  await releaseReportEventCollection(worker);
  const successor = await own();
  expect((await beginReportEventCycle(successor, start)).expectedHash).toBe(first.expectedHash);
  expect(
    (await readReportEventSnapshot(scope, new Date(100000), new Date(200000), [42])).status
  ).toBe("collecting");
  const done = await commitReportEventPage(
    successor,
    first.expectedHash,
    page([event()], 400, true)
  );
  expect(done.newEvents).toBe(0);
  const ready = await readReportEventSnapshot(scope, new Date(100000), new Date(400000), [42]);
  expect(ready.snapshot?.events).toHaveLength(1);
  expect(
    (await readReportEventSnapshot(scope, new Date(100000), new Date(400000), [43])).snapshot
      ?.events
  ).toEqual([]);
  expect(
    (await readReportEventSnapshot(scope, new Date(100000), new Date(401000), [42])).status
  ).toBe("collecting");
  expect(
    (await records()).every((r) => r.externalRecordType.startsWith("zendesk_report_event_"))
  ).toBe(true);
  const refresh = await beginReportEventCycle(successor, start);
  expect(refresh.state.cycle).toBe(2);
  expect(refresh.state.cursor.cycleStart).toBe(100);
  expect(
    (await commitReportEventPage(successor, refresh.expectedHash, page([event()], 500, true)))
      .newEvents
  ).toBe(0);
});
it("caps an explicitly requested progress read at the retained watermark", async () => {
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  await commitReportEventPage(worker, begun.expectedHash, page([event()], 400, true));
  const capped = await readReportEventSnapshot(scope, new Date(100000), new Date(500000), [42], {
    capAtWatermark: true,
  });
  expect(capped.snapshot?.coverage.endExclusive).toBe(new Date(400000).toISOString());
  expect(capped.snapshot?.events).toHaveLength(1);
  expect(
    (
      await readReportEventSnapshot(scope, new Date(500000), new Date(600000), [42], {
        capAtWatermark: true,
      })
    ).status
  ).toBe("collecting");
});
it("keeps channel retention disabled without its independent opt-in", async () => {
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  await commitReportEventPage(
    worker,
    begun.expectedHash,
    page([{ ...event(), via: "Phone call inbound" } as ReturnType<typeof event>], 400, true)
  );
  expect(
    (await records()).filter((r) => r.externalRecordType === "zendesk_report_event_channel_v1")
  ).toEqual([]);
  const snapshot = await readReportEventSnapshot(scope, new Date(100000), new Date(400000), [42], {
    includeChannels: true,
  });
  expect(snapshot.snapshot?.channels).toEqual({
    complete: false,
    records: [],
    missingEventIds: [1],
  });
});
it("adds channel evidence on old overlap without rewriting immutable base events", async () => {
  env.ZENDESK_REPORT_EVENT_CHANNEL_RETENTION = "1";
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  const first = await commitReportEventPage(worker, begun.expectedHash, page([event()], 200));
  const baseBefore = (await records()).find(
    (r) => r.externalRecordType === "zendesk_report_event_v1"
  );
  const done = await commitReportEventPage(
    worker,
    first.expectedHash,
    page(
      [{ ...event(), via: "Phone call inbound" } as ReturnType<typeof event>, event(2)],
      400,
      true
    )
  );
  expect(done.newEvents).toBe(1);
  const baseAfter = (await records()).find(
    (r) => r.externalRecordType === "zendesk_report_event_v1" && r.externalRecordId === "1"
  );
  expect(baseAfter).toEqual(baseBefore);
  const read = () =>
    readReportEventSnapshot(scope, new Date(100000), new Date(400000), [42], {
      includeChannels: true,
    });
  expect((await read()).snapshot?.channels).toMatchObject({
    complete: false,
    missingEventIds: [2],
    records: [{ channel: "Phone call inbound" }],
  });
  expect(
    (await readReportEventSnapshot(scope, new Date(100000), new Date(400000), [42])).snapshot
  ).not.toHaveProperty("channels");
  const before = (await records()).filter(
    (r) => r.externalRecordType === "zendesk_report_event_channel_v1"
  );
  const refresh = await beginReportEventCycle(worker, start);
  await commitReportEventPage(
    worker,
    refresh.expectedHash,
    page([{ ...event(), via: "Phone call inbound" } as ReturnType<typeof event>], 500, true)
  );
  expect(
    (await records()).filter((r) => r.externalRecordType === "zendesk_report_event_channel_v1")
  ).toEqual(before);
});
it("rolls back base events, channels and checkpoint on changed channel overlap", async () => {
  env.ZENDESK_REPORT_EVENT_CHANNEL_RETENTION = "1";
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  const first = await commitReportEventPage(
    worker,
    begun.expectedHash,
    page([{ ...event(), via: "Phone call inbound" } as ReturnType<typeof event>])
  );
  const before = await records();
  await expect(
    commitReportEventPage(
      worker,
      first.expectedHash,
      page(
        [
          { ...event(2), via: "Web form" } as ReturnType<typeof event>,
          { ...event(), via: "Phone call outbound" } as ReturnType<typeof event>,
        ],
        400,
        true
      )
    )
  ).rejects.toThrow("channel changed");
  expect(await records()).toEqual(before);
});
it("rejects tampered retained channel payloads without changing solved reads", async () => {
  env.ZENDESK_REPORT_EVENT_CHANNEL_RETENTION = "1";
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  await commitReportEventPage(
    worker,
    begun.expectedHash,
    page([{ ...event(), via: "Phone call inbound" } as ReturnType<typeof event>], 400, true)
  );
  await db
    .update(sourceRecords)
    .set({ payloadHash: "0".repeat(64) })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_report_event_channel_v1")
      )
    );
  await expect(
    readReportEventSnapshot(scope, new Date(100000), new Date(400000), [42], {
      includeChannels: true,
    })
  ).rejects.toThrow("channel identity or digest");
  expect(
    (await readReportEventSnapshot(scope, new Date(100000), new Date(400000), [42])).status
  ).toBe("ready");
});
it("rolls back all events and the cursor when a retained ID conflicts", async () => {
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  const first = await commitReportEventPage(worker, begun.expectedHash, page());
  const before = await records();
  await expect(
    commitReportEventPage(
      worker,
      first.expectedHash,
      page([event(2), { ...event(), updater_id: 43 }], 300)
    )
  ).rejects.toThrow("changed");
  expect(await records()).toEqual(before);
});
it("rolls back event inserts when the checkpoint cannot commit", async () => {
  env.ZENDESK_REPORT_EVENT_CHANNEL_RETENTION = "1";
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  const before = await records();
  const name = `report_checkpoint_fault_${randomUUID().replaceAll("-", "")}`;
  await db.execute(
    sql.raw(
      `alter table source_records add constraint ${name} check (not(data_source_id='${dataSourceId}' and external_record_type='zendesk_report_event_checkpoint_v1' and coalesce((payload_json->'cursor'->>'pages')::integer,0)>0))`
    )
  );
  try {
    await expect(
      commitReportEventPage(
        worker,
        begun.expectedHash,
        page([{ ...event(), via: "Web form" } as ReturnType<typeof event>])
      )
    ).rejects.toThrow();
    expect(await records()).toEqual(before);
  } finally {
    await db.execute(sql.raw(`alter table source_records drop constraint ${name}`));
  }
});
it("fences duplicate commits, expired owners and late cleanup", async () => {
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  const results = await Promise.allSettled([
    commitReportEventPage(worker, begun.expectedHash, page()),
    commitReportEventPage(worker, begun.expectedHash, page()),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await db
    .update(sourceRecords)
    .set({
      payloadJson: sql`jsonb_set(payload_json,'{expiresAt}','"1970-01-01T00:00:00.000Z"'::jsonb)`,
    })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_report_event_lease_v1")
      )
    );
  await expect(reserveReportEventRequest(worker)).rejects.toThrow("no longer owned");
  const successor = await own();
  await releaseReportEventCollection(worker);
  expect((await claimReportEventCollection(scope)).acquired).toBe(false);
  await expect(beginReportEventCycle(successor, start + 1)).rejects.toThrow("bootstrap changed");
});
it("retains account-wide request spacing and Retry-After through handoff", async () => {
  const worker = await own();
  expect((await reserveReportEventRequest(worker)).reserved).toBe(true);
  const spacing = await reserveReportEventRequest(worker);
  expect(spacing.reserved).toBe(false);
  expect(spacing.waitMs).toBeGreaterThan(18000);
  expect(spacing.waitMs).toBeLessThanOrEqual(20000);
  await deferReportEventRequests(worker, 60000);
  await releaseReportEventCollection(worker);
  const lease = await claimReportEventCollection({ ...scope, dataSourceId: secondSourceId });
  if (!lease.acquired) throw Error("Expected successor");
  const result = await reserveReportEventRequest({
    ...scope,
    dataSourceId: secondSourceId,
    token: lease.token,
  });
  expect(result.reserved).toBe(false);
  expect(result.waitMs).toBeGreaterThan(55000);
});
it("rejects wrong organization and account rebinding without accepting source data", async () => {
  await expect(
    claimReportEventCollection({ ...scope, organizationId: randomUUID() })
  ).rejects.toThrow("not permitted");
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  await db
    .update(dataSources)
    .set({ configurationReference: "zendesk-account:other" })
    .where(eq(dataSources.id, dataSourceId));
  await expect(commitReportEventPage(worker, begun.expectedHash, page())).rejects.toThrow(
    "not permitted"
  );
  expect(
    (await records()).filter((r) => r.externalRecordType === "zendesk_report_event_v1")
  ).toHaveLength(0);
});
it("fails closed on altered checkpoint or event payloads", async () => {
  const worker = await own(),
    begun = await beginReportEventCycle(worker, start);
  await commitReportEventPage(worker, begun.expectedHash, page([event()], 400, true));
  await db
    .update(sourceRecords)
    .set({ payloadJson: sql`jsonb_set(payload_json,'{ticket_id}','999'::jsonb)` })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_report_event_v1")
      )
    );
  await expect(
    readReportEventSnapshot(scope, new Date(100000), new Date(400000), [42])
  ).rejects.toThrow("digest");
  await db
    .update(sourceRecords)
    .set({ payloadJson: sql`jsonb_set(payload_json,'{cycle}','3'::jsonb)` })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_report_event_checkpoint_v1")
      )
    );
  await expect(beginReportEventCycle(worker, start)).rejects.toThrow("checkpoint");
});
