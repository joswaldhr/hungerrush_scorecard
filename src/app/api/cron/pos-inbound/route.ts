import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { configuredTalkCollectionPolicy } from "@/lib/connectors/zendesk-talk-config";
import { parsePosInboundRelease } from "@/lib/connectors/zendesk-pos-inbound-publication";
import { createLivePosInboundPublisher } from "@/lib/connectors/zendesk-pos-inbound-publisher";
import { assertZendeskAccountBinding } from "@/lib/connectors/zendesk-account-binding";
import { runSync } from "@/lib/connectors/sync-engine";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { weekDates } from "@/lib/utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Separate, default-off POS contract. Installing this route does not schedule it. */
export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Scheduler credential unavailable" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const week = params.get("week");
  if (params.size !== 1 || !week || !/^[0-3]$/.test(week))
    return NextResponse.json({ error: "One valid week offset is required" }, { status: 400 });

  try {
    if (!env.ZENDESK_POS_INBOUND_RELEASE) return NextResponse.json({ enabled: false });
    const release = parsePosInboundRelease(JSON.parse(env.ZENDESK_POS_INBOUND_RELEASE));
    assertZendeskAccountBinding(release.policy.accountReference, env.ZENDESK_SUBDOMAIN ?? "");
    // Resolve once before asynchronous work; cooldown/lease waits cannot shift the week.
    const { periodStart, periodEnd } = weekDates(Number(week));
    const period = { periodStart, periodEnd };
    if (periodStart < release.policy.effectivePeriodStart)
      return NextResponse.json({ enabled: true, skipped: "before_prospective_cutover", ...period });

    const collection = configuredTalkCollectionPolicy();
    if (!collection) throw Error("POS inbound requires an explicit collection policy");
    // Factory validates matching account/source/organization before any source work.
    const connector = createLivePosInboundPublisher(release, collection);
    if (await isSyncRateLimited(release.policy.dataSourceId))
      return NextResponse.json({ error: "Source is in its sync cooldown" }, { status: 429 });
    const result = await runSync(
      connector,
      { organizationId: release.policy.organizationId, dataSourceId: release.policy.dataSourceId },
      { period }
    );
    return NextResponse.json({ ...result, ...period }, { status: result.success ? 200 : 503 });
  } catch (error) {
    logger.error("POS inbound scheduled sync failed", { error });
    return NextResponse.json(
      { error: "POS inbound sync failed; check source diagnostics" },
      { status: 503 }
    );
  }
}
