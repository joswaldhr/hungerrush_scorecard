import { db } from "@/lib/db";
import { dataSources, rosterSourceTeamMappings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { runSync, ZendeskConnector } from "@/lib/connectors";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";
import { discoverRosterCandidates } from "@/lib/domain/roster/reconcile";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sources = await db
    .select()
    .from(dataSources)
    .where(eq(dataSources.type, "zendesk"));
  const results = [];

  for (const source of sources) {
    if (await isSyncRateLimited(source.id)) {
      results.push({ dataSourceId: source.id, type: source.type, skipped: "rate_limited" });
      continue;
    }

    try {
      const connector = new ZendeskConnector();
      const syncResult = await runSync(connector, {
        dataSourceId: source.id,
        organizationId: source.organizationId,
      });
      const valuesWritten = await computeMetricValuesFromFacts(source.organizationId, source.type);

      let rosterResult: { newCandidates: number; departedCandidates: number } | null = null;
      const [mapping] = await db
        .select({ id: rosterSourceTeamMappings.id })
        .from(rosterSourceTeamMappings)
        .where(eq(rosterSourceTeamMappings.dataSourceId, source.id))
        .limit(1);
      if (mapping) {
        rosterResult = await discoverRosterCandidates(connector, source.id);
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

  return NextResponse.json({ results });
}
