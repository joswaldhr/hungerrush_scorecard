import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, assertCanAccessTeam } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { reconciliationRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { runReconciliation } from "@/lib/domain/reconciliation";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  const body = (await request.json()) as {
    teamId?: string;
    periodStart: string;
    periodEnd: string;
    thresholdPct?: number;
  };

  if (!body.periodStart || !body.periodEnd) {
    return NextResponse.json({ error: "periodStart and periodEnd are required" }, { status: 400 });
  }

  if (!DATE_RE.test(body.periodStart) || !DATE_RE.test(body.periodEnd)) {
    return NextResponse.json(
      { error: "Invalid date format (expected YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (body.teamId) {
    try {
      assertCanAccessTeam(ctx, body.teamId);
    } catch {
      return NextResponse.json({ error: "Forbidden: team not in scope" }, { status: 403 });
    }
  }

  if (body.thresholdPct !== undefined && (body.thresholdPct < 0 || body.thresholdPct > 100)) {
    return NextResponse.json({ error: "thresholdPct must be 0-100" }, { status: 400 });
  }

  try {
    const result = await runReconciliation({
      organizationId: ctx.organizationId,
      triggeredBy: ctx.userId,
      teamId: body.teamId,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      thresholdPct: body.thresholdPct,
    });

    return NextResponse.json(result);
  } catch (err) {
    logger.error("Reconciliation run failed", { error: err });
    return NextResponse.json({ error: "Reconciliation failed" }, { status: 500 });
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  try {
    const runs = await db
      .select()
      .from(reconciliationRuns)
      .where(eq(reconciliationRuns.organizationId, ctx.organizationId))
      .orderBy(desc(reconciliationRuns.startedAt))
      .limit(20);

    return NextResponse.json({
      runs: runs.map((r) => ({
        id: r.id,
        status: r.status,
        teamId: r.teamId,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        thresholdPct: r.thresholdPct,
        totalComparisons: r.totalComparisons,
        matchCount: r.matchCount,
        mismatchCount: r.mismatchCount,
        sourceMissingCount: r.sourceMissingCount,
        cadenceMissingCount: r.cadenceMissingCount,
        startedAt: r.startedAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logger.error("Failed to list reconciliation runs", { error: err });
    return NextResponse.json({ error: "Failed to list runs" }, { status: 500 });
  }
}
