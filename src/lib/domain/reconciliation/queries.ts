import { db } from "@/lib/db";
import { reconciliationRuns, reconciliationResults } from "@/lib/db/schema";
import type { ManagerContext } from "@/lib/auth/authorization";
import { and, desc, eq, exists, inArray, or } from "drizzle-orm";

function visibleRun(ctx: ManagerContext) {
  return and(
    eq(reconciliationRuns.organizationId, ctx.organizationId),
    or(
      eq(reconciliationRuns.triggeredBy, ctx.userId),
      exists(
        db
          .select({ id: reconciliationResults.id })
          .from(reconciliationResults)
          .where(
            and(
              eq(reconciliationResults.reconciliationRunId, reconciliationRuns.id),
              inArray(reconciliationResults.employeeId, ctx.assignedEmployeeIds)
            )
          )
      )
    )
  );
}

function scopedCounts(results: { status: string }[]) {
  return {
    totalComparisons: results.length,
    matchCount: results.filter((r) => r.status === "match").length,
    mismatchCount: results.filter((r) => r.status === "mismatch").length,
    sourceMissingCount: results.filter((r) => r.status === "source_missing").length,
    cadenceMissingCount: results.filter((r) => r.status === "cadence_missing").length,
  };
}

export async function getScopedReconciliationRuns(ctx: ManagerContext, limit = 20) {
  const runs = await db
    .select()
    .from(reconciliationRuns)
    .where(visibleRun(ctx))
    .orderBy(desc(reconciliationRuns.startedAt))
    .limit(limit);
  if (!runs.length) return [];
  const results = await db
    .select()
    .from(reconciliationResults)
    .where(
      and(
        inArray(
          reconciliationResults.reconciliationRunId,
          runs.map((r) => r.id)
        ),
        inArray(reconciliationResults.employeeId, ctx.assignedEmployeeIds)
      )
    );
  return runs.map((run) => ({
    ...run,
    ...scopedCounts(results.filter((r) => r.reconciliationRunId === run.id)),
  }));
}

export async function getScopedReconciliationRun(ctx: ManagerContext, runId: string) {
  const [run] = await db
    .select()
    .from(reconciliationRuns)
    .where(and(eq(reconciliationRuns.id, runId), visibleRun(ctx)));
  if (!run) return null;
  const results = await db
    .select()
    .from(reconciliationResults)
    .where(
      and(
        eq(reconciliationResults.reconciliationRunId, run.id),
        inArray(reconciliationResults.employeeId, ctx.assignedEmployeeIds)
      )
    );
  return { run: { ...run, ...scopedCounts(results) }, results };
}
