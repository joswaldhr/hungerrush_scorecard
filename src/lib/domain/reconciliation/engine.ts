import { db } from "@/lib/db";
import {
  reconciliationRuns,
  reconciliationResults,
  metricDefinitions,
  metricValues,
  normalizedFacts,
  teamMemberships,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { CalculationType } from "@/lib/domain/metrics/types";
import { compareValues, aggregateSourceValues } from "./compare";

export interface ReconciliationParams {
  organizationId: string;
  triggeredBy: string;
  teamId?: string;
  /** Employees to compare when teamId isn't set — the triggering manager's
   * own assigned employees, never "every employee in the org" (a manager
   * who omits teamId should still only see their own scope). */
  employeeIds: string[];
  periodStart: string;
  periodEnd: string;
  thresholdPct?: number;
}

export async function runReconciliation(params: ReconciliationParams) {
  const thresholdPct = params.thresholdPct ?? 5;

  const [run] = await db
    .insert(reconciliationRuns)
    .values({
      organizationId: params.organizationId,
      triggeredBy: params.triggeredBy,
      teamId: params.teamId ?? null,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      thresholdPct,
      status: "running",
    })
    .returning();

  if (!run) throw new Error("Failed to create reconciliation run");

  try {
    const definitions = await db
      .select()
      .from(metricDefinitions)
      .where(
        and(
          eq(metricDefinitions.organizationId, params.organizationId),
          eq(metricDefinitions.status, "active")
        )
      );

    const activeMetrics = definitions.filter((d) => d.sourceStrategy);

    let employeeIds: string[];
    if (params.teamId) {
      const memberships = await db
        .select({ employeeId: teamMemberships.employeeId })
        .from(teamMemberships)
        .where(eq(teamMemberships.teamId, params.teamId));
      employeeIds = memberships.map((m) => m.employeeId);
    } else {
      employeeIds = params.employeeIds;
    }

    if (employeeIds.length === 0 || activeMetrics.length === 0) {
      await db
        .update(reconciliationRuns)
        .set({ status: "completed", completedAt: new Date(), totalComparisons: 0 })
        .where(eq(reconciliationRuns.id, run.id));
      return {
        runId: run.id,
        totalComparisons: 0,
        matchCount: 0,
        mismatchCount: 0,
        sourceMissingCount: 0,
        cadenceMissingCount: 0,
      };
    }

    const metricDefIds = activeMetrics.map((m) => m.id);

    const [cadenceRows, sourceRows] = await Promise.all([
      db
        .select()
        .from(metricValues)
        .where(
          and(
            inArray(metricValues.employeeId, employeeIds),
            inArray(metricValues.metricDefinitionId, metricDefIds),
            eq(metricValues.periodStart, params.periodStart),
            eq(metricValues.periodEnd, params.periodEnd)
          )
        ),
      db
        .select()
        .from(normalizedFacts)
        .where(
          and(
            inArray(normalizedFacts.employeeId, employeeIds),
            eq(normalizedFacts.periodStart, params.periodStart),
            eq(normalizedFacts.periodEnd, params.periodEnd)
          )
        ),
    ]);

    const cadenceMap = new Map<string, (typeof cadenceRows)[number]>();
    for (const row of cadenceRows) {
      cadenceMap.set(`${row.metricDefinitionId}:${row.employeeId}`, row);
    }

    const sourceMap = new Map<string, number[]>();
    for (const row of sourceRows) {
      if (row.numericValue === null) continue;
      const key = `${row.factType}:${row.employeeId}`;
      const existing = sourceMap.get(key);
      if (existing) {
        existing.push(row.numericValue);
      } else {
        sourceMap.set(key, [row.numericValue]);
      }
    }

    const results: Array<typeof reconciliationResults.$inferInsert> = [];
    let matchCount = 0;
    let mismatchCount = 0;
    let sourceMissingCount = 0;
    let cadenceMissingCount = 0;

    for (const metric of activeMetrics) {
      const calculationType = (metric.calculationType ?? "latest") as CalculationType;

      for (const employeeId of employeeIds) {
        const cadenceRow = cadenceMap.get(`${metric.id}:${employeeId}`);
        const cadenceValue = cadenceRow?.numericValue ?? null;

        const sourceValues = sourceMap.get(`${metric.key}:${employeeId}`) ?? [];
        const sourceValue = aggregateSourceValues(sourceValues, calculationType);

        const comparison = compareValues(cadenceValue, sourceValue, thresholdPct);

        switch (comparison.status) {
          case "match":
            matchCount++;
            break;
          case "mismatch":
            mismatchCount++;
            break;
          case "source_missing":
            sourceMissingCount++;
            break;
          case "cadence_missing":
            cadenceMissingCount++;
            break;
        }

        results.push({
          reconciliationRunId: run.id,
          metricDefinitionId: metric.id,
          employeeId,
          periodStart: params.periodStart,
          periodEnd: params.periodEnd,
          cadenceValue: comparison.cadenceValue,
          sourceValue: comparison.sourceValue,
          absoluteDelta: comparison.absoluteDelta,
          relativeDeltaPct: comparison.relativeDeltaPct,
          status: comparison.status,
          cadenceCalculationVersion: cadenceRow?.calculationVersion ?? null,
          metricKey: metric.key,
          factType: metric.key,
        });
      }
    }

    const CHUNK_SIZE = 100;
    for (let i = 0; i < results.length; i += CHUNK_SIZE) {
      await db.insert(reconciliationResults).values(results.slice(i, i + CHUNK_SIZE));
    }

    const totalComparisons = results.length;
    await db
      .update(reconciliationRuns)
      .set({
        status: "completed",
        completedAt: new Date(),
        totalComparisons,
        matchCount,
        mismatchCount,
        sourceMissingCount,
        cadenceMissingCount,
      })
      .where(eq(reconciliationRuns.id, run.id));

    return {
      runId: run.id,
      totalComparisons,
      matchCount,
      mismatchCount,
      sourceMissingCount,
      cadenceMissingCount,
    };
  } catch (err) {
    await db
      .update(reconciliationRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(reconciliationRuns.id, run.id));
    throw err;
  }
}
