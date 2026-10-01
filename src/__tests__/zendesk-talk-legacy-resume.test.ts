// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import {
  claimTalkCollection,
  releaseTalkCollection,
  type TalkOwnedScope,
} from "@/lib/connectors/zendesk-talk-store";
import {
  beginLegacyTalkCycle,
  commitLegacyTalkPage,
  readLegacyTalkWeek,
} from "@/lib/connectors/zendesk-talk-legacy-store";
import { fetchCoordinatedTalkWeek } from "@/lib/connectors/zendesk-talk-legacy";

const scope = {
  organizationId: randomUUID(),
  dataSourceId: randomUUID(),
  accountReference: `zendesk-account:test-${randomUUID()}`,
};
const start = "2026-09-20",
  end = "2026-09-26";
const bootstrap = Date.parse(`${start}T00:00:00Z`) / 1000;
const path = (time: number) =>
  `https://${scope.accountReference.slice("zendesk-account:".length)}.zendesk.com/api/v2/channels/voice/stats/incremental/calls.json?start_time=${time}`;
const call = (id = 1, talk_time: number | null = 30) => ({
  id,
  created_at: "2026-09-21T00:00:00Z",
  updated_at: "2026-09-21T01:00:00Z",
  agent_id: 7,
  direction: "inbound",
  completion_status: "completed",
  duration: 50,
  talk_time,
  hold_time: 0,
  consultation_time: null,
  customer_phone: "never retain this",
});
const page = (calls = [call()], watermark = bootstrap + 500) => ({
  calls,
  count: calls.length,
  end_time: watermark,
  next_page: path(watermark),
});
async function own(): Promise<TalkOwnedScope> {
  const lease = await claimTalkCollection(scope);
  if (!lease.acquired) throw Error("Expected synthetic lease");
  return { ...scope, token: lease.token };
}
const rows = () =>
  db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, scope.dataSourceId));
beforeAll(async () => {
  await db
    .insert(organizations)
    .values({ id: scope.organizationId, name: "Synthetic legacy recovery" });
  await db.insert(dataSources).values({
    id: scope.dataSourceId,
    organizationId: scope.organizationId,
    type: "zendesk",
    displayName: "Synthetic recovery",
    status: "configured",
    configurationReference: scope.accountReference,
  });
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, scope.dataSourceId));
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, scope.dataSourceId));
  await db.delete(dataSources).where(eq(dataSources.id, scope.dataSourceId));
  await db.delete(organizations).where(eq(organizations.id, scope.organizationId));
});

it("resumes a new process at its saved cursor without returning partial results", async () => {
  const firstRead = vi.fn(async () => ({ rateLimited: false as const, page: page() }));
  await expect(
    fetchCoordinatedTalkWeek(scope, start, end, firstRead, { resumable: true, maxPages: 1 })
  ).rejects.toThrow("progress retained");
  expect(firstRead).toHaveBeenCalledTimes(1);
  const owner = await own();
  const resumed = await beginLegacyTalkCycle(owner, start, end);
  expect(resumed.state.cursor.path).toBe(path(bootstrap + 500));
  await expect(readLegacyTalkWeek(owner, start, end, resumed.expectedHash)).rejects.toThrow(
    "incomplete"
  );
  // The synthetic endpoint is empty on this resumed page. No real vendor request occurs.
  await releaseTalkCollection(owner);
  await db.execute(sql`update source_records set payload_json=jsonb_set(payload_json,'{nextAllowedAt}','"1970-01-01T00:00:00.000Z"')
    where data_source_id=${scope.dataSourceId} and external_record_type='zendesk_talk_collection_lease_v1'`);
  const nextRead = vi.fn<Parameters<typeof fetchCoordinatedTalkWeek>[3]>(async () => ({
    rateLimited: false as const,
    page: page([], bootstrap + 1000),
  }));
  const result = await fetchCoordinatedTalkWeek(scope, start, end, nextRead, {
    resumable: true,
    maxPages: 1,
  });
  expect(nextRead.mock.calls[0]?.[0]).toBe(path(bootstrap + 500));
  expect(result.calls).toEqual([
    expect.objectContaining({
      agent_id: 7,
      duration: 50,
      talk_time: 30,
      hold_time: 0,
      consultation_time: null,
    }),
  ]);
  expect(JSON.stringify(await rows())).not.toContain("never retain");
});

