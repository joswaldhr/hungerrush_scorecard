import { auth } from "@/lib/auth";
import { getEffectiveManagerContext } from "@/lib/auth/authorization";
import { getScopedReconciliationRun } from "@/lib/domain/reconciliation/queries";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ctx } = await getEffectiveManagerContext(session.user.email);
  if (!ctx) {
    return NextResponse.json({ error: "Not a manager" }, { status: 403 });
  }

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId");
  if (!runId) {
    return NextResponse.json({ error: "runId query parameter is required" }, { status: 400 });
  }

  try {
    const scoped = await getScopedReconciliationRun(ctx, runId);
    if (!scoped) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    const { run, results } = scoped;

    return NextResponse.json({
      run: {
        id: run.id,
        status: run.status,
        periodStart: run.periodStart,
        periodEnd: run.periodEnd,
        thresholdPct: run.thresholdPct,
        totalComparisons: run.totalComparisons,
        matchCount: run.matchCount,
        mismatchCount: run.mismatchCount,
        sourceMissingCount: run.sourceMissingCount,
        cadenceMissingCount: run.cadenceMissingCount,
        unavailableCount: run.unavailableCount,
        startedAt: run.startedAt.toISOString(),
        completedAt: run.completedAt?.toISOString() ?? null,
      },
      results: results.map((r) => ({
        id: r.id,
        metricKey: r.metricKey,
        factType: r.factType,
        employeeId: r.employeeId,
        employeeName: r.employeeName,
        periodStart: r.periodStart,
        periodEnd: r.periodEnd,
        cadenceValue: r.cadenceValue,
        sourceValue: r.sourceValue,
        absoluteDelta: r.absoluteDelta,
        relativeDeltaPct: r.relativeDeltaPct,
        status: r.status,
        cadenceCalculationVersion: r.cadenceCalculationVersion,
        notes: r.notes,
        unavailableReason: r.unavailableReason,
      })),
    });
  } catch (err) {
    logger.error("Failed to fetch reconciliation results", { error: err });
    return NextResponse.json({ error: "Failed to fetch results" }, { status: 500 });
  }
}
