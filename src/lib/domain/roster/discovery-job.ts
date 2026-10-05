import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, rosterDiscoveryRuns, rosterSourceTeamMappings } from "@/lib/db/schema";
import type { Connector } from "@/lib/connectors/types";
import { assertZendeskAccountBinding } from "@/lib/connectors/zendesk-account-binding";
import { discoverRosterCandidates } from "./reconcile";

/** Independent, review-only work. Never updates metric freshness or employee assignments. */
export async function runRosterDiscoveryJob(
  sourceId: string,
  subdomain: string,
  connector: Connector
) {
  const claim = await db.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, sourceId))
      .for("update");
    if (!source || source.type !== "zendesk" || source.status !== "configured")
      throw new Error("Roster source is not configured");
    assertZendeskAccountBinding(source.configurationReference, subdomain);
    const [mapping] = await tx
      .select({ id: rosterSourceTeamMappings.id })
      .from(rosterSourceTeamMappings)
      .where(eq(rosterSourceTeamMappings.dataSourceId, sourceId))
      .limit(1);
    if (!mapping) throw new Error("Roster group mapping required");
    // The hosted worker has a 300s limit. Expire only runs older than twice that
    // limit; publication rechecks the run token under this same source lock.
    await tx
      .update(rosterDiscoveryRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureCode: "worker_expired",
      })
      .where(
        and(
          eq(rosterDiscoveryRuns.dataSourceId, sourceId),
          eq(rosterDiscoveryRuns.status, "running"),
          sql`${rosterDiscoveryRuns.startedAt} < now() - interval '10 minutes'`
        )
      );
    const [busy] = await tx
      .select({ id: rosterDiscoveryRuns.id })
      .from(rosterDiscoveryRuns)
      .where(
        and(
          eq(rosterDiscoveryRuns.dataSourceId, sourceId),
          gte(rosterDiscoveryRuns.startedAt, sql`now() - interval '10 minutes'`)
        )
      )
      .limit(1);
    if (busy) return null;
    const [run] = await tx
      .insert(rosterDiscoveryRuns)
      .values({ dataSourceId: sourceId })
      .returning();
    return { run: run!, source };
  });
  if (!claim) return { success: false, busy: true };
  try {
    const result = await discoverRosterCandidates(connector, sourceId, {
      reviewOnly: true,
      validatePublication: async (tx) => {
        const [source] = await tx.select().from(dataSources).where(eq(dataSources.id, sourceId));
        if (
          !source ||
          source.status !== "configured" ||
          source.type !== "zendesk" ||
          source.organizationId !== claim.source.organizationId ||
          source.configurationReference !== claim.source.configurationReference
        )
          throw new Error("Roster source changed during discovery");
        const [run] = await tx
          .select()
          .from(rosterDiscoveryRuns)
          .where(
            and(eq(rosterDiscoveryRuns.id, claim.run.id), eq(rosterDiscoveryRuns.status, "running"))
          );
        if (!run) throw new Error("Roster discovery run expired");
      },
      recordResult: async (tx, result) => {
        await tx
          .update(rosterDiscoveryRuns)
          .set({
            status: "completed",
            completedAt: new Date(),
            newCandidates: result.newCandidates,
            departedCandidates: result.departedCandidates,
          })
          .where(
            and(eq(rosterDiscoveryRuns.id, claim.run.id), eq(rosterDiscoveryRuns.status, "running"))
          );
      },
    });
    return { success: true, reviewOnly: true, ...result };
  } catch {
    await db
      .update(rosterDiscoveryRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureCode: "discovery_failed",
      })
      .where(
        and(eq(rosterDiscoveryRuns.id, claim.run.id), eq(rosterDiscoveryRuns.status, "running"))
      );
    return {
      success: false,
      reviewOnly: true,
      error: "Roster discovery failed; review run health.",
    };
  }
}

export async function getRosterDiscoveryHealth(sourceId: string) {
  const [latest] = await db
    .select()
    .from(rosterDiscoveryRuns)
    .where(eq(rosterDiscoveryRuns.dataSourceId, sourceId))
    .orderBy(desc(rosterDiscoveryRuns.startedAt))
    .limit(1);
  return latest ?? null;
}
