import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ZendeskConnector } from "@/lib/connectors/zendesk";
import { getRosterDiscoveryHealth, runRosterDiscoveryJob } from "@/lib/domain/roster/discovery-job";

import {
  configuredRosterRecovery,
  planRosterRecovery,
  getRosterRecoveryHealth,
} from "@/lib/connectors/zendesk-roster-recovery";
import { requestReportJobs } from "@/lib/connectors/zendesk-report-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** No schedule or source activation is implied by deploying this route. */
export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Worker authentication missing" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const query = new URL(request.url).searchParams;
  const probe = query.get("probe");
  // A misspelled diagnostic request must never fall through to source work.
  if (
    [...query.keys()].some((key) => key !== "probe") ||
    query.getAll("probe").length > 1 ||
    (probe !== null && probe !== "auth" && probe !== "health")
  )
    return NextResponse.json({ error: "Invalid roster query" }, { status: 400 });
  if (probe === "auth")
    return NextResponse.json({ authenticated: true, discoveryRequested: false });
  if (!env.ROSTER_DISCOVERY_SOURCE_ID) return NextResponse.json({ enabled: false });
  try {
    if (probe === "health")
      return NextResponse.json({
        enabled: true,
        discoveryRequested: false,
        latest: await getRosterDiscoveryHealth(env.ROSTER_DISCOVERY_SOURCE_ID),
        recovery: await getRosterRecoveryHealth(),
      });
    if (!env.ZENDESK_SUBDOMAIN || !env.ZENDESK_EMAIL || !env.ZENDESK_API_KEY)
      return NextResponse.json({ error: "Roster source credentials missing" }, { status: 503 });
    const recovery = configuredRosterRecovery();
    if (recovery) {
      await requestReportJobs(recovery, planRosterRecovery(recovery).requests);
      return NextResponse.json(
        { enabled: true, queued: true, completed: false, reviewOnly: true },
        { status: 202 }
      );
    }
    const result = await runRosterDiscoveryJob(
      env.ROSTER_DISCOVERY_SOURCE_ID,
      env.ZENDESK_SUBDOMAIN,
      new ZendeskConnector()
    );
    return NextResponse.json(result, { status: result.success ? 200 : 503 });
  } catch {
    return NextResponse.json({ error: "Roster worker unavailable" }, { status: 503 });
  }
}
