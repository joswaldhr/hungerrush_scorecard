import { db } from "@/lib/db";
import {
  metricDefinitions,
  metricAssignments,
  metricValues,
  metricTargets,
  metricObservations,
} from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee, assertCanAccessTeam } from "@/lib/auth/authorization";
import { resolveTarget, evaluateStatus } from "./target-resolution";
import type { Direction, ResolvedTarget, ValueType } from "./types";

export interface EmployeeMetricRow {
  definitionId: string;
  key: string;
  name: string;
  category: string | null;
  unit: string | null;
  valueType: ValueType;
  direction: Direction;
  displayOrder: number;
  isPrimary: boolean;
  currentValue: number | null;
  previousValue: number | null;
  target: ResolvedTarget | null;
  status: ReturnType<typeof evaluateStatus>;
  qualityStatus: string;
  dataFreshnessAt: Date | null;
  calculationVersion: number;
}

export async function getEmployeeMetrics(
  ctx: ManagerContext,
  employeeId: string,
  teamId: string,
  periodStart: string,
  previousPeriodStart: string
): Promise<EmployeeMetricRow[]> {
  assertCanAccessEmployee(ctx, employeeId);

  const assignments = await db
    .select()
    .from(metricAssignments)
    .where(eq(metricAssignments.teamId, teamId));

  if (assignments.length === 0) return [];

  const defIds = assignments.map((a) => a.metricDefinitionId);

  const [definitions, currentValues, previousValues, targets] = await Promise.all([
    db.select().from(metricDefinitions).where(inArray(metricDefinitions.id, defIds)),
    db
      .select()
      .from(metricValues)
      .where(
        and(
          eq(metricValues.employeeId, employeeId),
          inArray(metricValues.metricDefinitionId, defIds),
          eq(metricValues.periodStart, periodStart)
        )
      ),
    db
      .select()
      .from(metricValues)
      .where(
        and(
          eq(metricValues.employeeId, employeeId),
          inArray(metricValues.metricDefinitionId, defIds),
          eq(metricValues.periodStart, previousPeriodStart)
        )
      ),
    db.select().from(metricTargets).where(inArray(metricTargets.metricDefinitionId, defIds)),
  ]);

  const defMap = new Map(definitions.map((d) => [d.id, d]));
  const assignMap = new Map(assignments.map((a) => [a.metricDefinitionId, a]));
  const currentMap = new Map(currentValues.map((v) => [v.metricDefinitionId, v]));
  const previousMap = new Map(previousValues.map((v) => [v.metricDefinitionId, v]));

  const rows: EmployeeMetricRow[] = [];

  for (const defId of defIds) {
    const def = defMap.get(defId);
    const assign = assignMap.get(defId);
    if (!def || !assign) continue;

    const current = currentMap.get(defId);
    const previous = previousMap.get(defId);

    const candidateTargets = targets
      .filter((t) => t.metricDefinitionId === defId)
      .map((t) => ({
        targetValue: t.targetValue,
        warningValue: t.warningValue,
        targetType: t.targetType,
        priority: t.priority,
        employeeId: t.employeeId,
        roleKey: t.roleKey,
        teamId: t.teamId,
      }));

    const resolvedTarget = resolveTarget(candidateTargets, employeeId, null, teamId);
    const direction = def.direction as Direction;
    const valueType = def.valueType as ValueType;

    rows.push({
      definitionId: defId,
      key: def.key,
      name: def.name,
      category: def.category,
      unit: def.unit,
      valueType,
      direction,
      displayOrder: assign.displayOrder,
      isPrimary: assign.isPrimary,
      currentValue: current?.numericValue ?? null,
      previousValue: previous?.numericValue ?? null,
      target: resolvedTarget,
      status: evaluateStatus(current?.numericValue ?? 0, resolvedTarget, direction),
      qualityStatus: current?.qualityStatus ?? "missing",
      dataFreshnessAt: current?.dataFreshnessAt ?? null,
      calculationVersion: current?.calculationVersion ?? 0,
    });
  }

  rows.sort((a, b) => a.displayOrder - b.displayOrder);
  return rows;
}

export async function getMetricHistory(
  ctx: ManagerContext,
  employeeId: string,
  metricDefinitionId: string,
  limit = 8
) {
  assertCanAccessEmployee(ctx, employeeId);

  return db
    .select()
    .from(metricValues)
    .where(
      and(
        eq(metricValues.employeeId, employeeId),
        eq(metricValues.metricDefinitionId, metricDefinitionId)
      )
    )
    .orderBy(desc(metricValues.periodStart))
    .limit(limit);
}

export async function getTeamMetricsSummary(
  ctx: ManagerContext,
  teamId: string,
  periodStart: string
) {
  assertCanAccessTeam(ctx, teamId);

  const employeeIds = ctx.assignedEmployeeIds;
  if (employeeIds.length === 0) return [];

  const assignments = await db
    .select()
    .from(metricAssignments)
    .where(and(eq(metricAssignments.teamId, teamId), eq(metricAssignments.isPrimary, true)));

  if (assignments.length === 0) return [];

  const defIds = assignments.map((a) => a.metricDefinitionId);

  const [definitions, values] = await Promise.all([
    db.select().from(metricDefinitions).where(inArray(metricDefinitions.id, defIds)),
    db
      .select()
      .from(metricValues)
      .where(
        and(
          inArray(metricValues.employeeId, employeeIds),
          inArray(metricValues.metricDefinitionId, defIds),
          eq(metricValues.periodStart, periodStart)
        )
      ),
  ]);

  return { definitions, values, assignments };
}

export async function getEmployeeObservations(
  ctx: ManagerContext,
  employeeId: string,
  periodStart: string,
  periodEnd: string
) {
  assertCanAccessEmployee(ctx, employeeId);

  return db
    .select()
    .from(metricObservations)
    .where(
      and(
        eq(metricObservations.employeeId, employeeId),
        eq(metricObservations.periodStart, periodStart),
        eq(metricObservations.periodEnd, periodEnd)
      )
    );
}
