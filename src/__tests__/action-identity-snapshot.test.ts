// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  dataSources,
  employees,
  externalIdentities,
  sourceRecords,
} from "@/lib/db/schema";
import {
  captureActionIdentitySnapshot,
  readActionIdentitySnapshot,
} from "@/lib/connectors/action-identity-snapshot";

const organizationId = randomUUID(),
  sourceId = randomUUID(),
  employeeId = randomUUID(),
  identityId = randomUUID();
const email = "synthetic@example.com";
const get = async () => ({
  users: [
    {
      id: 42,
      email,
      role: "agent",
      active: true,
      suspended: false,
      verified: true,
      phone: "private phone",
    },
  ],
  next_page: null,
});
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic snapshot" });
  await db
    .insert(dataSources)
    .values({ id: sourceId, organizationId, type: "staging", displayName: "Synthetic snapshot" });
  await db
    .insert(employees)
    .values({ id: employeeId, organizationId, displayName: "Synthetic snapshot" });
});
beforeEach(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, sourceId));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, sourceId));
  await db
    .update(employees)
    .set({ employmentStatus: "active" })
    .where(eq(employees.id, employeeId));
  await db.insert(externalIdentities).values({
    id: identityId,
    employeeId,
    dataSourceId: sourceId,
    externalEntityType: "user",
    externalId: email,
    matchMethod: "email",
  });
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, sourceId));
  await db.delete(externalIdentities).where(eq(externalIdentities.dataSourceId, sourceId));
  await db.delete(employees).where(eq(employees.id, employeeId));
  await db.delete(dataSources).where(eq(dataSources.id, sourceId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});

it("retains a frozen match after roster changes without claiming historical or human attribution", async () => {
  const observationId = randomUUID();
  const snapshot = await captureActionIdentitySnapshot(
    organizationId,
    sourceId,
    observationId,
    get
  );
  expect(snapshot.members[0]).toMatchObject({
    employeeId,
    employmentStatus: "active",
    match: "matched",
    account: { id: 42 },
  });
  expect(snapshot.historicalEligibility).toBe("unknown");
  expect(snapshot.humanActivityAttribution).toBe("unknown");
  expect(JSON.stringify(snapshot)).not.toContain(email);
  expect(JSON.stringify(snapshot)).not.toContain("private phone");
  await db
    .update(employees)
    .set({ employmentStatus: "inactive" })
    .where(eq(employees.id, employeeId));
  const noFetch = vi.fn();
  expect(
    await captureActionIdentitySnapshot(organizationId, sourceId, observationId, noFetch)
  ).toEqual(snapshot);
  expect(noFetch).not.toHaveBeenCalled();
  expect(
    (await captureActionIdentitySnapshot(organizationId, sourceId, randomUUID(), get)).members[0]
      ?.employmentStatus
  ).toBe("inactive");
});

it("does not persist partial or stale mapping observations", async () => {
  const observationId = randomUUID();
  await expect(
    captureActionIdentitySnapshot(organizationId, sourceId, observationId, async () => {
      throw new Error("Synthetic outage");
    })
  ).rejects.toThrow("outage");
  expect(await readActionIdentitySnapshot(organizationId, sourceId, observationId)).toBeNull();
  await expect(
    captureActionIdentitySnapshot(organizationId, sourceId, observationId, async () => {
      await db
        .update(externalIdentities)
        .set({ externalId: "changed@example.com" })
        .where(eq(externalIdentities.id, identityId));
      return get();
    })
  ).rejects.toThrow("changed during observation");
  expect(await readActionIdentitySnapshot(organizationId, sourceId, observationId)).toBeNull();
});

it("rejects unauthorized sources before vendor calls and duplicate account mappings", async () => {
  const noFetch = vi.fn();
  await expect(
    captureActionIdentitySnapshot(randomUUID(), sourceId, randomUUID(), noFetch)
  ).rejects.toThrow("not permitted");
  expect(noFetch).not.toHaveBeenCalled();
  await db.insert(externalIdentities).values({
    employeeId,
    dataSourceId: sourceId,
    externalEntityType: "user",
    externalId: "alias@example.com",
    matchMethod: "email",
  });
  await expect(
    captureActionIdentitySnapshot(organizationId, sourceId, randomUUID(), async (path) => ({
      users: [{ ...(await get()).users[0], email: decodeURIComponent(path.split("query=")[1]!) }],
      next_page: null,
    }))
  ).rejects.toThrow("Ambiguous employee-to-account");
});

it("records missing accounts explicitly instead of dropping their employees", async () => {
  const result = await captureActionIdentitySnapshot(
    organizationId,
    sourceId,
    randomUUID(),
    async () => ({ users: [], next_page: null })
  );
  expect(result.members).toHaveLength(1);
  expect(result.members[0]).toMatchObject({ employeeId, match: "missing", account: null });
});

it("returns one immutable winner when captures of the same observation race", async () => {
  const observationId = randomUUID();
  let arrivals = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetch = async () => {
    if (++arrivals === 2) release();
    await gate;
    return get();
  };
  const results = await Promise.all([
    captureActionIdentitySnapshot(organizationId, sourceId, observationId, fetch),
    captureActionIdentitySnapshot(organizationId, sourceId, observationId, fetch),
  ]);
  expect(results[0]).toEqual(results[1]);
  expect(
    await db.select().from(sourceRecords).where(eq(sourceRecords.dataSourceId, sourceId))
  ).toHaveLength(1);
});
