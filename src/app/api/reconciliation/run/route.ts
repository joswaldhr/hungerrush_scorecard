import { auth } from "@/lib/auth";
import { getManagerContext } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { reconciliationRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { runReconciliation } from "@/lib/domain/reconciliation";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getManagerContext(session.user.email);
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

  const result = await runReconciliation({
    organizationId: ctx.organizationId,
    triggeredBy: ctx.userId,
    teamId: body.teamId,
    periodStart: body.periodStart,
    periodEnd: body.periodEnd,
    thresholdPct: body.thresholdPct,
  });

  return NextResponse.json(result);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

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
}
