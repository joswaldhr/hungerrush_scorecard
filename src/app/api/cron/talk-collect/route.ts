import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { configuredTalkCollectionPolicy } from "@/lib/connectors/zendesk-talk-config";
import {
  createTalkExportReader,
  runTalkCollectionBatch,
} from "@/lib/connectors/zendesk-talk-worker";
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
    const policy = configuredTalkCollectionPolicy();
    if (!policy) return NextResponse.json({ enabled: false });
    const reader = createTalkExportReader(
      {
        subdomain: env.ZENDESK_SUBDOMAIN ?? "",
        email: env.ZENDESK_EMAIL ?? "",
        apiKey: env.ZENDESK_API_KEY ?? "",
      },
      policy.scope.accountReference
    );
    const result = await runTalkCollectionBatch(policy.scope, policy.bootstrapStart, reader);
    const status =
      result.status === "busy"
        ? 409
        : result.status === "waiting" || result.status === "rate_limited"
          ? 429
          : result.callsExhausted && result.legsExhausted
            ? 200
            : 202;
    return NextResponse.json(
      { enabled: true, ...result, joinedMetricCoverageCertified: false, metricsPublished: false },
      {
        status,
        headers:
          typeof result.waitMs === "number"
            ? { "Retry-After": String(Math.max(1, Math.ceil(result.waitMs / 1000))) }
            : undefined,
      }
    );
  } catch (error) {
    logger.error("Talk collection failed", { error });
    return NextResponse.json(
      { error: "Talk collection failed; retained checkpoints can resume", metricsPublished: false },
      { status: 503 }
    );
  }
}
