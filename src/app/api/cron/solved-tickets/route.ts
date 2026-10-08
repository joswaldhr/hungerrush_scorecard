import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { configuredSolvedReportReleases } from "@/lib/connectors/zendesk-solved-config";
import { createLiveUpdaterSolvedPublisher } from "@/lib/connectors/zendesk-updater-solved-publisher";
import { createLiveAssigneeSolvedPublisher } from "@/lib/connectors/zendesk-assignee-solved-publisher";
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
  const query = new URL(request.url).searchParams,
    kind = query.get("kind"),
    week = query.get("week");
  if (
    !["updater", "assignee-solved"].includes(kind ?? "") ||
    week === null ||
    !/^[0-3]$/.test(week) ||
    query.getAll("kind").length !== 1 ||
    query.getAll("week").length !== 1 ||
    [...query.keys()].some((key) => !["kind", "week"].includes(key))
  )
    return NextResponse.json(
      { error: "One report kind and week offset are required" },
      { status: 400 }
    );
  try {
    const policy = configuredSolvedReportReleases().find((p) => p.kind === kind);
    if (!policy) return NextResponse.json({ enabled: false });
    const offset = Number(week),
      { periodStart, periodEnd } = weekDates(offset);
    if (periodStart < policy.effectivePeriodStart)
      return NextResponse.json({
        enabled: true,
        skipped: "before_release_cutover",
        periodStart,
        periodEnd,
      });
    if (await isSyncRateLimited(policy.dataSourceId))
      return NextResponse.json({ error: "Source is in its sync cooldown" }, { status: 429 });
    const credentials = {
      subdomain: env.ZENDESK_SUBDOMAIN ?? "",
      email: env.ZENDESK_EMAIL ?? "",
      apiKey: env.ZENDESK_API_KEY ?? "",
    };
    const connector =
      policy.kind === "updater"
        ? createLiveUpdaterSolvedPublisher(policy, credentials)
        : createLiveAssigneeSolvedPublisher(policy, credentials);
    const result = await runSync(
      connector,
      { organizationId: policy.organizationId, dataSourceId: policy.dataSourceId },
      { period: { periodStart, periodEnd } }
    );
    return NextResponse.json(
      { ...result, periodStart, periodEnd },
      { status: result.success ? 200 : 503 }
    );
  } catch (error) {
    logger.error("Solved-report publication failed", { error });
    return NextResponse.json(
      { error: "Solved-report publication failed; check source diagnostics" },
      { status: 503 }
    );
  }
}
