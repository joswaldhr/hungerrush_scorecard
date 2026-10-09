import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, rosterDiscoveryRuns, rosterSourceTeamMappings } from "@/lib/db/schema";
import type { Connector } from "@/lib/connectors/types";
import { assertZendeskAccountBinding } from "@/lib/connectors/zendesk-account-binding";
import { discoverRosterCandidates } from "./reconcile";
import {
  assertReportAccountOwnership,
  claimReportEventCollection,
  deferReportEventRequests,
  releaseReportEventCollection,
  type OwnedReportEventScope,
} from "@/lib/connectors/zendesk-report-event-store";
import { SourceRetryLaterError } from "@/lib/connectors/source-retry";
import { logger } from "@/lib/logger";

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
  let account: OwnedReportEventScope | undefined;
  try {
    const scope = {
      organizationId: claim.source.organizationId,
      dataSourceId: sourceId,
      accountReference: claim.source.configurationReference!,
    };
    const lease = await claimReportEventCollection(scope);
    if (!lease.acquired)
      throw new SourceRetryLaterError(Math.max(1, Date.parse(lease.retryAt) - Date.now()));
    account = { ...scope, token: lease.token };
    // Claiming ownership preserves, but does not consume, a prior vendor cooldown.
    const waitMs = Date.parse(lease.nextAllowedAt) - Date.now();
    if (waitMs > 0) throw new SourceRetryLaterError(waitMs);
    const ownedAccount = account;
    const result = await discoverRosterCandidates(connector, sourceId, {
      reviewOnly: true,
      lockPublication: (tx) => assertReportAccountOwnership(tx, ownedAccount),
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
  } catch (error) {
    const deferred = error instanceof SourceRetryLaterError;
    let cooldownRecorded = true;
    if (deferred && account) {
      try {
        await deferReportEventRequests(account, error.retryAfterMs);
      } catch {
        cooldownRecorded = false;
        logger.warn("Roster source cooldown could not be persisted; review run health");
      }
    }
    await db
      .update(rosterDiscoveryRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
        failureCode: !cooldownRecorded
          ? "cooldown_record_failed"
          : deferred
            ? "source_deferred"
            : "discovery_failed",
      })
      .where(
        and(eq(rosterDiscoveryRuns.id, claim.run.id), eq(rosterDiscoveryRuns.status, "running"))
      );
    return {
      success: false,
      reviewOnly: true,
      ...(deferred && cooldownRecorded
        ? { retryAt: new Date(Date.now() + error.retryAfterMs).toISOString() }
        : {}),
      error: "Roster discovery failed; review run health.",
    };
  } finally {
    if (account) {
      try {
        await releaseReportEventCollection(account);
      } catch {
        // A disabled/rebound source fails closed; its bounded lease can expire.
        logger.warn("Roster account lease release unavailable; expiry remains enforced");
      }
    }
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
