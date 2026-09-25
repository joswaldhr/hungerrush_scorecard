import { db } from "@/lib/db";
import {
  reconciliationRuns,
  reconciliationResults,
  metricDefinitions,
  employees,
} from "@/lib/db/schema";
import type { ManagerContext } from "@/lib/auth/authorization";
import { and, desc, eq, exists, inArray, or, getTableColumns } from "drizzle-orm";
import { z } from "zod";
import {
  requiresTicketAttributionVerification,
  TICKET_ATTRIBUTION_QUALITY,
  TICKET_ATTRIBUTION_REASON,
} from "@/lib/domain/metrics/availability";

function visibleRun(ctx: ManagerContext) {
  return and(
    eq(reconciliationRuns.organizationId, ctx.organizationId),
    or(
      eq(reconciliationRuns.triggeredBy, ctx.userId),
      exists(
        db
          .select({ id: reconciliationResults.id })
          .from(reconciliationResults)
          .innerJoin(employees, eq(employees.id, reconciliationResults.employeeId))
          .innerJoin(
            metricDefinitions,
            eq(metricDefinitions.id, reconciliationResults.metricDefinitionId)
          )
          .where(
            and(
              eq(reconciliationResults.reconciliationRunId, reconciliationRuns.id),
              inArray(reconciliationResults.employeeId, ctx.assignedEmployeeIds),
              eq(employees.organizationId, ctx.organizationId),
              eq(metricDefinitions.organizationId, ctx.organizationId)
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
    unavailableCount: results.filter((r) => r.status === TICKET_ATTRIBUTION_QUALITY).length,
  };
}

async function scopedResults(ctx: ManagerContext, runIds: string[]) {
  if (!runIds.length) return [];
  const rows = await db
    .select({
      ...getTableColumns(reconciliationResults),
      sourceStrategy: metricDefinitions.sourceStrategy,
      definitionKey: metricDefinitions.key,
      employeeName: employees.displayName,
    })
    .from(reconciliationResults)
    .innerJoin(
      metricDefinitions,
      eq(metricDefinitions.id, reconciliationResults.metricDefinitionId)
    )
    .innerJoin(employees, eq(employees.id, reconciliationResults.employeeId))
    .where(
      and(
        inArray(reconciliationResults.reconciliationRunId, runIds),
        inArray(reconciliationResults.employeeId, ctx.assignedEmployeeIds),
        eq(metricDefinitions.organizationId, ctx.organizationId),
        eq(employees.organizationId, ctx.organizationId)
      )
    );
  return rows.map(({ sourceStrategy, definitionKey, ...result }) => {
    if (requiresTicketAttributionVerification({ key: definitionKey, sourceStrategy }))
      return {
        ...result,
        cadenceValue: null,
        sourceValue: null,
        absoluteDelta: null,
        relativeDeltaPct: null,
        notes: null,
        status: TICKET_ATTRIBUTION_QUALITY,
        unavailableReason: TICKET_ATTRIBUTION_REASON,
      };
    return { ...result, unavailableReason: null };
  });
}

export async function getScopedReconciliationRuns(ctx: ManagerContext, limit = 20) {
  const runs = await db
    .select()
    .from(reconciliationRuns)
    .where(visibleRun(ctx))
    .orderBy(desc(reconciliationRuns.startedAt))
    .limit(limit);
  if (!runs.length) return [];
  const results = await scopedResults(
    ctx,
    runs.filter((r) => r.status === "completed").map((r) => r.id)
  );
  return runs.map((run) => ({
    ...run,
    ...scopedCounts(results.filter((r) => r.reconciliationRunId === run.id)),
  }));
}

export async function getScopedReconciliationRun(ctx: ManagerContext, runId: string) {
  if (!z.string().uuid().safeParse(runId).success) return null;
  const [run] = await db
    .select()
    .from(reconciliationRuns)
    .where(and(eq(reconciliationRuns.id, runId), visibleRun(ctx)));
  if (!run) return null;
  const results = run.status === "completed" ? await scopedResults(ctx, [run.id]) : [];
  return { run: { ...run, ...scopedCounts(results) }, results };
}
