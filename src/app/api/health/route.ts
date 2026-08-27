import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Deliberately unauthenticated (excluded in src/proxy.ts's matcher) so uptime
// monitors can hit it without a session.
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok" });
  } catch (err) {
    logger.error("Health check failed", { error: err });
    return NextResponse.json({ status: "error" }, { status: 503 });
  }
}
