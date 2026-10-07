// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, organizations, sourceRecords, syncErrors, syncRuns } from "@/lib/db/schema";
import { createLeasedSyncRun, renewSyncLease } from "@/lib/connectors/sync-lease";
import {
  claimReportEventCollection,
  deferReportEventRequests,
  releaseReportEventCollection,
} from "@/lib/connectors/zendesk-report-event-store";

const organizationId = randomUUID();
const ids = [randomUUID(), randomUUID(), randomUUID()];
const accountReference = `zendesk-account:test-${randomUUID()}`;
const otherAccount = `zendesk-account:test-${randomUUID()}`;
const scope = { organizationId, dataSourceId: ids[0]!, accountReference };

async function clear() {
  await db
    .delete(syncErrors)
    .where(
      inArray(
        syncErrors.syncRunId,
        db.select({ id: syncRuns.id }).from(syncRuns).where(inArray(syncRuns.dataSourceId, ids))
      )
    );
  await db.delete(syncRuns).where(inArray(syncRuns.dataSourceId, ids));
  await db.delete(sourceRecords).where(inArray(sourceRecords.dataSourceId, ids));
}
async function collect() {
  const lease = await claimReportEventCollection(scope);
  if (!lease.acquired) throw Error("Expected synthetic collector ownership");
  return { ...scope, token: lease.token };
}
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic coordination" });
  await db.insert(dataSources).values(
    ids.map((id, i) => ({
      id,
      organizationId,
      type: "zendesk",
      displayName: "Synthetic coordination",
      status: "configured",
      configurationReference: i === 2 ? otherAccount : accountReference,
    }))
  );
});
beforeEach(clear);
afterAll(async () => {
  await clear();
  await db.delete(dataSources).where(inArray(dataSources.id, ids));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

it("prevents same-account publishers in any week while report collection owns the lease", async () => {
  const owned = await collect();
  const runs = await Promise.all([
    createLeasedSyncRun(ids[0]!, 0),
    createLeasedSyncRun(ids[1]!, 1),
  ]);
  expect(runs.map((r) => r.status)).toEqual(["skipped", "skipped"]);
  expect(runs.every((r) => r.completedAt !== null)).toBe(true);
  expect(runs[0]!.metadataJson).toMatchObject({
    reason: "Report collection owns the account or its request cooldown",
  });
  await releaseReportEventCollection(owned);
  expect((await createLeasedSyncRun(ids[1]!, 1)).status).toBe("running");
});

it("defers a collector until every same-account publisher finishes", async () => {
  const first = await createLeasedSyncRun(ids[0]!, 0);
  const second = await createLeasedSyncRun(ids[1]!, 1);
  expect(first.status).toBe("running");
  expect(second.status).toBe("running");
  const blocked = await claimReportEventCollection(scope);
  expect(blocked.acquired).toBe(false);
  if (!blocked.acquired) expect(Date.parse(blocked.retryAt)).toBeGreaterThan(Date.now());
  await db.update(syncRuns).set({ status: "completed" }).where(eq(syncRuns.id, first.id));
  expect((await claimReportEventCollection(scope)).acquired).toBe(false);
  await db.update(syncRuns).set({ status: "completed" }).where(eq(syncRuns.id, second.id));
  expect((await claimReportEventCollection(scope)).acquired).toBe(true);
});

it.each([0, 1])(
  "atomically chooses one owner during a collector/publisher race on source %s",
  async (index) => {
    const [collection, publication] = await Promise.all([
      claimReportEventCollection(scope),
      createLeasedSyncRun(ids[index]!, 2),
    ]);
    expect(Number(collection.acquired) + Number(publication.status === "running")).toBe(1);
    expect(["running", "skipped"]).toContain(publication.status);
  }
);

it("preserves source cooldown after a collector releases and allows work after it expires", async () => {
  const owned = await collect();
  await deferReportEventRequests(owned, 60000);
  await releaseReportEventCollection(owned);
  expect((await createLeasedSyncRun(ids[1]!, 0)).status).toBe("skipped");
  await db
    .update(sourceRecords)
    .set({
      payloadJson: sql`jsonb_set(payload_json,'{nextAllowedAt}','"1970-01-01T00:00:00.000Z"'::jsonb)`,
    })
    .where(eq(sourceRecords.dataSourceId, ids[0]!));
  expect((await createLeasedSyncRun(ids[1]!, 0)).status).toBe("running");
});

it("ignores an expired publisher but fences its late renewal", async () => {
  const run = await createLeasedSyncRun(ids[1]!, 3);
  await db
    .update(syncRuns)
    .set({
      metadataJson: { leaseScope: "week:3", leaseExpiresAt: "1970-01-01T00:00:00.000Z" },
    })
    .where(eq(syncRuns.id, run.id));
  expect((await claimReportEventCollection(scope)).acquired).toBe(true);
  await expect(renewSyncLease(run.id)).rejects.toThrow("expired or was superseded");
});

it("recovers an expired collector without allowing its late release to unlock a new owner", async () => {
  const owned = await collect();
  await db
    .update(sourceRecords)
    .set({
      payloadJson: sql`jsonb_set(payload_json,'{expiresAt}','"1970-01-01T00:00:00.000Z"'::jsonb)`,
    })
    .where(eq(sourceRecords.dataSourceId, ids[0]!));
  const run = await createLeasedSyncRun(ids[1]!, 0);
  expect(run.status).toBe("running");
  await releaseReportEventCollection(owned);
  expect((await claimReportEventCollection(scope)).acquired).toBe(false);
});

it("does not block an unrelated Zendesk account", async () => {
  await collect();
  expect((await createLeasedSyncRun(ids[2]!, 0)).status).toBe("running");
  expect(
    (
      await claimReportEventCollection({
        organizationId,
        dataSourceId: ids[2]!,
        accountReference: otherAccount,
      })
    ).acquired
  ).toBe(false);
});

it("does not grant a publisher when retained collection expiry is missing", async () => {
  await collect();
  await db
    .update(sourceRecords)
    .set({ payloadJson: {} })
    .where(eq(sourceRecords.dataSourceId, ids[0]!));
  expect((await createLeasedSyncRun(ids[1]!, 0)).status).toBe("skipped");
});

it("honors the expiry fallback for a running publisher created without lease metadata", async () => {
  await db.insert(syncRuns).values({ dataSourceId: ids[1]!, status: "running" });
  expect((await claimReportEventCollection(scope)).acquired).toBe(false);
  await db
    .update(syncRuns)
    .set({ startedAt: new Date(Date.now() - 11 * 60 * 1000) })
    .where(eq(syncRuns.dataSourceId, ids[1]!));
  expect((await claimReportEventCollection(scope)).acquired).toBe(true);
});

it("retains the existing week-specific publisher concurrency for sources without a collector", async () => {
  const current = await createLeasedSyncRun(ids[0]!, 0);
  expect(current.status).toBe("running");
  expect((await createLeasedSyncRun(ids[0]!, 1)).status).toBe("running");
  expect((await createLeasedSyncRun(ids[0]!, 0)).status).toBe("skipped");
  expect((await createLeasedSyncRun(ids[0]!)).status).toBe("skipped");
});
