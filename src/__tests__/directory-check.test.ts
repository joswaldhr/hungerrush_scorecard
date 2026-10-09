// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, employees, dataSources, sourceRecords } from "@/lib/db/schema";
import { getDirectoryReview, runDirectoryCheck } from "@/lib/domain/roster/directory-check";
import {
  DIRECTORY_RECORD,
  directoryHealth,
  directoryStateSchema,
} from "@/lib/domain/roster/directory-state";
import { entraAccountReference } from "@/lib/connectors/entra-roster";

const org = randomUUID(),
  foreign = randomUUID(),
  source = randomUUID();
const first = randomUUID(),
  second = randomUUID(),
  outsider = randomUUID();
const credentials = { tenantId: randomUUID(), clientId: randomUUID(), clientSecret: "synthetic" };
const config = { sourceId: source, credentials };
const binding = { sourceId: source, tenantId: credentials.tenantId };
const reference = entraAccountReference(credentials.tenantId);
const reader = vi.fn(async (members: { id: string }[]) =>
  members.map((e) => ({
    employeeId: e.id,
    status: e.id === first ? ("disabled" as const) : ("enabled" as const),
  }))
);
const records = () => db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
async function alter(patch: Record<string, unknown>) {
  const current = (await records()).find((r) => r.externalRecordType === DIRECTORY_RECORD)!;
  await db
    .update(sourceRecords)
    .set({ payloadJson: { ...(current.payloadJson as object), ...patch } })
    .where(eq(sourceRecords.id, current.id));
}
beforeAll(async () => {
  await db
    .insert(organizations)
    .values([org, foreign].map((id) => ({ id, name: "Synthetic directory" })));
  await db.insert(dataSources).values({
    id: source,
    organizationId: org,
    type: "entra",
    displayName: "Synthetic directory",
    configurationReference: reference,
  });
  await db.insert(employees).values([
    { id: first, organizationId: org, displayName: "Synthetic One", email: "one@example.invalid" },
    { id: second, organizationId: org, displayName: "Synthetic Two", email: "two@example.invalid" },
    {
      id: outsider,
      organizationId: foreign,
      displayName: "Foreign Employee",
      email: "foreign@example.invalid",
    },
  ]);
});
beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  await db
    .update(dataSources)
    .set({ configurationReference: reference })
    .where(eq(dataSources.id, source));
  await db.update(employees).set({ email: "one@example.invalid" }).where(eq(employees.id, first));
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(employees).where(inArray(employees.id, [first, second, outsider]));
  await db.delete(organizations).where(inArray(organizations.id, [org, foreign]));
});
it("persists evidence and scoped conflicts without changing employees or metric freshness", async () => {
  const before = await db.select().from(employees).where(eq(employees.organizationId, org));
  const sourceBefore = await db.select().from(dataSources).where(eq(dataSources.id, source));
  expect(await runDirectoryCheck(config, reader)).toEqual({
    status: "completed",
    checked: 2,
    conflicts: 1,
  });
  expect(await db.select().from(employees).where(eq(employees.organizationId, org))).toEqual(
    before
  );
  expect(await db.select().from(dataSources).where(eq(dataSources.id, source))).toEqual(
    sourceBefore
  );
  expect(await records()).toHaveLength(2);
  const review = await getDirectoryReview(org, [first, outsider], binding);
  expect(review).toMatchObject({
    health: "current",
    total: 1,
    checked: 1,
    rows: [{ employeeId: first, status: "disabled" }],
  });
  expect((await getDirectoryReview(org, [second], binding)).rows).toEqual([]);
  expect((await getDirectoryReview(foreign, [first], binding)).health).toBe("unavailable");
  expect((await getDirectoryReview(org, [], binding)).total).toBe(0);
  expect(JSON.stringify(review)).not.toContain("@example.invalid");
});
it("prevents overlapping checks and repeated requests during cooldown", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let started!: () => void;
  const ready = new Promise<void>((resolve) => {
    started = resolve;
  });
  const running = runDirectoryCheck(config, async (members) => {
    started();
    await held;
    return reader(members);
  });
  await ready;
  expect(await runDirectoryCheck(config, reader)).toEqual({ status: "deferred" });
  release();
  await running;
  expect(await runDirectoryCheck(config, reader)).toEqual({ status: "deferred" });
  expect(reader).toHaveBeenCalledTimes(1);
});
it("retains last-good evidence when Graph fails and shows failure rather than all-clear", async () => {
  await runDirectoryCheck(config, reader);
  const before = await getDirectoryReview(org, "admin", binding);
  await alter({ lastAttemptAt: new Date(Date.now() - 20 * 60000).toISOString() });
  expect(
    await runDirectoryCheck(config, async () => {
      throw Error("private Graph response");
    })
  ).toEqual({ status: "failed" });
  const result = await getDirectoryReview(org, "admin", binding);
  expect(result).toMatchObject({
    health: "failed",
    observedAt: before.observedAt,
    rows: before.rows,
  });
  expect(await records()).toHaveLength(2);
});
it("rejects changed employee identity during publication and invalidates older identity evidence", async () => {
  expect(
    await runDirectoryCheck(config, async (members) => {
      await db
        .update(employees)
        .set({ email: "changed@example.invalid" })
        .where(eq(employees.id, first));
      return reader(members);
    })
  ).toEqual({ status: "failed" });
  expect(
    (await records()).some((r) => r.externalRecordType === "entra_roster_observation_v1")
  ).toBe(false);
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  await runDirectoryCheck(config, reader);
  await db
    .update(employees)
    .set({ email: "another@example.invalid" })
    .where(eq(employees.id, first));
  expect((await getDirectoryReview(org, [first], binding)).rows[0]?.status).toBe("not_checked");
});
it("rejects changed source bindings and partial result sets", async () => {
  expect(await runDirectoryCheck(config, async () => [])).toEqual({ status: "failed" });
  await db
    .update(dataSources)
    .set({ configurationReference: "entra-tenant:other" })
    .where(eq(dataSources.id, source));
  await expect(runDirectoryCheck(config, reader)).rejects.toThrow("binding");
  expect(reader).not.toHaveBeenCalled();
  expect((await getDirectoryReview(org, "admin", binding)).health).toBe("unavailable");
});
it("shows expired, stale and future-dated observations honestly", async () => {
  await runDirectoryCheck(config, reader);
  const state = directoryStateSchema.parse(
    (await records()).find((r) => r.externalRecordType === DIRECTORY_RECORD)!.payloadJson
  );
  expect(directoryHealth(state, new Date(Date.now() + 37 * 3600000))).toBe("stale");
  expect(directoryHealth(state, new Date(Date.now() - 60000))).toBe("unavailable");
  expect(
    directoryHealth(
      {
        ...state,
        outcome: "running",
        lease: { token: randomUUID(), expiresAt: new Date(Date.now() - 1000).toISOString() },
      },
      new Date()
    )
  ).toBe("interrupted");
});

it("rejects a source rebind during a check without publishing evidence", async () => {
  expect(
    await runDirectoryCheck(config, async (members) => {
      await db
        .update(dataSources)
        .set({ configurationReference: "entra-tenant:changed" })
        .where(eq(dataSources.id, source));
      return reader(members);
    })
  ).toEqual({ status: "failed" });
  expect(
    (await records()).some((r) => r.externalRecordType === "entra_roster_observation_v1")
  ).toBe(false);
});

it("an expired worker cannot overwrite a replacement lease", async () => {
  expect(
    await runDirectoryCheck(config, async (members) => {
      await alter({
        lease: { token: randomUUID(), expiresAt: new Date(Date.now() + 60000).toISOString() },
      });
      return reader(members);
    })
  ).toEqual({ status: "failed" });
  const state = directoryStateSchema.parse(
    (await records()).find((r) => r.externalRecordType === DIRECTORY_RECORD)!.payloadJson
  );
  expect(state.outcome).toBe("running");
  expect(state.observation).toBeNull();
});
