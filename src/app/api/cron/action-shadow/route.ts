import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { zendeskGet } from "@/lib/connectors/zendesk-shared";
import { nextActionShadowScope, runActionShadowBatch } from "@/lib/connectors/action-shadow-worker";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Scheduler-neutral trigger; no frequency beyond the host plan is configured here. */
export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Worker authentication is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.ACTION_SHADOW_SOURCE_ID) return NextResponse.json({ enabled: false });
  if (!env.ZENDESK_SUBDOMAIN || !env.ZENDESK_EMAIL || !env.ZENDESK_API_KEY)
    return NextResponse.json(
      { error: "Shadow source credentials are not configured" },
      { status: 503 }
    );
  try {
    const [source] = await db
      .select()
      .from(dataSources)
      .where(eq(dataSources.id, env.ACTION_SHADOW_SOURCE_ID));
    if (!source || source.type !== "zendesk")
      return NextResponse.json({ error: "Invalid shadow source configuration" }, { status: 503 });
    const scope = await nextActionShadowScope(source.organizationId, source.id);
    const result = await runActionShadowBatch(scope, (path) =>
      zendeskGet(path, undefined, { deferRateLimit: true })
    );
    return NextResponse.json({ enabled: true, ...result });
  } catch (error) {
    logger.error("Action shadow worker failed", { error });
    return NextResponse.json(
      { error: "Action shadow worker failed; checkpoint retained" },
      { status: 503 }
    );
  }
}
