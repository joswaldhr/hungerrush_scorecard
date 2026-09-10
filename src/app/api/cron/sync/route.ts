import { db } from "@/lib/db";
import { dataSources, rosterSourceTeamMappings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  runSync,
  recordComputeValuesTiming,
  ZendeskConnector,
  MAX_WEEKS_BACK,
} from "@/lib/connectors";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

// This route is hit by Vercel Cron once a day and does real work (network
// calls + DB writes) every time — it must never be served from a cached
// response. Route Handlers do NOT inherit `dynamic` from a parent layout.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    // No sync_runs row exists yet at this point, and sync_errors.syncRunId is
    // NOT NULL — there's nothing to attach a DB row to. This is the only
    // record this failure leaves anywhere, so it needs to be unmistakable.
    logger.error("Cron sync rejected: CRON_SECRET not configured on this environment", {
      route: "/api/cron/sync",
    });
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    logger.error("Cron sync rejected: Authorization header did not match CRON_SECRET", {
      route: "/api/cron/sync",
      hasAuthHeader: !!authHeader,
      authHeaderLength: authHeader?.length ?? 0,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A full 4-week sweep's fetch phase alone measured ~14 minutes against the
  // real Zendesk account — well over Vercel's confirmed 300s function limit.
  // vercel.json now fires this route 4x/day, staggered, each with its own
  // ?week=N, so a single invocation only ever fetches one week.
  const weekParam = new URL(request.url).searchParams.get("week");
  let weekOffset: number | undefined;
  if (weekParam !== null) {
    const parsed = Number(weekParam);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed >= MAX_WEEKS_BACK) {
      return NextResponse.json({ error: "Invalid week parameter" }, { status: 400 });
    }
    weekOffset = parsed;
  }

  const sources = await db.select().from(dataSources).where(eq(dataSources.type, "zendesk"));
  const results = [];

  for (const source of sources) {
    if (await isSyncRateLimited(source.id)) {
      results.push({ dataSourceId: source.id, type: source.type, skipped: "rate_limited" });
      continue;
    }

    try {
      const connector = new ZendeskConnector();
      const syncResult = await runSync(
        connector,
        {
          dataSourceId: source.id,
          organizationId: source.organizationId,
        },
        { weekOffset }
      );
      const computeStartedAt = Date.now();
      const valuesWritten = await computeMetricValuesFromFacts(source.organizationId, source.type);
      await recordComputeValuesTiming(syncResult.syncRunId, Date.now() - computeStartedAt);

      // Roster membership doesn't change week-to-week — only check it once
      // a day (on the week=0 leg, or on an un-parameterized manual trigger)
      // rather than redundantly on all 4 staggered legs.
      let rosterResult: { newCandidates: number; departedCandidates: number } | null = null;
      if (weekOffset === undefined || weekOffset === 0) {
        const [mapping] = await db
          .select({ id: rosterSourceTeamMappings.id })
          .from(rosterSourceTeamMappings)
          .where(eq(rosterSourceTeamMappings.dataSourceId, source.id))
          .limit(1);
        if (mapping) {
          rosterResult = await discoverRosterCandidates(connector, source.id);
        }
      }

      results.push({
        dataSourceId: source.id,
        type: source.type,
        sync: syncResult,
        valuesWritten,
        roster: rosterResult,
      });
    } catch (err) {
      logger.error("Cron sync failed for data source", { error: err, dataSourceId: source.id });
      results.push({
        dataSourceId: source.id,
        type: source.type,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // Dead-man's-switch heartbeat: confirms the cron actually reached and ran
  // this logic (not just that Vercel invoked the route). Deliberately NOT
  // pinged from the 401/500 early-returns above — those mean the real work
  // never happened, which is exactly what should make the switch go silent
  // and alert. Best-effort only: a failure here must never affect the
  // response this route returns to Vercel's cron caller.
  if (env.SYNC_HEARTBEAT_URL) {
    try {
      await fetch(env.SYNC_HEARTBEAT_URL, { method: "GET", signal: AbortSignal.timeout(5000) });
    } catch (err) {
      logger.warn("Sync heartbeat ping failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