it("refreshes a completed cycle with overlap, retaining late corrections and nulls", async () => {
  const owner = await own();
  let current = await beginLegacyTalkCycle(owner, start, end);
  current = await commitLegacyTalkPage(owner, start, end, current.expectedHash, page());
  current = await commitLegacyTalkPage(owner, start, end, current.expectedHash, page());
  expect(
    (await readLegacyTalkWeek(owner, start, end, current.expectedHash)).calls[0]?.talk_time
  ).toBe(30);
  let refresh = await beginLegacyTalkCycle(owner, start, end);
  expect(refresh.state.cursor.path).toBe(path(bootstrap + 200));
  expect(refresh.state.cycle).toBe(2);
  await expect(readLegacyTalkWeek(owner, start, end, refresh.expectedHash)).rejects.toThrow(
    "incomplete"
  );
  const corrected = { ...call(1, null), updated_at: "2026-09-22T01:00:00Z" };
  refresh = await commitLegacyTalkPage(
    owner,
    start,
    end,
    refresh.expectedHash,
    page([corrected], bootstrap + 1000)
  );
  refresh = await commitLegacyTalkPage(
    owner,
    start,
    end,
    refresh.expectedHash,
    page([], bootstrap + 1100)
  );
  expect(
    (await readLegacyTalkWeek(owner, start, end, refresh.expectedHash)).calls[0]?.talk_time
  ).toBeNull();
  expect(
    (await rows()).filter((r) => r.externalRecordType === "zendesk_legacy_talk_revision_v1")
  ).toHaveLength(2);
  await releaseTalkCollection(owner);
});

it("rejects stale owners, stale checkpoints, foreign continuations and conflicting versions without advancing", async () => {
  const owner = await own();
  const initial = await beginLegacyTalkCycle(owner, start, end);
  const current = await commitLegacyTalkPage(owner, start, end, initial.expectedHash, page());
  const baseline = JSON.stringify(await rows());
  await expect(
    commitLegacyTalkPage(owner, start, end, initial.expectedHash, page())
  ).rejects.toThrow("changed");
  await expect(
    commitLegacyTalkPage(
      { ...owner, token: randomUUID() },
      start,
      end,
      current.expectedHash,
      page()
    )
  ).rejects.toThrow("owned");
  await expect(
    commitLegacyTalkPage(owner, start, end, current.expectedHash, {
      ...page(),
      next_page:
        "https://other.zendesk.com/api/v2/channels/voice/stats/incremental/calls.json?start_time=1",
    })
  ).rejects.toThrow("destination");
  await expect(
    commitLegacyTalkPage(owner, start, end, current.expectedHash, page([call(1, 99)]))
  ).rejects.toThrow("Conflicting");
  expect(JSON.stringify(await rows())).toBe(baseline);
  await releaseTalkCollection(owner);
});

it("rolls back records and versions if the checkpoint write fails", async () => {
  const owner = await own();
  const current = await beginLegacyTalkCycle(owner, start, end);
  const name = `legacy_fault_${randomUUID().replaceAll("-", "")}`;
  const baseline = JSON.stringify(await rows());
  await db.execute(
    sql.raw(
      `alter table source_records add constraint ${name} check (data_source_id != '${scope.dataSourceId}' or external_record_type != 'zendesk_legacy_talk_checkpoint_v1' or (payload_json->'cursor'->>'pages')::int=0) not valid`
    )
  );
  try {
    await expect(
      commitLegacyTalkPage(owner, start, end, current.expectedHash, page())
    ).rejects.toThrow();
    expect(JSON.stringify(await rows())).toBe(baseline);
  } finally {
    await db.execute(sql.raw(`alter table source_records drop constraint ${name}`));
    await releaseTalkCollection(owner);
  }
});

it("isolates weeks and filters by creation date after collecting every modified-since page", async () => {
  const owner = await own();
  let current = await beginLegacyTalkCycle(owner, start, end);
  current = await commitLegacyTalkPage(
    owner,
    start,
    end,
    current.expectedHash,
    page([{ ...call(2), created_at: "2026-09-28T00:00:00Z", updated_at: "2026-09-28T00:00:00Z" }])
  );
  current = await commitLegacyTalkPage(
    owner,
    start,
    end,
    current.expectedHash,
    page([call()], bootstrap + 1000)
  );
  current = await commitLegacyTalkPage(
    owner,
    start,
    end,
    current.expectedHash,
    page([], bootstrap + 1100)
  );
  expect(
    (await readLegacyTalkWeek(owner, start, end, current.expectedHash)).calls.map((c) => c.id)
  ).toEqual([1]);
  const other = await beginLegacyTalkCycle(owner, "2026-09-27", "2026-10-03");
  expect(other.state.cursor.pages).toBe(0);
  await expect(readLegacyTalkWeek(owner, start, end, other.expectedHash)).rejects.toThrow(
    "changed"
  );
  await releaseTalkCollection(owner);
});

it("refuses an old completed observation even when its checksum is valid", async () => {
  const owner = await own();
  let current = await beginLegacyTalkCycle(owner, start, end);
  current = await commitLegacyTalkPage(owner, start, end, current.expectedHash, page([]));
  const stale = {
    ...current.state,
    observationStartedAt: "2026-09-01T00:00:00.000Z",
    lastPageAt: "2026-09-01T00:01:00.000Z",
  };
  const hash = createHash("sha256").update(JSON.stringify(stale)).digest("hex");
  await db
    .update(sourceRecords)
    .set({ payloadJson: stale, payloadHash: hash })
    .where(
      and(
        eq(sourceRecords.dataSourceId, scope.dataSourceId),
        eq(sourceRecords.externalRecordType, "zendesk_legacy_talk_checkpoint_v1")
      )
    );
  await expect(readLegacyTalkWeek(owner, start, end, hash)).rejects.toThrow("no longer fresh");
  await releaseTalkCollection(owner);
});
