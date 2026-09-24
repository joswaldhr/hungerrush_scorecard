import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { zendeskGet } from "@/lib/connectors/zendesk-shared";
import { nextActionShadowScope, runActionShadowBatch } from "@/lib/connectors/action-shadow-worker";
import {
  claimActionShadowLease,
  releaseActionShadowLease,
} from "@/lib/connectors/action-shadow-lease";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Scheduler-neutral trigger; no frequency beyond the host plan is configured here. */
export async function GET(request: Request) {
  const secret = env.ACTION_SHADOW_SECRET ?? env.CRON_SECRET;
  if (!secret)
    return NextResponse.json({ error: "Worker authentication is not configured" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // A credential rehearsal must never become ingestion if source settings change later.
  if (new URL(request.url).searchParams.get("probe") === "auth")
    return NextResponse.json({ authenticated: true, ingestionRequested: false });
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
    if (!source || source.type !== "zendesk" || source.status !== "configured")
      return NextResponse.json({ error: "Invalid shadow source configuration" }, { status: 503 });
    const lease = await claimActionShadowLease(source.organizationId, source.id);
    if (!lease.acquired)
      return NextResponse.json({ enabled: true, busy: true, retryAt: lease.retryAt });
    try {
      const scope = await nextActionShadowScope(source.organizationId, source.id);
      const result = await runActionShadowBatch(
        { ...scope, workerLeaseToken: lease.token },
        (path) => zendeskGet(path, undefined, { deferRateLimit: true })
      );
      return NextResponse.json({ enabled: true, ...result });
    } finally {
      await releaseActionShadowLease(source.id, lease.token);
    }
  } catch (error) {
    logger.error("Action shadow worker failed", { error });
    return NextResponse.json(
      { error: "Action shadow worker failed; checkpoint retained" },
      { status: 503 }
    );
  }
}
