import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, metricDefinitions, syncRevisions, syncRuns } from "@/lib/db/schema";
import { assertCanAccessEmployee, type ManagerContext } from "@/lib/auth/authorization";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";

const evidenceSchema = z.object({
  numericValue: z.number().finite().nullable(),
  quality: z.string().max(64),
  observedAt: z.string().datetime({ offset: true }).nullable(),
  calculationVersion: z.number().int().nonnegative(),
});

/** Only metric evidence is exposed, never raw source payloads or snapshot JSON. */
export async function getStoredMetricRevisions(
  ctx: ManagerContext,
  employeeId: string,
  start: string,
  end: string
) {
  assertCanAccessEmployee(ctx, employeeId);
  await assertOrganizationResource(ctx.organizationId, "employee", employeeId);
  if (!z.iso.date().safeParse(start).success || !z.iso.date().safeParse(end).success || start > end)
    throw new Error("Invalid revision interval");
  const snapshot = syncRevisions.snapshotJson;
  const records = await db
    .select({
      id: syncRevisions.id,
      name: metricDefinitions.name,
      unit: metricDefinitions.unit,
      valueType: metricDefinitions.valueType,
      recordedAt: syncRevisions.createdAt,
      evidence: sql<unknown>`jsonb_build_object(
        'numericValue', ${snapshot}->'numeric_value',
        'quality', ${snapshot}->'quality_status',
        'observedAt', ${snapshot}->'data_freshness_at',
        'calculationVersion', ${snapshot}->'calculation_version'
      )`,
    })
    .from(syncRevisions)
    .innerJoin(syncRuns, eq(syncRuns.id, syncRevisions.syncRunId))
    .innerJoin(dataSources, eq(dataSources.id, syncRuns.dataSourceId))
    .innerJoin(
      metricDefinitions,
      sql`${metricDefinitions.id}::text = ${snapshot}->>'metric_definition_id'`
    )
    .where(
      and(
        eq(syncRevisions.entityType, "metric_value"),
        eq(dataSources.organizationId, ctx.organizationId),
        eq(metricDefinitions.organizationId, ctx.organizationId),
        sql`${snapshot}->>'employee_id' = ${employeeId}`,
        sql`${snapshot}->>'period_start' = ${start}`,
        sql`${snapshot}->>'period_end' = ${end}`
      )
    )
    .orderBy(desc(syncRevisions.createdAt), desc(syncRevisions.id))
    .limit(26);
  return {
    hasMore: records.length > 25,
    rows: records.slice(0, 25).map(({ evidence, ...row }) => {
      const parsed = evidenceSchema.safeParse(evidence);
      return { ...row, evidence: parsed.success ? parsed.data : null };
    }),
  };
}
