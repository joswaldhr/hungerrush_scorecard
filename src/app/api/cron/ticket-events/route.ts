import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { configuredReportEventCollectionPolicy } from "@/lib/connectors/zendesk-solved-config";
import {
  createReportEventReader,
  runReportEventBatch,
} from "@/lib/connectors/zendesk-report-event-worker";
import { logger } from "@/lib/logger";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Scheduler credential unavailable" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ([...new URL(request.url).searchParams].length)
    return NextResponse.json({ error: "Collection accepts no query parameters" }, { status: 400 });
  try {
    const policy = configuredReportEventCollectionPolicy();
    if (!policy) return NextResponse.json({ enabled: false });
    const read = createReportEventReader(
      {
        subdomain: env.ZENDESK_SUBDOMAIN ?? "",
        email: env.ZENDESK_EMAIL ?? "",
        apiKey: env.ZENDESK_API_KEY ?? "",
      },
      policy.scope.accountReference
    );
    const result = await runReportEventBatch(policy.scope, policy.bootstrapStart, read);
    const status =
      result.status === "busy"
        ? 409
        : result.status === "waiting" || result.status === "rate_limited"
          ? 429
          : result.streamExhausted
            ? 200
            : 202;
    return NextResponse.json(
      { enabled: true, ...result, metricsPublished: false, joinedMetricCoverageCertified: false },
      {
        status,
        headers:
          typeof result.waitMs === "number"
            ? { "Retry-After": String(Math.max(1, Math.ceil(result.waitMs / 1000))) }
            : undefined,
      }
    );
  } catch (error) {
    logger.error("Report-event collection failed", { error });
    return NextResponse.json(
      {
        error: "Report-event collection failed; retained checkpoints can resume",
        metricsPublished: false,
      },
      { status: 503 }
    );
  }
}
