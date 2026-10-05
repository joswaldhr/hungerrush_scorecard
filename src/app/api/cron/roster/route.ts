import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ZendeskConnector } from "@/lib/connectors/zendesk";
import { getRosterDiscoveryHealth, runRosterDiscoveryJob } from "@/lib/domain/roster/discovery-job";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** No schedule or source activation is implied by deploying this route. */
export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Worker authentication missing" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const probe = new URL(request.url).searchParams.get("probe");
  if (probe !== null && probe !== "auth" && probe !== "health")
    return NextResponse.json({ error: "Unknown probe" }, { status: 400 });
  if (probe === "auth")
    return NextResponse.json({ authenticated: true, discoveryRequested: false });
  if (!env.ROSTER_DISCOVERY_SOURCE_ID) return NextResponse.json({ enabled: false });
  try {
    if (probe === "health")
      return NextResponse.json({
        enabled: true,
        discoveryRequested: false,
        latest: await getRosterDiscoveryHealth(env.ROSTER_DISCOVERY_SOURCE_ID),
      });
    if (!env.ZENDESK_SUBDOMAIN || !env.ZENDESK_EMAIL || !env.ZENDESK_API_KEY)
      return NextResponse.json({ error: "Roster source credentials missing" }, { status: 503 });
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
