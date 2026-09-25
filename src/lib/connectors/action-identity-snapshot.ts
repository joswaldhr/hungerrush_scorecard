import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { dataSources, employees, externalIdentities, sourceRecords } from "@/lib/db/schema";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import { resolveActionActor } from "./zendesk-action-identity";

const TYPE = "zendesk_action_identity_snapshot_v2_shadow";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const snapshotSchema = z.object({
  version: z.literal(1),
  observedFrom: z.string().datetime(),
  observedUntil: z.string().datetime(),
  historicalEligibility: z.literal("unknown"),
  humanActivityAttribution: z.literal("unknown"),
  members: z.array(
    z.object({
      identityId: z.string().uuid(),
      employeeId: z.string().uuid(),
      emailHash: z.string(),
      employmentStatus: z.string(),
      observedAt: z.string().datetime(),
      match: z.enum(["matched", "missing", "ambiguous"]),
      account: z
        .object({
          id: z.number().int().positive().safe(),
          role: z.enum(["agent", "admin", "end-user"]),
          active: z.boolean(),
          suspended: z.boolean(),
          emailVerified: z.boolean(),
        })
        .nullable(),
    })
  ),
});

const predicate = (sourceId: string, observationId: string) =>
  and(
    eq(sourceRecords.dataSourceId, sourceId),
    eq(sourceRecords.externalRecordType, TYPE),
    eq(sourceRecords.externalRecordId, z.string().uuid().parse(observationId))
  );

export async function readActionIdentitySnapshot(
  organizationId: string,
  sourceId: string,
  observationId: string
) {
  await assertOrganizationResource(organizationId, "source", sourceId);
  const [row] = await db.select().from(sourceRecords).where(predicate(sourceId, observationId));
  if (!row) return null;
  // PostgreSQL jsonb does not preserve object key order; validate the stored shape directly.
  return snapshotSchema.parse(row.payloadJson);
}

type Connection = Pick<typeof db, "select">;
function inventory(connection: Connection, sourceId: string) {
  return connection
    .select({
      identityId: externalIdentities.id,
      employeeId: employees.id,
      organizationId: employees.organizationId,
      email: externalIdentities.externalId,
      employmentStatus: employees.employmentStatus,
    })
    .from(externalIdentities)
    .innerJoin(employees, eq(externalIdentities.employeeId, employees.id))
    .where(eq(externalIdentities.dataSourceId, sourceId))
    .orderBy(externalIdentities.id);
}

/** Offline capture primitive. No partial snapshot is saved and no current observation certifies history. */
export async function captureActionIdentitySnapshot(
  organizationId: string,
  sourceId: string,
  observationId: string,
  getPage: (path: string) => Promise<unknown>
) {
  const existing = await readActionIdentitySnapshot(organizationId, sourceId, observationId);
  if (existing) return existing;
  const observedFrom = new Date().toISOString();
  const identities = await inventory(db, sourceId);
  if (identities.length > 250)
    throw new Error("Identity snapshot exceeds bounded offline capture size");
  if (identities.some((identity) => identity.organizationId !== organizationId))
    throw new Error("Identity snapshot contains an out-of-scope employee");
  const members: z.infer<typeof snapshotSchema>["members"] = [];
  const accounts = new Set<number>();
  for (const identity of identities) {
    if (Date.now() - Date.parse(observedFrom) > 200_000)
      throw new Error("Identity snapshot capture budget exhausted");
    const result = await resolveActionActor(identity.email, (path) => {
      // Production callback has a 30-second timeout. Reserve it before each search page.
      if (Date.now() - Date.parse(observedFrom) > 170_000)
        throw new Error("Identity snapshot capture budget exhausted");
      return getPage(path);
    });
    if (result.user && accounts.has(result.user.id))
      throw new Error("Ambiguous employee-to-account mapping");
    if (result.user) accounts.add(result.user.id);
    members.push({
      identityId: identity.identityId,
      employeeId: identity.employeeId,
      emailHash: hash(identity.email.trim().toLowerCase()),
      employmentStatus: identity.employmentStatus,
      observedAt: new Date().toISOString(),
      match: result.status,
      account: result.user
        ? {
            id: result.user.id,
            role: result.user.role,
            active: result.user.active,
            suspended: result.user.suspended,
            emailVerified: result.user.verified,
          }
        : null,
    });
  }
  const snapshot = snapshotSchema.parse({
    version: 1,
    observedFrom,
    observedUntil: new Date().toISOString(),
    historicalEligibility: "unknown",
    humanActivityAttribution: "unknown",
    members,
  });
  return db.transaction(async (tx) => {
    await tx
      .select({ id: dataSources.id })
      .from(dataSources)
      .where(eq(dataSources.id, sourceId))
      .for("update");
    await assertOrganizationResource(organizationId, "source", sourceId, tx);
    const current = await inventory(tx, sourceId).for("share");
    if (hash(current) !== hash(identities))
      throw new Error("Identity mappings changed during observation");
    const [winner] = await tx
      .select()
      .from(sourceRecords)
      .where(predicate(sourceId, observationId));
    if (winner) return snapshotSchema.parse(winner.payloadJson);
    await tx.insert(sourceRecords).values({
      dataSourceId: sourceId,
      externalRecordType: TYPE,
      externalRecordId: observationId,
      payloadJson: snapshot,
      payloadHash: hash(snapshot),
    });
    return snapshot;
  });
}
