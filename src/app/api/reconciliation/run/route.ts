import { auth } from "@/lib/auth";
import { getEffectiveManagerContext, assertCanAccessTeam } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { reconciliationRuns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { runReconciliation } from "@/lib/domain/reconciliation";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isReconciliationRateLimited } from "@/lib/rate-limit";
import { z } from "zod";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const reconciliationRunBodySchema = z.object({
  teamId: z.string().min(1).optional(),
  periodStart: z.string().regex(DATE_RE, "Invalid date format (expected YYYY-MM-DD)"),
  periodEnd: z.string().regex(DATE_RE, "Invalid date format (expected YYYY-MM-DD)"),
  thresholdPct: z
    .number()
    .min(0, "thresholdPct must be 0-100")
    .max(100, "thresholdPct must be 0-100")
    .optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reconciliationRunBodySchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const body = parsed.data;

  if (body.teamId) {
    try {
      assertCanAccessTeam(ctx, body.teamId);
    } catch {
      return NextResponse.json({ error: "Forbidden: team not in scope" }, { status: 403 });
    }
  }

  if (await isReconciliationRateLimited(ctx.organizationId)) {
    return NextResponse.json(
      { error: "A reconciliation run already started recently. Try again in a few minutes." },
      { status: 429 }
    );
  }

  try {
    const result = await runReconciliation({
      organizationId: ctx.organizationId,
      triggeredBy: ctx.userId,
      teamId: body.teamId,
      employeeIds: ctx.assignedEmployeeIds,
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
