// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { organizations, dataSources, sourceRecords } from "@/lib/db/schema";
import {
  claimActionShadowLease,
  releaseActionShadowLease,
} from "@/lib/connectors/action-shadow-lease";

const organizationId = randomUUID(),
  dataSourceId = randomUUID();
beforeAll(async () => {
  await db.insert(organizations).values({ id: organizationId, name: "Synthetic lease" });
  await db.insert(dataSources).values({
    id: dataSourceId,
    organizationId,
    type: "zendesk",
    status: "configured",
    displayName: "Synthetic lease",
  });
});
afterAll(async () => {
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, dataSourceId));
  await db.delete(dataSources).where(eq(dataSources.id, dataSourceId));
  await db.delete(organizations).where(eq(organizations.id, organizationId));
});
it("allows one concurrent owner, recovers expiry, and rejects stale-owner release", async () => {
  const claims = await Promise.all([
    claimActionShadowLease(organizationId, dataSourceId),
    claimActionShadowLease(organizationId, dataSourceId),
  ]);
  expect(claims.filter((claim) => claim.acquired)).toHaveLength(1);
  const owner = claims.find((claim) => claim.acquired)!;
  if (!owner.acquired) throw new Error("Missing owner");
  await db
    .update(sourceRecords)
    .set({
      payloadJson: sql`jsonb_set(${sourceRecords.payloadJson}, '{expiresAt}', '"2000-01-01T00:00:00.000Z"'::jsonb)`,
    })
    .where(eq(sourceRecords.dataSourceId, dataSourceId));
  const next = await claimActionShadowLease(organizationId, dataSourceId);
  expect(next.acquired).toBe(true);
  if (!next.acquired) throw new Error("Missing successor");
  await releaseActionShadowLease(dataSourceId, owner.token);
  expect((await claimActionShadowLease(organizationId, dataSourceId)).acquired).toBe(false);
  await releaseActionShadowLease(dataSourceId, next.token);
  const afterRelease = await claimActionShadowLease(organizationId, dataSourceId);
  expect(afterRelease.acquired).toBe(true);
});
it("rejects a different organization before acquiring a lease", async () => {
  await expect(claimActionShadowLease(randomUUID(), dataSourceId)).rejects.toThrow();
});
