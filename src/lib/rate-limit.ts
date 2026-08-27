import { db } from "@/lib/db";
import { syncRuns, reconciliationRuns } from "@/lib/db/schema";
import { eq, and, gte } from "drizzle-orm";

const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const RECONCILIATION_COOLDOWN_MS = 5 * 60 * 1000;

/** Refuses a new sync for a data source that started one within the cooldown window. */
export async function isSyncRateLimited(dataSourceId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - SYNC_COOLDOWN_MS);
  const [recent] = await db
    .select({ id: syncRuns.id })
    .from(syncRuns)
    .where(and(eq(syncRuns.dataSourceId, dataSourceId), gte(syncRuns.startedAt, cutoff)))
    .limit(1);
  return !!recent;
}

/** Refuses a new reconciliation run for an org that started one within the cooldown window. */
export async function isReconciliationRateLimited(organizationId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - RECONCILIATION_COOLDOWN_MS);
  const [recent] = await db
    .select({ id: reconciliationRuns.id })
    .from(reconciliationRuns)
    .where(
      and(
        eq(reconciliationRuns.organizationId, organizationId),
        gte(reconciliationRuns.startedAt, cutoff)
      )
    )
    .limit(1);
  return !!recent;
}
