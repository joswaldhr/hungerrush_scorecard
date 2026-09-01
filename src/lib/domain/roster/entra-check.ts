import { db } from "@/lib/db";
import {
  externalIdentities,
  rosterCandidates,
  employees,
  dataSources,
  syncRuns,
} from "@/lib/db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import type { EntraClient } from "@/lib/connectors/entra";

/**
 * Checks Entra's accountEnabled status for every employee with a verified Entra identity
 * (matched via the /admin/entra-identities backfill, never guessed by email -- see
 * ARCHITECTURE.md). A disabled account for a still-active employee becomes a "departed"
 * roster_candidates row for human review, same as Zendesk/Assembled discovery -- never
 * auto-applied.
 *
 * Doesn't go through the metric-sync pipeline (runSync/sourceRecords/normalizedFacts) --
 * there's nothing to ingest or normalize here, just an account-status check. Still writes
 * its own syncRuns row so Data Health shows it the same way as Zendesk/Assembled.
 */
export async function checkEntraAccountStatus(
  client: EntraClient,
  entraDataSourceId: string
): Promise<{ checked: number; departedFound: number }> {
  const [run] = await db
    .insert(syncRuns)
    .values({ dataSourceId: entraDataSourceId, status: "running" })
    .returning();
  if (!run) throw new Error("Failed to create sync run");

  try {
    const result = await performCheck(client, entraDataSourceId);
    await db
      .update(syncRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        recordsIngested: result.checked,
        recordsNormalized: result.departedFound,
      })
      .where(eq(syncRuns.id, run.id));
    await db
      .update(dataSources)
      .set({ lastSuccessfulSyncAt: new Date() })
      .where(eq(dataSources.id, entraDataSourceId));
    return result;
  } catch (err) {
    await db
      .update(syncRuns)
      .set({ status: "failed", completedAt: new Date(), errorCount: 1 })
      .where(eq(syncRuns.id, run.id));
    throw err;
  }
}

async function performCheck(
  client: EntraClient,
  entraDataSourceId: string
): Promise<{ checked: number; departedFound: number }> {
  const verifiedIdentities = await db
    .select({
      externalId: externalIdentities.externalId,
      employeeId: externalIdentities.employeeId,
    })
    .from(externalIdentities)
    .where(
      and(
        eq(externalIdentities.dataSourceId, entraDataSourceId),
        isNotNull(externalIdentities.verifiedAt),
        ne(externalIdentities.matchMethod, "confirmed_no_match")
      )
    );

  if (verifiedIdentities.length === 0) {
    return { checked: 0, departedFound: 0 };
  }

  const activeEmployeeIds = new Set(
    (
      await db
        .select({ id: employees.id })
        .from(employees)
        .where(eq(employees.employmentStatus, "active"))
    ).map((e) => e.id)
  );

  const toCheck = verifiedIdentities.filter((i) => activeEmployeeIds.has(i.employeeId));
  const statusByObjectId = await client.getAccountStatus(toCheck.map((i) => i.externalId));

  const existingPending = await db
    .select({ employeeId: rosterCandidates.employeeId })
    .from(rosterCandidates)
    .where(
      and(
        eq(rosterCandidates.dataSourceId, entraDataSourceId),
        eq(rosterCandidates.status, "pending")
      )
    );
  const pendingEmployeeIds = new Set(existingPending.map((c) => c.employeeId));

  let departedFound = 0;

  for (const identity of toCheck) {
    const status = statusByObjectId.get(identity.externalId);
    if (!status || status.accountEnabled) continue;
    if (pendingEmployeeIds.has(identity.employeeId)) continue;

    await db.insert(rosterCandidates).values({
      dataSourceId: entraDataSourceId,
      externalId: identity.externalId,
      externalEmail: null,
      externalDisplayName: status.displayName,
      changeType: "departed",
      employeeId: identity.employeeId,
      status: "pending",
    });
    departedFound++;
  }

  return { checked: toCheck.length, departedFound };
}
