import { auth } from "@/lib/auth";
import {
  getEffectiveManagerContext,
  getAssignedEmployees,
  getVisibleTeamsForManager,
} from "@/lib/auth/authorization";
import { getScopedReconciliationRuns } from "@/lib/domain/reconciliation/queries";
import { runReconciliation } from "@/lib/domain/reconciliation";
import { ReconciliationRateLimitError } from "@/lib/domain/reconciliation/engine";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { isReconciliationRateLimited } from "@/lib/rate-limit";
import { reconciliationRequestSchema } from "@/lib/domain/reconciliation/request";

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

  const parsed = reconciliationRequestSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request body";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const body = parsed.data;

  if (body.teamId) {
    // Not just ctx.assignedTeamIds -- a sub-manager's access can come
    // entirely from individual employee assignments (see
    // getVisibleTeamsForManager), and their own team is already shown to
    // them as an option on the Team/Reconciliation pages.
    const assignedEmployees = await getAssignedEmployees(ctx);
    const visibleTeams = await getVisibleTeamsForManager(ctx, assignedEmployees);
    if (!visibleTeams.some((t) => t.id === body.teamId)) {
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
    if (err instanceof ReconciliationRateLimitError) {
      return NextResponse.json({ error: err.message }, { status: 429 });
    }
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
    const runs = await getScopedReconciliationRuns(ctx);

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
