import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  configuredReportEventCollectionPolicy,
  configuredSolvedReportReleases,
} from "@/lib/connectors/zendesk-solved-config";
import { runLiveReportRecovery } from "@/lib/connectors/zendesk-report-recovery";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Scheduler credential unavailable" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  if (
    query.getAll("slot").length !== 1 ||
    !/^(?:[0-9]|1[0-9]|2[0-3])$/.test(query.get("slot") ?? "") ||
    [...query.keys()].some((key) => key !== "slot")
  )
    return NextResponse.json(
      { error: "One daily scheduler slot from 0 to 23 is required" },
      { status: 400 }
    );
  if (env.ZENDESK_REPORT_RECOVERY !== "1") return NextResponse.json({ enabled: false });
  try {
    const collection = configuredReportEventCollectionPolicy(),
      releases = configuredSolvedReportReleases();
    if (!collection || !releases.length) throw Error("Report recovery policies unavailable");
    const result = await runLiveReportRecovery(collection, releases, {
      subdomain: env.ZENDESK_SUBDOMAIN ?? "",
      email: env.ZENDESK_EMAIL ?? "",
      apiKey: env.ZENDESK_API_KEY ?? "",
    });
    return NextResponse.json(
      { enabled: true, ...result },
      { status: result.status === "failed" ? 503 : result.status === "deferred" ? 202 : 200 }
    );
  } catch (error) {
    logger.error("Report recovery failed", { error });
    return NextResponse.json(
      { error: "Report recovery failed; inspect retained jobs" },
      { status: 503 }
    );
  }
}
