import { db } from "@/lib/db";
import {
  normalizedFacts,
  metricDefinitions,
  employees,
  metricValues,
  sourceRecords,
} from "@/lib/db/schema";
import { eq, and, sql, inArray, or } from "drizzle-orm";
import { aggregateSourceValues } from "@/lib/domain/reconciliation/compare";
import { captureSyncRevisions } from "@/lib/connectors/sync-revisions";
import { chunk } from "@/lib/utils";
import type { CalculationType } from "./types";
import {
  sharedMetricSourceContext,
  SOLVED_CSAT_CONTRACT,
  SOLVED_CSAT_CALCULATION_VERSION,
} from "./source-context";

// Rows per bulk upsert statement — see the same constant's comment in
// sync-engine.ts. metricValues has fewer columns than normalizedFacts but
// the same reasoning applies.
const WRITE_CHUNK_SIZE = 500;

// Aggregates normalizedFacts (raw per-sync numbers) into metricValues (the
// values manager-facing pages read) only for records changed in this run from the
// given source. Idempotent — re-running a sync updates existing rows rather
// than duplicating them, via the (metricDefinitionId, employeeId, period) unique index.
export async function computeMetricValuesFromFacts(
  organizationId: string,
  sourceStrategy: string,
  scope: { connection: typeof db; dataSourceId: string; syncRunId: string }
): Promise<number> {
  const connection = scope.connection;
  const changedRecords = connection
    .select({ id: sourceRecords.id })
    .from(sourceRecords)
    .where(
      and(
        eq(sourceRecords.dataSourceId, scope.dataSourceId),
        eq(sourceRecords.syncRunId, scope.syncRunId)
      )
    );
  const defs = await connection
    .select()
    .from(metricDefinitions)
    .where(
      and(
        eq(metricDefinitions.organizationId, organizationId),
        eq(metricDefinitions.sourceStrategy, sourceStrategy)
      )
    );

  const employeeRows = await connection
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
    const affectedFacts = await connection
      .select({
        employeeId: normalizedFacts.employeeId,
        periodStart: normalizedFacts.periodStart,
        periodEnd: normalizedFacts.periodEnd,
      })
      .from(normalizedFacts)
      .where(
        and(
          eq(normalizedFacts.organizationId, organizationId),
          eq(normalizedFacts.factType, def.key),
          eq(normalizedFacts.dataSourceId, scope.dataSourceId),
          inArray(normalizedFacts.sourceRecordId, changedRecords)
        )
      );
    if (affectedFacts.length === 0) continue;
    const groupKey = (fact: (typeof affectedFacts)[number]) =>
      `${fact.employeeId}|${fact.periodStart}|${fact.periodEnd}`;
    const affectedGroups = new Map(affectedFacts.map((fact) => [groupKey(fact), fact]));
    // Restrict the read in PostgreSQL, not after transferring all source history.
    // Include unchanged contributors in each exact employee/interval group. Bound
    // parameters per query even when an explicit replay touches many periods.
    const facts: (typeof normalizedFacts.$inferSelect)[] = [];
    for (const groups of chunk([...affectedGroups.values()], WRITE_CHUNK_SIZE)) {
      const contributors = await connection
        .select()
        .from(normalizedFacts)
        .where(
          and(
            eq(normalizedFacts.organizationId, organizationId),
            eq(normalizedFacts.factType, def.key),
            eq(normalizedFacts.dataSourceId, scope.dataSourceId),
            or(
              ...groups.map((group) =>
                and(
                  eq(normalizedFacts.employeeId, group.employeeId),
                  eq(normalizedFacts.periodStart, group.periodStart),
                  eq(normalizedFacts.periodEnd, group.periodEnd)
                )
              )
            )
          )
        );
      facts.push(...contributors);
    }
    facts.sort(
      (a, b) =>
        a.sourceObservedAt.getTime() - b.sourceObservedAt.getTime() || a.id.localeCompare(b.id)
    );

    const groups = new Map<
      string,
      {
        employeeId: string;
        periodStart: string;
        periodEnd: string;
        values: (number | null)[];
        observed: Date[];
        factIds: string[];
        contexts: unknown[];
      }
    >();
    for (const fact of facts) {
      const key = `${fact.employeeId}|${fact.periodStart}|${fact.periodEnd}`;
      const group = groups.get(key) ?? {
        employeeId: fact.employeeId,
        periodStart: fact.periodStart,
        periodEnd: fact.periodEnd,
        values: [],
        observed: [],
        factIds: [],
        contexts: [],
      };
      group.values.push(fact.numericValue);
      group.observed.push(fact.sourceObservedAt);
      group.factIds.push(fact.id);
      group.contexts.push(fact.dimensionsJson);
      groups.set(key, group);
    }

    for (const group of groups.values()) {
      const sourceContext = sharedMetricSourceContext(group.contexts);
      const value = aggregateSourceValues(group.values, def.calculationType as CalculationType);

      rows.push({
        metricDefinitionId: def.id,
        employeeId: group.employeeId,
        teamId: teamByEmployee.get(group.employeeId) ?? null,
        periodStart: group.periodStart,
        periodEnd: group.periodEnd,
        numericValue:
          value === null
            ? null
            : sourceContext?.sourceContract === SOLVED_CSAT_CONTRACT
              ? value
              : Math.round(value * 100) / 100,
        textValue: null,
        calculationVersion:
          sourceContext?.sourceContract === SOLVED_CSAT_CONTRACT
            ? SOLVED_CSAT_CALCULATION_VERSION
            : def.version,
        calculatedAt: new Date(),
        dataFreshnessAt: new Date(Math.min(...group.observed.map((date) => date.getTime()))),
        qualityStatus:
          value === null
            ? "missing"
            : group.values.some((value) => value === null)
              ? "partial"
              : "complete",
        provenanceJson: {
          sourceStrategy,
          dataSourceId: scope.dataSourceId,
          syncRunId: scope.syncRunId,
          factIds: group.factIds,
          ...(sourceContext ?? {}),
        },
      });
    }
  }

  for (const batch of chunk(rows, WRITE_CHUNK_SIZE)) {
    const condition = or(
      ...batch.map((row) =>
        and(
          eq(metricValues.metricDefinitionId, row.metricDefinitionId),
          eq(metricValues.employeeId, row.employeeId),
          eq(metricValues.periodStart, row.periodStart),
          eq(metricValues.periodEnd, row.periodEnd)
        )
      )
    )!;
    await captureSyncRevisions(connection, "metric_value", condition, scope.syncRunId);
    await connection
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
          textValue: sql`excluded.text_value`,
          calculatedAt: sql`excluded.calculated_at`,
          calculationVersion: sql`excluded.calculation_version`,
          dataFreshnessAt: sql`excluded.data_freshness_at`,
          qualityStatus: sql`excluded.quality_status`,
          provenanceJson: sql`excluded.provenance_json`,
        },
      });
  }

  return rows.length;
}
