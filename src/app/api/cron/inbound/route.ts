import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { configuredTalkCollectionPolicy } from "@/lib/connectors/zendesk-talk-config";
import { parseInboundReleasePolicy } from "@/lib/connectors/zendesk-inbound-publication-record";
import { assertZendeskAccountBinding } from "@/lib/connectors/zendesk-account-binding";
import { createLiveInboundPublisher } from "@/lib/connectors/zendesk-inbound-publisher";
import { runSync } from "@/lib/connectors/sync-engine";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { weekDates } from "@/lib/utils";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Scheduler credential unavailable" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams,
    week = params.get("week");
  if (params.size !== 1 || !week || !/^[0-3]$/.test(week))
    return NextResponse.json({ error: "One valid week offset is required" }, { status: 400 });
  try {
    if (!env.ZENDESK_INBOUND_REPORT_RELEASE) return NextResponse.json({ enabled: false });
    const release = parseInboundReleasePolicy(JSON.parse(env.ZENDESK_INBOUND_REPORT_RELEASE));
    assertZendeskAccountBinding(release.policy.accountReference, env.ZENDESK_SUBDOMAIN ?? "");
    const { periodStart, periodEnd } = weekDates(Number(week));
    if (periodStart < release.policy.effectivePeriodStart)
      return NextResponse.json({
        enabled: true,
        skipped: "before_prospective_cutover",
        periodStart,
        periodEnd,
      });
    const collection = configuredTalkCollectionPolicy();
    if (!collection) throw Error("Inbound requires an explicit collection policy");
    if (await isSyncRateLimited(release.policy.dataSourceId))
      return NextResponse.json({ error: "Source is in its sync cooldown" }, { status: 429 });
    const result = await runSync(
      createLiveInboundPublisher(release, collection),
      { organizationId: release.policy.organizationId, dataSourceId: release.policy.dataSourceId },
      { weekOffset: Number(week) }
    );
    return NextResponse.json(
      { ...result, periodStart, periodEnd },
      { status: result.success ? 200 : 503 }
    );
  } catch (error) {
    logger.error("Inbound scheduled sync failed", { error });
    return NextResponse.json(
      { error: "Inbound sync failed; check source diagnostics" },
      { status: 503 }
    );
  }
}
