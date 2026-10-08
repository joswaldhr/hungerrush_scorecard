import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { directoryConfig } from "@/lib/domain/roster/directory-config";
import { runDirectoryCheck } from "@/lib/domain/roster/directory-check";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!env.CRON_SECRET)
    return NextResponse.json({ error: "Worker authentication missing" }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const probe = new URL(request.url).searchParams.get("probe");
  if (probe && probe !== "auth")
    return NextResponse.json({ error: "Unknown probe" }, { status: 400 });
  if (probe === "auth") return NextResponse.json({ authenticated: true, checkRequested: false });
  if (!env.ENTRA_ROSTER_SOURCE_ID) return NextResponse.json({ enabled: false });
  try {
    const config = directoryConfig();
    if (!config)
      return NextResponse.json({ error: "Directory configuration incomplete" }, { status: 503 });
    const result = await runDirectoryCheck(config);
    return NextResponse.json(result, { status: result.status === "failed" ? 503 : 200 });
  } catch {
    return NextResponse.json({ error: "Directory check unavailable" }, { status: 503 });
  }
}
