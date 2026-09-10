import { db } from "@/lib/db";
import { normalizedFacts, metricDefinitions, employees, metricValues } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { aggregateSourceValues } from "@/lib/domain/reconciliation/compare";
import { chunk } from "@/lib/utils";
import type { CalculationType } from "./types";

// Rows per bulk upsert statement — see the same constant's comment in
// sync-engine.ts. metricValues has fewer columns than normalizedFacts but
// the same reasoning applies.
const WRITE_CHUNK_SIZE = 500;

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

  // Collect every row to write in memory first — safe to batch arbitrarily:
  // each metric definition has a distinct id and groups within one
  // definition are keyed by (employeeId, periodStart, periodEnd), so the
  // full 4-column conflict target is unique across this entire array.
  const rows: (typeof metricValues.$inferInsert)[] = [];

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

      rows.push({
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
      });
    }
  }

  for (const batch of chunk(rows, WRITE_CHUNK_SIZE)) {
    await db
      .insert(metricValues)
      .values(batch)
      .onConflictDoUpdate({
        target: [
          metricValues.metricDefinitionId,
          metricValues.employeeId,
          metricValues.periodStart,
          metricValues.periodEnd,
        ],
        set: {
          numericValue: sql`excluded.numeric_value`,
          dataFreshnessAt: sql`excluded.data_freshness_at`,
          qualityStatus: sql`excluded.quality_status`,
          provenanceJson: sql`excluded.provenance_json`,
        },
      });
  }

  return rows.length;
}
