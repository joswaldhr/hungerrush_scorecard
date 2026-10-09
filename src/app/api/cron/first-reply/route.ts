import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { configuredFirstReplyPolicy } from "@/lib/connectors/zendesk-first-reply-config";
import { firstReplyPolicyForPeriod } from "@/lib/connectors/zendesk-first-reply-policy";
import { createFirstReplyConnector } from "@/lib/connectors/zendesk-first-reply-connector";
import { runSync } from "@/lib/connectors/sync-engine";
import { MAX_WEEKS_BACK } from "@/lib/connectors/zendesk";
import { weekDates } from "@/lib/utils";
import { isSyncRateLimited } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

import {
  configuredQualifiedRecovery,
  planQualifiedRecovery,
} from "@/lib/connectors/zendesk-qualified-recovery";
import { requestReportJobs } from "@/lib/connectors/zendesk-report-jobs";

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
    const recovery = configuredQualifiedRecovery("first-reply");
    if (recovery) {
      const plan = planQualifiedRecovery("first-reply", recovery.policy);
      if (plan.requests.length) await requestReportJobs(recovery.scope, plan.requests);
      return NextResponse.json(
        { enabled: true, delegated: true, completed: false },
        { status: 202 }
      );
    }
    const policy = configuredFirstReplyPolicy();
    if (!policy) return NextResponse.json({ enabled: false });
    const { periodStart, periodEnd } = weekDates(offset);
    const config = { dataSourceId: policy.dataSourceId, organizationId: policy.organizationId };
    if (!firstReplyPolicyForPeriod(policy, config, periodStart))
      return NextResponse.json({
        enabled: true,
        skipped: "before_prospective_cutover",
        periodStart,
        periodEnd,
      });
    if (await isSyncRateLimited(config.dataSourceId))
      return NextResponse.json({ error: "Source is in its sync cooldown" }, { status: 429 });
    const result = await runSync(createFirstReplyConnector(policy), config, {
      period: { periodStart, periodEnd },
    });
    return NextResponse.json(
      { ...result, periodStart, periodEnd },
      { status: result.success ? 200 : 503 }
    );
  } catch (error) {
    logger.error("First-reply scheduled sync failed", { error });
    return NextResponse.json(
      { error: "First-reply sync failed; check source diagnostics" },
      { status: 503 }
    );
  }
}
