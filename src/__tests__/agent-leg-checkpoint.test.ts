// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import { advanceAgentLegExport, readAgentLegExport } from "@/lib/connectors/agent-leg-checkpoint";
import { SourceRetryLaterError } from "@/lib/connectors/source-retry";

const organizationId = randomUUID(),
  dataSourceId = randomUUID();
const scope = {
  organizationId,
  dataSourceId,
  start: new Date("2026-09-20T00:00:00Z"),
  endExclusive: new Date("2026-09-22T00:00:00Z"),
};
const leg = (id = 1, talk_time = 10, updated_at = "2026-09-22T12:00:00Z") => ({
  id,
  call_id: 7,
  agent_id: 42,
  type: "agent",
  completion_status: "completed",
  created_at: "2026-09-21T12:00:00Z",
  updated_at,
  talk_time,
  hold_time: 0,
  duration: 30,
  forwarded_to: "private phone",
});
const page = (legs: unknown[], next_page = "/boundary") => ({
  legs,
  count: legs.length,
  end_time: Date.parse("2026-09-23T00:00:00Z") / 1000,
  next_page,
});
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic legs" });
  await db
    .insert(dataSources)
    .values({ id: dataSourceId, organizationId, type: "staging", displayName: "Synthetic legs" });
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db.delete(dataSources).where(eq(dataSources.id, dataSourceId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

it("resumes and completes only on the unchanged Talk boundary while retaining corrections", async () => {
  const newer = leg(1, 20, "2026-09-23T00:00:00Z");
  await advanceAgentLegExport(scope, async () => page([leg(), newer]));
  expect((await readAgentLegExport(scope)).cohort).toBeNull();
  await advanceAgentLegExport(scope, async () => page([newer]));
  const result = await readAgentLegExport(scope);
  expect(result.cohort?.legs).toHaveLength(1);
  expect(result.cohort?.legs[0]?.talk_time).toBe(20);
  const records = await db
    .select()
    .from(sourceRecords)
    .where(eq(sourceRecords.dataSourceId, dataSourceId));
  expect(records.filter((row) => row.externalRecordType.includes("revision"))).toHaveLength(2);
  expect(JSON.stringify(records)).not.toContain("private phone");
});

it("does not replace a newer leg with an older late arrival", async () => {
  const newer = leg(1, 20, "2026-09-23T00:00:00Z");
  await advanceAgentLegExport(scope, async () => page([newer], "/two"));
  await advanceAgentLegExport(scope, async () => page([leg()], "/three"));
  await advanceAgentLegExport(scope, async () => page([]));
  expect((await readAgentLegExport(scope)).cohort?.legs[0]?.talk_time).toBe(20);
});

it("rejects conflicting same-time revisions without advancing", async () => {
  await advanceAgentLegExport(scope, async () => page([leg()]));
  await expect(advanceAgentLegExport(scope, async () => page([leg(1, 99)]))).rejects.toThrow(
    "Conflicting"
  );
  expect((await readAgentLegExport(scope)).state.pages).toBe(1);
  expect((await readAgentLegExport(scope)).cohort).toBeNull();
});

it("persists rate limits and rejects cross-organization access before fetching", async () => {
  await advanceAgentLegExport(scope, async () => {
    throw new SourceRetryLaterError(60000);
  });
  const get = vi.fn();
  await advanceAgentLegExport(scope, get);
  expect(get).not.toHaveBeenCalled();
  await expect(
    advanceAgentLegExport({ ...scope, organizationId: randomUUID() }, get)
  ).rejects.toThrow("not permitted");
});

it("allows only one concurrent response to advance the checkpoint", async () => {
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = async () => {
    if (++arrivals === 2) release();
    await gate;
    return page([leg()]);
  };
  const results = await Promise.all([
    advanceAgentLegExport(scope, get),
    advanceAgentLegExport(scope, get),
  ]);
  expect(results.filter((result) => result.advanced)).toHaveLength(1);
  expect((await readAgentLegExport(scope)).state.pages).toBe(1);
});

it("refuses open intervals and treats a stalled nonidentical boundary as incomplete", async () => {
  const get = vi.fn();
  await expect(
    advanceAgentLegExport({ ...scope, endExclusive: new Date(Date.now() + 60000) }, get)
  ).rejects.toThrow("Invalid");
  expect(get).not.toHaveBeenCalled();
  await advanceAgentLegExport(scope, async () => page([leg()]));
  await advanceAgentLegExport(scope, async () => page([leg(2)]));
  await expect(advanceAgentLegExport(scope, async () => page([leg(3)]))).rejects.toThrow("stalled");
  expect((await readAgentLegExport(scope)).cohort).toBeNull();
});
