import { auth } from "@/lib/auth";
import { getEffectiveManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { runSync, recordComputeValuesTiming, ZendeskConnector } from "@/lib/connectors";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isSyncRateLimited } from "@/lib/rate-limit";

export async function POST(_request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  try {
    const [source] = await db
      .select()
      .from(dataSources)
      .where(
        and(eq(dataSources.organizationId, ctx.organizationId), eq(dataSources.type, "zendesk"))
      );

    if (!source) {
      return NextResponse.json({ error: "Zendesk data source not configured" }, { status: 404 });
    }

    if (await isSyncRateLimited(source.id)) {
      return NextResponse.json(
        { error: "A sync already ran recently. Try again in a few minutes." },
        { status: 429 }
      );
    }

    const connector = new ZendeskConnector();
    // Scoped to the current week only: a full 4-week sweep's fetch phase
    // alone measured ~14 minutes against the real Zendesk account, well
    // over Vercel's confirmed 300s function limit — this button would time
    // out the same way the cron did before it was split. Historical weeks
    // stay covered by the automated per-week cron legs (see vercel.json).
    const result = await runSync(
      connector,
      {
        dataSourceId: source.id,
        organizationId: ctx.organizationId,
      },
      { weekOffset: 0 }
    );

    const computeStartedAt = Date.now();
    const valuesWritten = await computeMetricValuesFromFacts(ctx.organizationId, "zendesk");
    await recordComputeValuesTiming(result.syncRunId, Date.now() - computeStartedAt);

    return NextResponse.json({ ...result, valuesWritten });
  } catch (err) {
    logger.error("Sync run failed", { error: err });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
