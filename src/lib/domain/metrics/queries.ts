import { db } from "@/lib/db";
import { metricDefinitions, metricAssignments, metricValues, metricTargets } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import type { ManagerContext } from "@/lib/auth/authorization";
import { assertCanAccessEmployee } from "@/lib/auth/authorization";
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
  const batch = await getEmployeeMetricsBatch(
    ctx,
    [employeeId],
    teamId,
    periodStart,
    previousPeriodStart
  );
  return batch.get(employeeId) ?? [];
}

/**
 * Same as getEmployeeMetrics, but for every employee on one team in a single
 * pass — the team-scoped queries (assignments/definitions/targets) run once
 * instead of once per employee, and current/previous values are fetched with
 * one inArray query across all employees.
 */
export async function getEmployeeMetricsBatch(
  ctx: ManagerContext,
  employeeIds: string[],
  teamId: string,
  periodStart: string,
  previousPeriodStart: string
): Promise<Map<string, EmployeeMetricRow[]>> {
  for (const employeeId of employeeIds) {
    assertCanAccessEmployee(ctx, employeeId);
  }

  const results = new Map<string, EmployeeMetricRow[]>();
  if (employeeIds.length === 0) return results;

  const assignments = await db
    .select()
    .from(metricAssignments)
    .where(eq(metricAssignments.teamId, teamId));

  if (assignments.length === 0) {
    for (const employeeId of employeeIds) results.set(employeeId, []);
    return results;
  }

  const defIds = assignments.map((a) => a.metricDefinitionId);

  const [definitions, currentValues, previousValues, targets] = await Promise.all([
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
    db
      .select()
      .from(metricValues)
      .where(
        and(
          inArray(metricValues.employeeId, employeeIds),
          inArray(metricValues.metricDefinitionId, defIds),
          eq(metricValues.periodStart, previousPeriodStart)
        )
      ),
    db.select().from(metricTargets).where(inArray(metricTargets.metricDefinitionId, defIds)),
  ]);

  const defMap = new Map(definitions.map((d) => [d.id, d]));
  const assignMap = new Map(assignments.map((a) => [a.metricDefinitionId, a]));

  const currentByEmployee = new Map<string, Map<string, (typeof currentValues)[number]>>();
  for (const v of currentValues) {
    const forEmployee = currentByEmployee.get(v.employeeId) ?? new Map();
    forEmployee.set(v.metricDefinitionId, v);
    currentByEmployee.set(v.employeeId, forEmployee);
  }

  const previousByEmployee = new Map<string, Map<string, (typeof previousValues)[number]>>();
  for (const v of previousValues) {
    const forEmployee = previousByEmployee.get(v.employeeId) ?? new Map();
    forEmployee.set(v.metricDefinitionId, v);
    previousByEmployee.set(v.employeeId, forEmployee);
  }

  for (const employeeId of employeeIds) {
    const currentMap = currentByEmployee.get(employeeId) ?? new Map();
    const previousMap = previousByEmployee.get(employeeId) ?? new Map();

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
        status: evaluateStatus(current?.numericValue ?? null, resolvedTarget, direction),
        qualityStatus: current?.qualityStatus ?? "missing",
        dataFreshnessAt: current?.dataFreshnessAt ?? null,
        calculationVersion: current?.calculationVersion ?? 0,
      });
    }

    rows.sort((a, b) => a.displayOrder - b.displayOrder);
    results.set(employeeId, rows);
  }

  return results;
}

