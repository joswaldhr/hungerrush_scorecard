import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dataSources, metricDefinitions, syncRevisions, syncRuns } from "@/lib/db/schema";
import { assertCanAccessEmployee, type ManagerContext } from "@/lib/auth/authorization";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import { requiresTicketAttributionVerification, TICKET_ATTRIBUTION_QUALITY } from "./availability";

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
  end: string,
  before?: string
) {
  assertCanAccessEmployee(ctx, employeeId);
  await assertOrganizationResource(ctx.organizationId, "employee", employeeId);
  if (!z.iso.date().safeParse(start).success || !z.iso.date().safeParse(end).success || start > end)
    throw new Error("Invalid revision interval");
  if (before !== undefined && !z.string().uuid().safeParse(before).success)
    throw new Error("Invalid revision cursor");
  const snapshot = syncRevisions.snapshotJson;
  const query = () =>
    db
      .select({
        id: syncRevisions.id,
        name: metricDefinitions.name,
        key: metricDefinitions.key,
        sourceStrategy: metricDefinitions.sourceStrategy,
        unit: metricDefinitions.unit,
        valueType: metricDefinitions.valueType,
        recordedAt: syncRevisions.createdAt,
        // Keep PostgreSQL microseconds for pagination; JavaScript Date truncates them.
        cursorAt: sql<string>`${syncRevisions.createdAt}::text`,
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
      );
  const permitted = and(
    eq(syncRevisions.entityType, "metric_value"),
    eq(dataSources.organizationId, ctx.organizationId),
    eq(metricDefinitions.organizationId, ctx.organizationId),
    sql`${snapshot}->>'employee_id' = ${employeeId}`,
    sql`${snapshot}->>'period_start' = ${start}`,
    sql`${snapshot}->>'period_end' = ${end}`
  );
  const [anchor] = before
    ? await query()
        .where(and(permitted, eq(syncRevisions.id, before)))
        .limit(1)
    : [];
  if (before && !anchor) throw new Error("Invalid revision cursor");
  const records = await query()
    .where(
      and(
        permitted,
        anchor
          ? sql`(${syncRevisions.createdAt}, ${syncRevisions.id}) < (${anchor.cursorAt}::timestamptz, ${anchor.id}::uuid)`
          : undefined
      )
    )
    .orderBy(desc(syncRevisions.createdAt), desc(syncRevisions.id))
    .limit(26);
  return {
    hasMore: records.length > 25,
    nextCursor: records.length > 25 ? records[24]!.id : null,
    rows: records
      .slice(0, 25)
      .map(({ evidence, key, sourceStrategy, cursorAt: _cursorAt, ...row }) => {
        const parsed = evidenceSchema.safeParse(evidence);
        return {
          ...row,
          evidence: parsed.success
            ? requiresTicketAttributionVerification({ key, sourceStrategy })
              ? { ...parsed.data, numericValue: null, quality: TICKET_ATTRIBUTION_QUALITY }
              : parsed.data
            : null,
        };
      }),
  };
}
