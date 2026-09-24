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

export interface ActionShadowWriteScope {
  organizationId: string;
  dataSourceId: string;
  /** Hosted workers must fence every write; offline observation tools omit this token. */
  workerLeaseToken?: string;
}
type ShadowTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Lock source before checkpoint rows, matching lease acquisition's lock order. */
export async function assertActionShadowWrite(
  scope: ActionShadowWriteScope,
  tx: ShadowTransaction
) {
  if (scope.workerLeaseToken === undefined) {
    await assertOrganizationResource(scope.organizationId, "source", scope.dataSourceId, tx);
    return;
  }
  const [source] = await tx
    .select()
    .from(dataSources)
    .where(
      and(
        eq(dataSources.id, scope.dataSourceId),
        eq(dataSources.organizationId, scope.organizationId)
      )
    )
    .for("update");
  if (!source || source.type !== "zendesk" || source.status !== "configured")
    throw new Error("Shadow source is no longer enabled");
  const [row] = await tx
    .select()
    .from(sourceRecords)
    .where(filter(scope.dataSourceId))
    .for("update");
  const lease = leaseSchema.safeParse(row?.payloadJson);
  const [clock] = await tx.execute<{ now: string }>(sql`select clock_timestamp()::text as now`);
  if (
    !lease.success ||
    lease.data.token !== scope.workerLeaseToken ||
    Date.parse(lease.data.expiresAt) <= Date.parse(clock!.now)
  )
    throw new Error("Shadow worker lease is no longer owned");
}

/** Six minutes exceeds the hosted invocation limit; database time owns expiry. */
export async function claimActionShadowLease(organizationId: string, dataSourceId: string) {
  return db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, dataSourceId))
      .for("update");
    await assertOrganizationResource(organizationId, "source", dataSourceId, tx);
    if (!source || source.type !== "zendesk" || source.status !== "configured")
      throw new Error("Shadow source is no longer enabled");
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
