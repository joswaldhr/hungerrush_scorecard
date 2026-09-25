// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  organizations,
  employees,
  dataSources,
  metricDefinitions,
  metricValues,
  normalizedFacts,
  sourceRecords,
  syncRuns,
  syncRevisions,
} from "@/lib/db/schema";
import { computeMetricValuesFromFacts } from "@/lib/domain/metrics/compute-values";

const org = randomUUID(),
  source = randomUUID(),
  employee = randomUUID(),
  colleague = randomUUID(),
  metric = randomUUID(),
  run = randomUUID();
const observed = new Date("2026-09-24T00:00:00Z");
const intervals = Array.from({ length: 501 }, (_, i) => {
  const start = new Date(Date.UTC(2016, 0, 3 + 7 * i));
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: new Date(start.getTime() + 6 * 86_400_000).toISOString().slice(0, 10),
  };
});
const records = [
  ...intervals.map((period) => ({
    id: randomUUID(),
    employeeId: employee,
    ...period,
    changed: true,
    value: 2,
  })),
  { id: randomUUID(), employeeId: employee, ...intervals[0]!, changed: false, value: 3 },
  { id: randomUUID(), employeeId: colleague, ...intervals[0]!, changed: false, value: 900 },
  {
    id: randomUUID(),
    employeeId: employee,
    ...intervals[0]!,
    periodEnd: "2016-01-10",
    changed: false,
    value: 800,
  },
];

beforeAll(async () => {
  await db.insert(organizations).values({ id: org, name: "Bounded computation test" });
  await db
    .insert(employees)
    .values(
      [employee, colleague].map((id) => ({ id, organizationId: org, displayName: "Synthetic" }))
    );
  await db
    .insert(dataSources)
    .values({ id: source, organizationId: org, type: "scope_test", displayName: "Synthetic" });
  await db.insert(metricDefinitions).values({
    id: metric,
    organizationId: org,
    key: "scope_test",
    name: "Synthetic",
    sourceStrategy: "scope_test",
    calculationType: "sum",
  });
  await db.insert(syncRuns).values({ id: run, dataSourceId: source, status: "running" });
  await db.insert(sourceRecords).values(
    records.map((record) => ({
      id: record.id,
      dataSourceId: source,
      externalRecordType: "test",
      externalRecordId: record.id,
      payloadJson: {},
      payloadHash: "synthetic",
      syncRunId: record.changed ? run : null,
    }))
  );
  await db.insert(normalizedFacts).values(
    records.map((record) => ({
      organizationId: org,
      employeeId: record.employeeId,
      dataSourceId: source,
      sourceRecordId: record.id,
      factType: "scope_test",
      numericValue: record.value,
      periodStart: record.periodStart,
      periodEnd: record.periodEnd,
      sourceObservedAt: observed,
    }))
  );
});
afterAll(async () => {
  await db.delete(metricValues).where(eq(metricValues.metricDefinitionId, metric));
  await db.delete(syncRevisions).where(eq(syncRevisions.syncRunId, run));
  await db.delete(normalizedFacts).where(eq(normalizedFacts.organizationId, org));
  await db.delete(sourceRecords).where(eq(sourceRecords.dataSourceId, source));
  await db.delete(syncRuns).where(eq(syncRuns.id, run));
  await db.delete(metricDefinitions).where(eq(metricDefinitions.id, metric));
  await db.delete(dataSources).where(eq(dataSources.id, source));
  await db.delete(employees).where(eq(employees.organizationId, org));
  await db.delete(organizations).where(eq(organizations.id, org));
});

it("computes across a read batch boundary without including unrelated employees or intervals", async () => {
  const count = await db.transaction((tx) =>
    computeMetricValuesFromFacts(org, "scope_test", {
      connection: tx as unknown as typeof db,
      dataSourceId: source,
      syncRunId: run,
    })
  );
  expect(count).toBe(501);
  const values = await db
    .select()
    .from(metricValues)
    .where(eq(metricValues.metricDefinitionId, metric));
  expect(values).toHaveLength(501);
  expect(values.every((value) => value.employeeId === employee)).toBe(true);
  expect(values.find((value) => value.periodStart === intervals[0]!.periodStart)).toMatchObject({
    numericValue: 5,
    periodEnd: intervals[0]!.periodEnd,
    dataFreshnessAt: observed,
  });
  expect(
    values
      .filter((value) => value.periodStart !== intervals[0]!.periodStart)
      .every((value) => value.numericValue === 2)
  ).toBe(true);
});
