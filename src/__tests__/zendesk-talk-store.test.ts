// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import {
  beginTalkCollectionCycle,
  claimTalkCollection,
  commitTalkCollectionPage,
  deferTalkRequests,
  releaseTalkCollection,
  readTalkCollectionSnapshot,
  reserveTalkRequest,
  type TalkOwnedScope,
} from "@/lib/connectors/zendesk-talk-store";
import { fetchCoordinatedTalkWeek } from "@/lib/connectors/zendesk-talk-legacy";
import { runTalkCollectionBatch } from "@/lib/connectors/zendesk-talk-worker";

const organizationId = randomUUID(),
  dataSourceId = randomUUID(),
  secondSourceId = randomUUID();
const accountReference = `zendesk-account:test-${randomUUID()}`;
const scope = { organizationId, dataSourceId, accountReference };
const origin = `https://${accountReference.slice("zendesk-account:".length)}.zendesk.com`;
const start = 100;
const call = (id = 1, updated_at = "2026-09-13T13:00:00Z", talk_time = 20) => ({
  id,
  created_at: "2026-09-13T12:00:00Z",
  updated_at,
  direction: "outbound",
  completion_status: "completed",
  call_group_id: 7,
  phone_number: null,
  ticket_id: 100,
  talk_time,
  voicemail: false,
  customer_phone: "must not persist",
});
const page = (calls = [call()], end_time = 500) => ({
  calls,
  count: calls.length,
  end_time,
  next_page: `${origin}/api/v2/channels/voice/stats/incremental/calls.json?start_time=${end_time}`,
});
async function own(): Promise<TalkOwnedScope> {
  const lease = await claimTalkCollection(scope);
  if (!lease.acquired) throw Error("Expected test lease");
  return { ...scope, token: lease.token };
}
async function records() {
  return db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
}
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic Talk store" });
  await db.insert(dataSources).values(
    [dataSourceId, secondSourceId].map((id) => ({
      id,
      organizationId,
      type: "zendesk",
      displayName: "Synthetic Talk",
      status: "configured",
      configurationReference: accountReference,
    }))
  );
});
beforeEach(async () => {
  await db
    .delete(sourceRecords)
    .where(inArray(sourceRecords.dataSourceId, [dataSourceId, secondSourceId]));
  await db
    .update(dataSources)
    .set({ configurationReference: accountReference })
    .where(inArray(dataSources.id, [dataSourceId, secondSourceId]));
});
afterAll(async () => {
  await db
    .delete(sourceRecords)
    .where(inArray(sourceRecords.dataSourceId, [dataSourceId, secondSourceId]));
  await db.delete(dataSources).where(inArray(dataSources.id, [dataSourceId, secondSourceId]));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

it("serializes workers across data sources bound to the same account", async () => {
  const claims = await Promise.all([
    claimTalkCollection(scope),
    claimTalkCollection({ ...scope, dataSourceId: secondSourceId }),
  ]);
  expect(claims.filter((x) => x.acquired)).toHaveLength(1);
});

it("blocks the durable worker while a legacy fetch owns another source in the same account", async () => {
  let started!: () => void, finish!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const released = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const legacy = fetchCoordinatedTalkWeek(scope, "2026-09-20", "2026-09-26", async () => {
    started();
    await released;
    return { rateLimited: false, page: { calls: [], count: 0, end_time: 500, next_page: null } };
  });
  await entered;
  try {
    const request = vi.fn();
    expect(
      await runTalkCollectionBatch({ ...scope, dataSourceId: secondSourceId }, start, request)
    ).toMatchObject({ status: "busy", pages: 0 });
    expect(request).not.toHaveBeenCalled();
  } finally {
    finish();
  }
  expect((await legacy).calls).toEqual([]);
});

it("blocks legacy reads behind a durable worker and carries its vendor delay across handoff", async () => {
  let started!: () => void, finish!: () => void;
  const entered = new Promise<void>((resolve) => {
    started = resolve;
  });
  const released = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const worker = runTalkCollectionBatch(scope, start, async () => {
    started();
    await released;
    return { rateLimited: true, retryAfterMs: 60000 };
  });
  await entered;
  const request = vi.fn();
  try {
    await expect(
      fetchCoordinatedTalkWeek(
        { ...scope, dataSourceId: secondSourceId },
        "2026-09-20",
        "2026-09-26",
        request
      )
    ).rejects.toThrow("already running");
  } finally {
    finish();
  }
  expect(await worker).toMatchObject({ status: "rate_limited", pages: 0 });
  await expect(
    fetchCoordinatedTalkWeek(
      { ...scope, dataSourceId: secondSourceId },
      "2026-09-20",
      "2026-09-26",
      request
    )
  ).rejects.toMatchObject({ name: "SourceRetryLaterError" });
  expect(request).not.toHaveBeenCalled();
});
it("retains account-wide rate reservations and Retry-After across worker handoff", async () => {
  const worker = await own();
  expect((await reserveTalkRequest(worker)).reserved).toBe(true);
  expect((await reserveTalkRequest(worker)).reserved).toBe(false);
  await deferTalkRequests(worker, 60000);
  await releaseTalkCollection(worker);
  const next = await claimTalkCollection({ ...scope, dataSourceId: secondSourceId });
  if (!next.acquired) throw Error("Expected successor");
  const reservation = await reserveTalkRequest({
    ...scope,
    dataSourceId: secondSourceId,
    token: next.token,
  });
  expect(reservation.reserved).toBe(false);
  expect(reservation.waitMs).toBeGreaterThan(55000);
});
it("commits source, revisions and cursor together, resumes, and retains older corrections", async () => {
  const worker = await own();
  const begun = await beginTalkCollectionCycle(worker, "calls", start);
  const first = await commitTalkCollectionPage(worker, "calls", begun.expectedHash, page());
  expect(first.changedRecords).toBe(1);
  const resumed = await beginTalkCollectionCycle(worker, "calls", start);
  expect(resumed.expectedHash).toBe(first.expectedHash);
  const corrected = await commitTalkCollectionPage(
    worker,
    "calls",
    first.expectedHash,
    page([call(1, "2026-09-14T00:00:00Z", 30)], 600)
  );
  const finished = await commitTalkCollectionPage(
    worker,
    "calls",
    corrected.expectedHash,
    page([], 600)
  );
  expect(finished.state.cursor.status).toBe("exhausted");
  const rows = await records();
  expect(rows.filter((r) => r.externalRecordType.includes("revision"))).toHaveLength(2);
  expect(rows.filter((r) => r.externalRecordType.includes("record_v1"))).toHaveLength(1);
  expect(JSON.stringify(rows)).not.toContain("must not persist");
  const nextCycle = await beginTalkCollectionCycle(worker, "calls", start);
  expect(nextCycle.state.cursor.initialStartTime).toBe(300);
  expect(nextCycle.state.cycle).toBe(2);
  const late = await commitTalkCollectionPage(
    worker,
    "calls",
    nextCycle.expectedHash,
    page([call()], 700)
  );
  expect(late.changedRecords).toBe(0);
  expect(late.revisions).toBe(0);
});
it("rolls back the entire page when a previously retained source version conflicts", async () => {
  const worker = await own();
  const begun = await beginTalkCollectionCycle(worker, "calls", start);
  const first = await commitTalkCollectionPage(worker, "calls", begun.expectedHash, page());
  const before = await records();
  await expect(
    commitTalkCollectionPage(
      worker,
      "calls",
      first.expectedHash,
      page([call(2), call(1, "2026-09-13T13:00:00Z", 99)], 600)
    )
  ).rejects.toThrow("Conflicting");
  expect(await records()).toEqual(before);
});
it("rolls back source and revision inserts when the final checkpoint write fails in PostgreSQL", async () => {
  const worker = await own();
  const begun = await beginTalkCollectionCycle(worker, "calls", start);
  const before = await records();
  const name = `talk_checkpoint_fault_${randomUUID().replaceAll("-", "")}`;
  // Only this synthetic source is affected; the Vitest configuration rejects hosted DBs.
  await db.execute(
    sql.raw(`alter table source_records add constraint ${name} check (
    not (data_source_id = '${dataSourceId}' and external_record_type = 'zendesk_talk_collection_checkpoint_v1'
      and coalesce((payload_json->'cursor'->>'pages')::integer, 0) > 0))`)
  );
  try {
    await expect(
      commitTalkCollectionPage(worker, "calls", begun.expectedHash, page())
    ).rejects.toThrow();
    expect(await records()).toEqual(before);
    expect((await beginTalkCollectionCycle(worker, "calls", start)).expectedHash).toBe(
      begun.expectedHash
    );
  } finally {
    await db.execute(sql.raw(`alter table source_records drop constraint ${name}`));
  }
});
it("fences duplicate responses, expired workers and stale cleanup", async () => {
  const worker = await own();
  const begun = await beginTalkCollectionCycle(worker, "calls", start);
  const outcomes = await Promise.allSettled([
    commitTalkCollectionPage(worker, "calls", begun.expectedHash, page()),
    commitTalkCollectionPage(worker, "calls", begun.expectedHash, page()),
  ]);
  expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  await db
    .update(sourceRecords)
    .set({
      payloadJson: sql`jsonb_set(payload_json,'{expiresAt}','"1970-01-01T00:00:00.000Z"'::jsonb)`,
    })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_talk_collection_lease_v1")
      )
    );
  await expect(reserveTalkRequest(worker)).rejects.toThrow("no longer owned");
  const successor = await own();
  await releaseTalkCollection(worker);
  expect((await claimTalkCollection(scope)).acquired).toBe(false);
  await expect(beginTalkCollectionCycle(successor, "calls", start + 1)).rejects.toThrow(
    "scope changed"
  );
});
it("rejects cross-organization access and account rebinding before writing", async () => {
  await expect(claimTalkCollection({ ...scope, organizationId: randomUUID() })).rejects.toThrow(
    "not permitted"
  );
  const worker = await own();
  const begun = await beginTalkCollectionCycle(worker, "calls", start);
  await db
    .update(dataSources)
    .set({ configurationReference: "zendesk-account:different" })
    .where(eq(dataSources.id, dataSourceId));
  await expect(
    commitTalkCollectionPage(worker, "calls", begun.expectedHash, page())
  ).rejects.toThrow("not permitted");
  expect((await records()).filter((r) => r.externalRecordType.includes("record_v1"))).toHaveLength(
    0
  );
});
it("rejects off-account continuation without advancing or retaining its records", async () => {
  const worker = await own();
  const begun = await beginTalkCollectionCycle(worker, "calls", start);
  await expect(
    commitTalkCollectionPage(worker, "calls", begun.expectedHash, {
      ...page(),
      next_page:
        "https://other.zendesk.com/api/v2/channels/voice/stats/incremental/calls.json?start_time=500",
    })
  ).rejects.toThrow("destination");
  expect((await beginTalkCollectionCycle(worker, "calls", start)).expectedHash).toBe(
    begun.expectedHash
  );
});
it("does not treat a corrupt checkpoint as an exhausted stream or restart over it", async () => {
  const worker = await own();
  await beginTalkCollectionCycle(worker, "calls", start);
  await db
    .update(sourceRecords)
    .set({ payloadJson: sql`jsonb_set(payload_json,'{cursor,status}','"unknown"'::jsonb)` })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_talk_collection_checkpoint_v1")
      )
    );
  const before = await records();
  await expect(beginTalkCollectionCycle(worker, "calls", start)).rejects.toThrow("Invalid stored");
  expect(await records()).toEqual(before);
});
it("keeps partial streams unavailable and retains unresolved joins in an exhausted snapshot", async () => {
  const before = await records();
  expect(await readTalkCollectionSnapshot(scope)).toMatchObject({
    status: "collecting",
    snapshot: null,
  });
  expect(await records()).toEqual(before);
  const worker = await own();
  const calls = await beginTalkCollectionCycle(worker, "calls", start);
  const legs = await beginTalkCollectionCycle(worker, "legs", start);
  await commitTalkCollectionPage(worker, "calls", calls.expectedHash, page([], 500));
  expect((await readTalkCollectionSnapshot(scope)).snapshot).toBeNull();
  const first = await commitTalkCollectionPage(worker, "legs", legs.expectedHash, {
    legs: [
      {
        id: 1,
        call_id: 99,
        agent_id: 42,
        type: "agent",
        completion_status: "completed",
        created_at: "2026-09-13T12:00:00Z",
        updated_at: "2026-09-13T13:00:00Z",
        talk_time: 10,
        hold_time: 0,
        duration: 20,
        consultation_time: null,
      },
    ],
    count: 1,
    end_time: 500,
    next_page: `${origin}/api/v2/channels/voice/stats/incremental/legs.json?start_time=500`,
  });
  await commitTalkCollectionPage(worker, "legs", first.expectedHash, {
    legs: [],
    count: 0,
    end_time: 500,
    next_page: null,
  });
  const snapshot = await readTalkCollectionSnapshot(scope);
  expect(snapshot).toMatchObject({
    status: "ready_for_qualification",
    joinedMetricCoverageCertified: false,
    snapshot: { missingParentCallIds: [99] },
  });
  const saved = await records();
  await readTalkCollectionSnapshot(scope);
  expect(await records()).toEqual(saved);
  await expect(
    readTalkCollectionSnapshot({ ...scope, organizationId: randomUUID() })
  ).rejects.toThrow("not permitted");
});
it("rejects stored source corruption instead of serving an apparently complete snapshot", async () => {
  const worker = await own();
  const calls = await beginTalkCollectionCycle(worker, "calls", start),
    legs = await beginTalkCollectionCycle(worker, "legs", start);
  const first = await commitTalkCollectionPage(worker, "calls", calls.expectedHash, page());
  await commitTalkCollectionPage(worker, "calls", first.expectedHash, page([], 500));
  await commitTalkCollectionPage(worker, "legs", legs.expectedHash, {
    legs: [],
    count: 0,
    end_time: 500,
    next_page: null,
  });
  expect((await readTalkCollectionSnapshot(scope)).snapshot?.calls).toHaveLength(1);
  await db
    .update(sourceRecords)
    .set({ payloadJson: sql`jsonb_set(payload_json,'{talk_time}','999'::jsonb)` })
    .where(
      and(
        eq(sourceRecords.dataSourceId, dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_talk_collection_record_v1")
      )
    );
  await expect(readTalkCollectionSnapshot(scope)).rejects.toThrow("digest");
});
