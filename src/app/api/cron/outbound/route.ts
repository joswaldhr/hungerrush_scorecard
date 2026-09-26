import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { configuredOutboundPolicy } from "@/lib/connectors/zendesk-talk-config";
import { talkPolicyForPeriod } from "@/lib/connectors/zendesk-talk-policy";
import { createOutboundConnector } from "@/lib/connectors/zendesk-outbound-connector";
import { runSync } from "@/lib/connectors/sync-engine";
import { MAX_WEEKS_BACK } from "@/lib/connectors/zendesk";
import { weekDates } from "@/lib/utils";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Scheduler credential unavailable" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const value = params.get("week");
  if (
    params.size !== 1 ||
    value === null ||
    !/^[0-3]$/.test(value) ||
    Number(value) >= MAX_WEEKS_BACK
  )
    return NextResponse.json({ error: "One valid week offset is required" }, { status: 400 });
  const offset = Number(value);
  try {
    const policy = configuredOutboundPolicy();
    if (!policy) return NextResponse.json({ enabled: false });
    const { periodStart, periodEnd } = weekDates(offset);
    const config = { dataSourceId: policy.dataSourceId, organizationId: policy.organizationId };
    if (!talkPolicyForPeriod(policy, config, periodStart))
      return NextResponse.json({
        enabled: true,
        skipped: "before_prospective_cutover",
        periodStart,
        periodEnd,
      });
    if (await isSyncRateLimited(config.dataSourceId))
      return NextResponse.json({ error: "Source is in its sync cooldown" }, { status: 429 });
    const result = await runSync(createOutboundConnector(policy), config, { weekOffset: offset });
    return NextResponse.json(
      { ...result, periodStart, periodEnd },
      { status: result.success ? 200 : 503 }
    );
  } catch (error) {
    logger.error("Outbound scheduled sync failed", { error });
    return NextResponse.json(
      { error: "Outbound sync failed; check source diagnostics" },
      { status: 503 }
    );
  }
}
