import { db } from "@/lib/db";
import { normalizedFacts, metricDefinitions, employees, metricValues } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { aggregateSourceValues } from "@/lib/domain/reconciliation/compare";
import type { CalculationType } from "./types";

// Aggregates normalizedFacts (raw per-sync numbers) into metricValues (the
// values manager-facing pages read) for every metric definition fed by the
// given source. Idempotent — re-running a sync updates existing rows rather
// than duplicating them, via the (metricDefinitionId, employeeId, period) unique index.
export async function computeMetricValuesFromFacts(
  organizationId: string,
  sourceStrategy: string
): Promise<number> {
  const defs = await db
    .select()
    .from(metricDefinitions)
    .where(
      and(
        eq(metricDefinitions.organizationId, organizationId),
        eq(metricDefinitions.sourceStrategy, sourceStrategy)
      )
    );

  const employeeRows = await db
    .select({ id: employees.id, teamId: employees.primaryTeamId })
    .from(employees)
    .where(eq(employees.organizationId, organizationId));
  const teamByEmployee = new Map(employeeRows.map((e) => [e.id, e.teamId]));

  let written = 0;

  for (const def of defs) {
    const facts = await db
      .select()
      .from(normalizedFacts)
      .where(
        and(
          eq(normalizedFacts.organizationId, organizationId),
          eq(normalizedFacts.factType, def.key)
        )
      );

    const groups = new Map<
      string,
      { employeeId: string; periodStart: string; periodEnd: string; values: number[] }
    >();
    for (const fact of facts) {
      if (fact.numericValue === null) continue;
      const key = `${fact.employeeId}|${fact.periodStart}|${fact.periodEnd}`;
      const group = groups.get(key) ?? {
        employeeId: fact.employeeId,
        periodStart: fact.periodStart,
        periodEnd: fact.periodEnd,
        values: [],
      };
      group.values.push(fact.numericValue);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      const value = aggregateSourceValues(group.values, def.calculationType as CalculationType);
      if (value === null) continue;

      await db
        .insert(metricValues)
        .values({
          metricDefinitionId: def.id,
          employeeId: group.employeeId,
          teamId: teamByEmployee.get(group.employeeId) ?? null,
          periodStart: group.periodStart,
          periodEnd: group.periodEnd,
          numericValue: Math.round(value * 100) / 100,
          calculationVersion: 1,
          dataFreshnessAt: new Date(),
          qualityStatus: "complete",
          provenanceJson: { sourceStrategy },
        })
        .onConflictDoUpdate({
          target: [
            metricValues.metricDefinitionId,
            metricValues.employeeId,
            metricValues.periodStart,
            metricValues.periodEnd,
          ],
          set: {
            numericValue: Math.round(value * 100) / 100,
            dataFreshnessAt: new Date(),
            qualityStatus: "complete",
            provenanceJson: { sourceStrategy },
          },
        });
      written++;
    }
  }

  return written;
}
