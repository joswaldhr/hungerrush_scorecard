import { db } from "@/lib/db";
import { metricValues, metricDefinitions } from "@/lib/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { assertCanAccessEmployee, type ManagerContext } from "@/lib/auth/authorization";
import { assertOrganizationResource } from "@/lib/auth/organization-scope";
import { requiresTicketAttributionVerification, TICKET_ATTRIBUTION_QUALITY } from "./availability";

export async function getStoredMetricHistory(
  ctx: ManagerContext,
  employeeId: string,
  periodKey?: string
) {
  assertCanAccessEmployee(ctx, employeeId);
  await assertOrganizationResource(ctx.organizationId, "employee", employeeId);
  const scope = and(
    eq(metricValues.employeeId, employeeId),
    eq(metricDefinitions.organizationId, ctx.organizationId)
  );
  const periods = await db
    .selectDistinct({ start: metricValues.periodStart, end: metricValues.periodEnd })
    .from(metricValues)
    .innerJoin(metricDefinitions, eq(metricDefinitions.id, metricValues.metricDefinitionId))
    .where(scope)
    .orderBy(desc(metricValues.periodStart), desc(metricValues.periodEnd));
  const selected =
    periodKey === undefined
      ? periods[0]
      : periods.find((period) => `${period.start}/${period.end}` === periodKey);
  if (!selected) return { periods, selected: null, rows: [] };
  const rows = await db
    .select({
      id: metricValues.id,
      key: metricDefinitions.key,
      sourceStrategy: metricDefinitions.sourceStrategy,
      name: metricDefinitions.name,
      valueType: metricDefinitions.valueType,
      unit: metricDefinitions.unit,
      numericValue: metricValues.numericValue,
      quality: metricValues.qualityStatus,
      observedAt: metricValues.dataFreshnessAt,
      calculationVersion: metricValues.calculationVersion,
    })
    .from(metricValues)
    .innerJoin(metricDefinitions, eq(metricDefinitions.id, metricValues.metricDefinitionId))
    .where(
      and(
        scope,
        eq(metricValues.periodStart, selected.start),
        eq(metricValues.periodEnd, selected.end)
      )
    )
    .orderBy(metricDefinitions.name, metricDefinitions.version);
  return {
    periods,
    selected,
    rows: rows.map(({ sourceStrategy, ...row }) =>
      requiresTicketAttributionVerification({ key: row.key, sourceStrategy })
        ? { ...row, numericValue: null, quality: TICKET_ATTRIBUTION_QUALITY }
        : row
    ),
  };
}
