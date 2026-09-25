import { db } from "@/lib/db";
import {
  reconciliationRuns,
  reconciliationResults,
  metricDefinitions,
  metricValues,
  normalizedFacts,
  teamMemberships,
  employees,
  organizations,
  dataSources,
} from "@/lib/db/schema";
import { eq, and, inArray, isNull, or, lte, gt } from "drizzle-orm";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import type { CalculationType, ValueType } from "@/lib/domain/metrics/types";
import { compareValues, aggregateSourceValues } from "./compare";
import { isReconciliationRateLimited } from "@/lib/rate-limit";
import { reconciliationRequestSchema } from "./request";

export class ReconciliationRateLimitError extends Error {
  constructor() {
    super("A reconciliation run already started recently. Try again in a few minutes.");
    this.name = "ReconciliationRateLimitError";
  }
}

export interface ReconciliationParams {
  organizationId: string;
  triggeredBy: string;
  teamId?: string;
  /** Authorized upper bound, including when a team filter is supplied. */
  employeeIds: string[];
  periodStart: string;
  periodEnd: string;
  thresholdPct?: number;
}

export async function runReconciliation(params: ReconciliationParams) {
  // Reject invalid CLI/service input before consuming the organization's cooldown.
  reconciliationRequestSchema.parse(params);
  const thresholdPct = params.thresholdPct ?? 5;
  if (params.teamId) await assertOrganizationResource(params.organizationId, "team", params.teamId);

  // Serialize the cooldown check and claim across every worker for this organization.
  const run = await db.transaction(async (tx) => {
    const [organization] = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.id, params.organizationId))
      .for("update");
    if (!organization) throw new Error("Organization not found");
    await assertOrganizationResource(params.organizationId, "user", params.triggeredBy, tx);
    if (await isReconciliationRateLimited(params.organizationId, tx)) {
      throw new ReconciliationRateLimitError();
    }
    const [claimed] = await tx
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
    return claimed;
  });

  if (!run) throw new Error("Failed to create reconciliation run");

  try {
    // Compare one database snapshot and publish every result with the completed run atomically.
    return await db.transaction(
      async (tx) => {
        const definitions = await tx
          .select()
          .from(metricDefinitions)
          .where(
            and(
              eq(metricDefinitions.organizationId, params.organizationId),
              eq(metricDefinitions.status, "active")
            )
          );

        const activeMetrics = definitions.filter((d) => d.sourceStrategy);

        const permittedEmployees = await tx
          .select({ id: employees.id })
          .from(employees)
          .where(
            and(
              eq(employees.organizationId, params.organizationId),
              inArray(employees.id, params.employeeIds)
            )
          );
        let employeeIds = permittedEmployees.map((e) => e.id);
        if (params.teamId) {
          const memberships = await tx
            .select({ employeeId: teamMemberships.employeeId })
            .from(teamMemberships)
            .where(
              and(
                eq(teamMemberships.teamId, params.teamId),
                inArray(teamMemberships.employeeId, employeeIds),
                lte(teamMemberships.effectiveFrom, params.periodEnd),
                or(
                  isNull(teamMemberships.effectiveTo),
                  gt(teamMemberships.effectiveTo, params.periodStart)
                )
              )
            );
          employeeIds = [...new Set(memberships.map((m) => m.employeeId))];
        }

        if (employeeIds.length === 0 || activeMetrics.length === 0) {
          await tx
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
        const ownedSources = await tx
          .select({ id: dataSources.id, type: dataSources.type })
          .from(dataSources)
          .where(
            and(
              eq(dataSources.organizationId, params.organizationId),
              inArray(
                dataSources.type,
                activeMetrics.map((metric) => metric.sourceStrategy!)
              )
            )
          );

        const [cadenceRows, sourceRows] = await Promise.all([
          tx
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
          tx
            .select()
            .from(normalizedFacts)
            .where(
              and(
                inArray(normalizedFacts.employeeId, employeeIds),
                eq(normalizedFacts.organizationId, params.organizationId),
                inArray(
                  normalizedFacts.dataSourceId,
                  ownedSources.map((source) => source.id)
                ),
                eq(normalizedFacts.periodStart, params.periodStart),
                eq(normalizedFacts.periodEnd, params.periodEnd)
              )
            ),
        ]);

        const cadenceMap = new Map<string, (typeof cadenceRows)[number]>();
        for (const row of cadenceRows) {
          cadenceMap.set(`${row.metricDefinitionId}:${row.employeeId}`, row);
        }

        const sourceMap = new Map<string, (number | null)[]>();
        sourceRows.sort(
          (a, b) =>
            a.sourceObservedAt.getTime() - b.sourceObservedAt.getTime() || a.id.localeCompare(b.id)
        );
        for (const row of sourceRows) {
          const key = `${row.dataSourceId}:${row.factType}:${row.employeeId}`;
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

            // Reconcile the source that published this value, never a sum across accounts.
            const provenance = cadenceRow?.provenanceJson;
            const provenanceRecord =
              provenance && typeof provenance === "object" && !Array.isArray(provenance)
                ? (provenance as Record<string, unknown>)
                : undefined;
            const malformedProvenance = provenance != null && !provenanceRecord;
            const wrongStrategy =
              provenanceRecord?.sourceStrategy !== undefined &&
              provenanceRecord.sourceStrategy !== metric.sourceStrategy;
            const sourceReference = provenanceRecord?.dataSourceId;
            const candidates = ownedSources.filter(
              (source) => source.type === metric.sourceStrategy
            );
            const sourceId =
              malformedProvenance || wrongStrategy
                ? undefined
                : typeof sourceReference === "string"
                  ? candidates.find((source) => source.id === sourceReference)?.id
                  : sourceReference === undefined && candidates.length === 1
                    ? candidates[0]!.id
                    : undefined;
            const sourceValues = sourceId
              ? (sourceMap.get(`${sourceId}:${metric.key}:${employeeId}`) ?? [])
              : [];
            const sourceValue = aggregateSourceValues(sourceValues, calculationType);

            const comparison = compareValues(
              cadenceValue,
              sourceValue,
              thresholdPct,
              metric.valueType as ValueType
            );

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
              notes: sourceId
                ? null
                : "A single owned source instance could not be established for this comparison.",
            });
          }
        }

        const CHUNK_SIZE = 100;
        for (let i = 0; i < results.length; i += CHUNK_SIZE) {
          await tx.insert(reconciliationResults).values(results.slice(i, i + CHUNK_SIZE));
        }

        const totalComparisons = results.length;
        await tx
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
      },
      { isolationLevel: "repeatable read" }
    );
  } catch (err) {
    await db
      .update(reconciliationRuns)
      .set({ status: "failed", completedAt: new Date() })
      .where(eq(reconciliationRuns.id, run.id));
    throw err;
  }
}
