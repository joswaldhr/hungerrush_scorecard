import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dataSources, sourceRecords } from "@/lib/db/schema";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";

const TYPE = "zendesk_action_worker_lease_v2_shadow";
const KEY = "source";
const leaseSchema = z.object({ token: z.string().uuid(), expiresAt: z.string().datetime() });
const filter = (dataSourceId: string) =>
  and(
    eq(sourceRecords.dataSourceId, dataSourceId),
    eq(sourceRecords.externalRecordType, TYPE),
    eq(sourceRecords.externalRecordId, KEY)
  );

/** Six minutes exceeds the hosted invocation limit; database time owns expiry. */
export async function claimActionShadowLease(organizationId: string, dataSourceId: string) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: dataSources.id })
      .from(dataSources)
      .where(eq(dataSources.id, dataSourceId))
      .for("update");
    await assertOrganizationResource(organizationId, "source", dataSourceId, tx);
    const [clock] = await tx.execute<{ now: string; expires: string }>(sql`
      select clock_timestamp()::text as now, (clock_timestamp() + interval '6 minutes')::text as expires
    `);
    const [existing] = await tx.select().from(sourceRecords).where(filter(dataSourceId));
    if (existing) {
      const previous = leaseSchema.parse(existing.payloadJson);
      if (Date.parse(previous.expiresAt) > Date.parse(clock!.now))
        return { acquired: false as const, retryAt: previous.expiresAt };
    }
    const lease = { token: randomUUID(), expiresAt: new Date(clock!.expires).toISOString() };
    const values = {
      dataSourceId,
      externalRecordType: TYPE,
      externalRecordId: KEY,
      payloadJson: lease,
      payloadHash: createHash("sha256").update(JSON.stringify(lease)).digest("hex"),
      ingestedAt: new Date(clock!.now),
    };
    await tx
      .insert(sourceRecords)
      .values(values)
      .onConflictDoUpdate({
        target: [
          sourceRecords.dataSourceId,
          sourceRecords.externalRecordType,
          sourceRecords.externalRecordId,
        ],
        set: values,
      });
    return { acquired: true as const, ...lease };
  });
}

/** An expired owner's cleanup must not remove its successor's lease. */
export async function releaseActionShadowLease(dataSourceId: string, token: string) {
  await db
    .delete(sourceRecords)
    .where(and(filter(dataSourceId), sql`${sourceRecords.payloadJson}->>'token' = ${token}`));
}
